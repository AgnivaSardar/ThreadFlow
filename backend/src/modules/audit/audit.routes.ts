import { Router } from 'express';
import { AuditController } from './audit.controller';
import { authMiddleware, requireRole } from '../../common/middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

router.use(authMiddleware);
router.use(requireRole(Role.MERCHANDISER, Role.ADMIN));

router.get('/', AuditController.listEvents);
router.get('/verify-chain', AuditController.verifyChain);

export const auditRoutes = router;
