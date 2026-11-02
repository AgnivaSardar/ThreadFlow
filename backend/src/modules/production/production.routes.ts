import { Router } from 'express';
import { ProductionController } from './production.controller';
import { authMiddleware, requireRole } from '../../common/middleware/auth';
import { validateRequest } from '../../common/middleware/validate';
import { createProductionUpdateSchema } from './production.schema';
import { Role } from '@prisma/client';

const router = Router();

// All production routes require authentication
router.use(authMiddleware);

// Supervisors, Merchandisers, and Admins can view work assigned to units
router.get(
  '/work',
  requireRole(Role.SUPERVISOR, Role.MERCHANDISER, Role.ADMIN),
  ProductionController.getSupervisorWork
);

// Supervisors, Merchandisers, and Admins can log production updates
router.post(
  '/updates',
  requireRole(Role.SUPERVISOR, Role.MERCHANDISER, Role.ADMIN),
  validateRequest(createProductionUpdateSchema),
  ProductionController.createProductionUpdate
);

// Retrieve history
router.get(
  '/history',
  requireRole(Role.SUPERVISOR, Role.MERCHANDISER, Role.ADMIN),
  ProductionController.getProductionHistory
);

export const productionRoutes = router;
