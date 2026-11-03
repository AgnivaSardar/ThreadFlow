import { Router } from 'express';
import { ProductionController } from './production.controller';
import { authMiddleware, requireRole } from '../../common/middleware/auth';
import { validateRequest } from '../../common/middleware/validate';
import {
  createProductionUpdateSchema,
  bulkProductionUpdateSchema,
} from './production.schema';
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

// Single production update ingestion
router.post(
  '/updates',
  requireRole(Role.SUPERVISOR, Role.MERCHANDISER, Role.ADMIN),
  validateRequest(createProductionUpdateSchema),
  ProductionController.createProductionUpdate
);

// Bulk batch production updates ingestion (Offline queue sync acceleration)
router.post(
  '/updates/bulk',
  requireRole(Role.SUPERVISOR, Role.MERCHANDISER, Role.ADMIN),
  validateRequest(bulkProductionUpdateSchema),
  ProductionController.createBulkProductionUpdates
);

// Cryptographic audit chain verification
router.get(
  '/audit/verify/:milestoneId',
  requireRole(Role.SUPERVISOR, Role.MERCHANDISER, Role.ADMIN, Role.BUYER),
  ProductionController.verifyMilestoneAuditChain
);

// Shift Cut-off Missing Updates Detector (Feature 13)
router.get(
  '/missing-shift-updates',
  requireRole(Role.SUPERVISOR, Role.MERCHANDISER, Role.ADMIN),
  ProductionController.getMissingShiftUpdates
);

router.post(
  '/log-nudge',
  requireRole(Role.MERCHANDISER, Role.ADMIN),
  ProductionController.logWhatsAppNudge
);

// Retrieve history
router.get(
  '/history',
  requireRole(Role.SUPERVISOR, Role.MERCHANDISER, Role.ADMIN),
  ProductionController.getProductionHistory
);

export const productionRoutes = router;
