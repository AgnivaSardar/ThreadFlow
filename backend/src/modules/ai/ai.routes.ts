import { Router } from 'express';
import { AIController } from './ai.controller';
import { authMiddleware, requireRole } from '../../common/middleware/auth';
import { validateRequest } from '../../common/middleware/validate';
import {
  classifyNoteSchema,
  getIssuesQueueSchema,
  confirmIssueSchema,
  overrideIssueSchema,
} from './ai.schema';
import { Role } from '@prisma/client';

const router = Router();

// All AI routes require authentication
router.use(authMiddleware);

// Supervisors, Merchandisers, and Admins can request real-time text classification
router.post(
  '/classify',
  requireRole(Role.SUPERVISOR, Role.MERCHANDISER, Role.ADMIN),
  validateRequest(classifyNoteSchema),
  AIController.classifyText
);

// Merchandisers and Admins can view and manage the HITL issue review queue
router.get(
  '/issues',
  requireRole(Role.MERCHANDISER, Role.ADMIN),
  validateRequest(getIssuesQueueSchema),
  AIController.getIssuesQueue
);

// Merchandisers and Admins can confirm AI classification
router.patch(
  '/issues/:id/confirm',
  requireRole(Role.MERCHANDISER, Role.ADMIN),
  validateRequest(confirmIssueSchema),
  AIController.confirmIssue
);

// Merchandisers and Admins can override AI classification
router.patch(
  '/issues/:id/override',
  requireRole(Role.MERCHANDISER, Role.ADMIN),
  validateRequest(overrideIssueSchema),
  AIController.overrideIssue
);

export const aiRoutes = router;
