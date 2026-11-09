import { Request, Response } from 'express';
import { authService } from './auth.service';
import { loginSchema } from './auth.schema';
import { config } from '../../config/env';
import { AppError } from '../../common/errors/AppError';

// Cookie options for 7-day HttpOnly refresh token
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: config.isProduction ? ('none' as const) : ('lax' as const),
  maxAge: config.jwt.refreshExpiryDays * 24 * 60 * 60 * 1000,
  path: '/',
};

export class AuthController {
  /**
   * POST /api/v1/auth/login
   * Standard authenticated email + password login
   */
  public async login(req: Request, res: Response): Promise<void> {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0].message, 400);
    }

    const { email, password } = parsed.data;
    const { tokens, user } = await authService.login(email, password);

    // Set 7-day Refresh Token in HttpOnly cookie
    res.cookie('refreshToken', tokens.refreshToken, REFRESH_COOKIE_OPTIONS);

    res.status(200).json({
      success: true,
      message: 'Authentication successful',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user,
    });
  }

  /**
   * POST /api/v1/auth/refresh
   * Exchanges 7-day refresh token for a fresh access token
   */
  public async refresh(req: Request, res: Response): Promise<void> {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!token) {
      throw new AppError('Refresh token missing from request cookie or body', 401);
    }

    const { tokens, user } = await authService.refreshToken(token);

    // Refresh the cookie expiration
    res.cookie('refreshToken', tokens.refreshToken, REFRESH_COOKIE_OPTIONS);

    res.status(200).json({
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user,
    });
  }

  /**
   * POST /api/v1/auth/logout
   * Clears the refresh token cookie
   */
  public async logout(_req: Request, res: Response): Promise<void> {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: config.isProduction ? 'none' : 'lax',
      path: '/',
    });

    res.status(200).json({
      success: true,
      message: 'Session terminated successfully',
    });
  }

  /**
   * GET /api/v1/auth/me
   * Fetches the current authenticated user's profile and active permissions
   */
  public async me(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new AppError('Unauthenticated', 401);
    }

    const user = await authService.getProfile(req.user.id);

    res.status(200).json({
      success: true,
      user,
    });
  }

  /**
   * PATCH /api/v1/auth/me
   * Updates current user's profile details (name, phone, languagePreference)
   */
  public async updateProfile(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new AppError('Unauthenticated', 401);
    }

    const user = await authService.updateProfile(req.user.id, req.body);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user,
    });
  }

  /**
   * POST /api/v1/auth/forgot-password
   * Request password reset 6-digit OTP
   */
  public async forgotPassword(req: Request, res: Response): Promise<void> {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      throw new AppError('Valid work email address is required', 400);
    }

    const result = await authService.requestPasswordResetOtp(email);
    res.status(200).json(result);
  }

  /**
   * POST /api/v1/auth/verify-otp
   * Validates 6-digit OTP
   */
  public async verifyOtp(req: Request, res: Response): Promise<void> {
    const { email, otp } = req.body;
    if (!email || !otp) {
      throw new AppError('Email and 6-digit verification code are required', 400);
    }

    const result = await authService.verifyPasswordResetOtp(email, otp);
    res.status(200).json(result);
  }

  /**
   * POST /api/v1/auth/reset-password
   * Sets new password using verified OTP
   */
  public async resetPassword(req: Request, res: Response): Promise<void> {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      throw new AppError('Email, verification code, and new password are required', 400);
    }

    const result = await authService.resetPasswordWithOtp(email, otp, newPassword);
    res.status(200).json(result);
  }
}

export const authController = new AuthController();
