import { Router } from 'express';
import { authController } from './auth.controller';
import { authMiddleware } from '../../common/middleware/auth';
import { asyncHandler } from '../../common/utils/asyncHandler';

const router = Router();

// Public routes
router.post('/login', asyncHandler((req, res) => authController.login(req, res)));
router.post('/refresh', asyncHandler((req, res) => authController.refresh(req, res)));
router.post('/logout', asyncHandler((req, res) => authController.logout(req, res)));
router.get('/magic-link/:token', asyncHandler((req, res) => authController.validateMagicLink(req, res)));

// Protected route
router.get('/me', authMiddleware, asyncHandler((req, res) => authController.me(req, res)));

export const authRoutes = router;
