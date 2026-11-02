import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Role, User } from '@prisma/client';
import { prisma } from '../../config/db';
import { config } from '../../config/env';
import { AppError } from '../../common/errors/AppError';
import { hashToken } from '../../common/utils/crypto';
import { TokenPayload } from '../../common/middleware/auth';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserSessionDTO {
  id: string;
  email: string;
  name: string;
  role: Role;
  languagePreference: string;
  phone?: string | null;
  buyerId?: string | null;
  assignedUnitId?: string | null;
  buyer?: { id: string; name: string; code: string } | null;
  assignedUnit?: { id: string; name: string; code: string } | null;
}

export class AuthService {
  /**
   * Generates dual-token pair:
   * 1. Short-lived Access Token (15m) signed with JWT_ACCESS_SECRET
   * 2. Long-lived Refresh Token (7d) signed with JWT_REFRESH_SECRET
   */
  public generateTokens(user: Pick<User, 'id' | 'email' | 'role' | 'buyerId' | 'assignedUnitId' | 'languagePreference'>): AuthTokens {
    const payload: TokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      buyerId: user.buyerId,
      assignedUnitId: user.assignedUnitId,
      languagePreference: user.languagePreference,
    };

    const accessToken = jwt.sign(payload, config.jwt.accessSecret, {
      expiresIn: config.jwt.accessExpiry as any,
    });

    const refreshToken = jwt.sign(
      { id: user.id },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiry as any }
    );

    return { accessToken, refreshToken };
  }

  /**
   * Authenticates user via email and password using bcrypt comparison.
   */
  public async login(email: string, passwordPlain: string): Promise<{ tokens: AuthTokens; user: UserSessionDTO }> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        buyer: { select: { id: true, name: true, code: true } },
        assignedUnit: { select: { id: true, name: true, code: true } },
      },
    });

    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    const isMatch = await bcrypt.compare(passwordPlain, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401);
    }

    const tokens = this.generateTokens(user);

    const userDTO: UserSessionDTO = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      languagePreference: user.languagePreference,
      phone: user.phone,
      buyerId: user.buyerId,
      assignedUnitId: user.assignedUnitId,
      buyer: user.buyer,
      assignedUnit: user.assignedUnit,
    };

    return { tokens, user: userDTO };
  }

  /**
   * Verifies a 7-day refresh token and re-issues fresh session tokens.
   */
  public async refreshToken(refreshToken: string): Promise<{ tokens: AuthTokens; user: UserSessionDTO }> {
    if (!refreshToken) {
      throw new AppError('Missing refresh token', 401);
    }

    let decoded: { id: string };
    try {
      decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as { id: string };
    } catch {
      throw new AppError('Invalid or expired refresh token. Please sign in again', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        buyer: { select: { id: true, name: true, code: true } },
        assignedUnit: { select: { id: true, name: true, code: true } },
      },
    });

    if (!user) {
      throw new AppError('User session expired or user no longer exists', 401);
    }

    const tokens = this.generateTokens(user);

    const userDTO: UserSessionDTO = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      languagePreference: user.languagePreference,
      phone: user.phone,
      buyerId: user.buyerId,
      assignedUnitId: user.assignedUnitId,
      buyer: user.buyer,
      assignedUnit: user.assignedUnit,
    };

    return { tokens, user: userDTO };
  }

  /**
   * Validates a passwordless cryptographic Magic Link token for foreign buyers,
   * checks its expiry and active status, and authenticates the buyer directly.
   */
  public async validateMagicLink(rawToken: string): Promise<{ tokens: AuthTokens; user: UserSessionDTO }> {
    const hashed = hashToken(rawToken);

    // Check by raw token or SHA-256 hash
    const magicLink = await prisma.buyerMagicLink.findFirst({
      where: {
        OR: [{ token: rawToken }, { tokenHash: hashed }],
      },
      include: {
        buyer: true,
      },
    });

    if (!magicLink) {
      throw new AppError('Magic link is invalid or does not exist', 401);
    }

    if (!magicLink.isActive) {
      throw new AppError('This magic link has been deactivated', 403);
    }

    if (new Date() > magicLink.expiresAt) {
      throw new AppError('This magic link has expired. Please request a new link from your merchandiser', 401);
    }

    // Find a buyer user associated with this buyer, or use/create the default buyer sourcing contact
    let buyerUser = await prisma.user.findFirst({
      where: {
        buyerId: magicLink.buyerId,
        role: Role.BUYER,
      },
      include: {
        buyer: { select: { id: true, name: true, code: true } },
      },
    });

    if (!buyerUser) {
      // Fallback: create temporary or scoped buyer user record for this tenant
      const defaultEmail = magicLink.buyer.contactEmail || `buyer@${magicLink.buyer.code.toLowerCase()}.com`;
      buyerUser = await prisma.user.create({
        data: {
          email: defaultEmail,
          passwordHash: await bcrypt.hash('MAGIC_LINK_AUTH_NO_PASSWORD', 10),
          name: `${magicLink.buyer.name} Sourcing Representative`,
          role: Role.BUYER,
          buyerId: magicLink.buyerId,
          languagePreference: 'en',
        },
        include: {
          buyer: { select: { id: true, name: true, code: true } },
        },
      });
    }

    // Record last used timestamp
    await prisma.buyerMagicLink.update({
      where: { id: magicLink.id },
      data: { lastUsedAt: new Date() },
    });

    const tokens = this.generateTokens(buyerUser);

    const userDTO: UserSessionDTO = {
      id: buyerUser.id,
      email: buyerUser.email,
      name: buyerUser.name,
      role: buyerUser.role,
      languagePreference: buyerUser.languagePreference,
      phone: buyerUser.phone,
      buyerId: buyerUser.buyerId,
      assignedUnitId: null,
      buyer: buyerUser.buyer,
      assignedUnit: null,
    };

    return { tokens, user: userDTO };
  }

  /**
   * Utility to fetch the current user profile from req.user
   */
  public async getProfile(userId: string): Promise<UserSessionDTO> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        buyer: { select: { id: true, name: true, code: true } },
        assignedUnit: { select: { id: true, name: true, code: true } },
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      languagePreference: user.languagePreference,
      phone: user.phone,
      buyerId: user.buyerId,
      assignedUnitId: user.assignedUnitId,
      buyer: user.buyer,
      assignedUnit: user.assignedUnit,
    };
  }
}

export const authService = new AuthService();
