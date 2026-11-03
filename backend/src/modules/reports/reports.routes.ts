import { Router } from 'express';
import { ReportsController } from './reports.controller';
import { authMiddleware, requireRole } from '../../common/middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

router.use(authMiddleware);
router.use(requireRole(Role.MERCHANDISER, Role.ADMIN, Role.BUYER));

router.get('/weekly-summary', ReportsController.getWeeklySummary);
router.post('/archive', ReportsController.archiveReport);

export const reportsRoutes = router;
