import { Router } from 'express';
import { authController } from './auth.controller';
import { authMiddleware } from '../../common/middleware/auth';
import { asyncHandler } from '../../common/utils/asyncHandler';

const router = Router();

// Authenticated session routes
router.post('/login', asyncHandler((req, res) => authController.login(req, res)));
router.post('/refresh', asyncHandler((req, res) => authController.refresh(req, res)));
router.post('/logout', asyncHandler((req, res) => authController.logout(req, res)));
router.post('/forgot-password', asyncHandler((req, res) => authController.forgotPassword(req, res)));
router.post('/verify-otp', asyncHandler((req, res) => authController.verifyOtp(req, res)));
router.post('/reset-password', asyncHandler((req, res) => authController.resetPassword(req, res)));

// Protected profile routes
router.get('/me', authMiddleware, asyncHandler((req, res) => authController.me(req, res)));
router.patch('/me', authMiddleware, asyncHandler((req, res) => authController.updateProfile(req, res)));

export const authRoutes = router;
