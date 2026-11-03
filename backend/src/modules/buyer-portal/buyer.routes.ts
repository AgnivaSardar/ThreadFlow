import { Router } from 'express';
import { authMiddleware, requireRole } from '../../common/middleware/auth';
import { Role } from '@prisma/client';
import { BuyerPortalController } from './buyer.controller';

const router = Router();

// All routes strictly require authentication
router.use(authMiddleware);

// Only BUYER, MERCHANDISER, and ADMIN can access the Buyer Portal
router.use(requireRole(Role.BUYER, Role.MERCHANDISER, Role.ADMIN));

router.get('/profile', BuyerPortalController.getProfile);
router.get('/orders', BuyerPortalController.getOrders);
router.get('/orders/:id', BuyerPortalController.getOrderById);
router.post('/orders/:id/feedback', BuyerPortalController.postFeedback);

export const buyerPortalRoutes = router;
