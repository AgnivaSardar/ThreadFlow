import { Router } from 'express';
import { Role } from '@prisma/client';
import { UsersController } from './users.controller';
import { authMiddleware, requireRole } from '../../common/middleware/auth';
import { asyncHandler } from '../../common/utils/asyncHandler';

const router = Router();

// Protect all user routes
router.use(authMiddleware);

// Dropdown metadata (Units & Buyers)
router.get('/metadata', asyncHandler(UsersController.getMetadata));

// List all supervisors with their floor work assignments (Admin and Merchandiser)
router.get(
  '/supervisors',
  requireRole(Role.ADMIN, Role.MERCHANDISER),
  asyncHandler(UsersController.listSupervisors)
);

// Update supervisor assignment (Admin and Merchandiser)
router.patch(
  '/supervisors/:id',
  requireRole(Role.ADMIN, Role.MERCHANDISER),
  asyncHandler(UsersController.updateSupervisorAssignment)
);

// Create new member (Admin only)
router.post(
  '/',
  requireRole(Role.ADMIN),
  asyncHandler(UsersController.createMember)
);

export const usersRoutes = router;
