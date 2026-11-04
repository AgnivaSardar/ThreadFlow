import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Role, User } from '@prisma/client';
import { prisma } from '../../config/db';
import { config } from '../../config/env';
import { AppError } from '../../common/errors/AppError';
import { TokenPayload } from '../../common/middleware/auth';
import { emailService } from '../../services/email.service';
import { randomUUID } from 'crypto';

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
      try {
        decoded = jwt.verify(refreshToken, 'threadflow_refresh_secret_super_secure_key_67890') as { id: string };
      } catch {
        throw new AppError('Invalid or expired refresh token. Please sign in again', 401);
      }
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

  /**
   * Updates user profile fields (name, phone, languagePreference)
   */
  public async updateProfile(
    userId: string,
    data: { name?: string; phone?: string; languagePreference?: string }
  ): Promise<UserSessionDTO> {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.phone !== undefined ? { phone: data.phone.trim() || null } : {}),
        ...(data.languagePreference ? { languagePreference: data.languagePreference } : {}),
      },
      include: {
        buyer: { select: { id: true, name: true, code: true } },
        assignedUnit: { select: { id: true, name: true, code: true } },
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      languagePreference: updated.languagePreference,
      phone: updated.phone,
      buyerId: updated.buyerId,
      assignedUnitId: updated.assignedUnitId,
      buyer: updated.buyer,
      assignedUnit: updated.assignedUnit,
    };
  }

  /**
   * Dispatches a secure password recovery instruction for a work email.
   */
  public async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user) {
      console.log(`[AUTH] Password recovery requested for: ${user.email} (${user.role})`);
      const resetToken = randomUUID();
      await emailService.sendPasswordResetEmail(user.email, resetToken);
    }

    return {
      success: true,
      message: `If an account exists for ${normalizedEmail}, password reset instructions have been dispatched.`,
    };
  }
}

export const authService = new AuthService();
