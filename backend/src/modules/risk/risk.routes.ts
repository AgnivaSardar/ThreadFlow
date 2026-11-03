import { Router } from 'express';
import { authMiddleware, enforceBuyerTenantScope } from '../../common/middleware/auth';
import { RiskController } from './risk.controller';

const router = Router();

// Apply auth and tenant scoping
router.use(authMiddleware);
router.use(enforceBuyerTenantScope);

// List all active monitored risks with filters and KPIs
router.get('/', RiskController.listRisks);

// Feature 10: Human-in-the-Loop Review Gate & Merchandiser Risk Dashboard
router.get('/alerts', RiskController.listAlerts);
router.post('/alerts/:id/confirm', RiskController.confirmAlert);
router.post('/alerts/:id/override', RiskController.overrideAlert);
router.post('/alerts/:id/generate-mitigation', RiskController.generateMitigation);

// Real-time What-If line capacity simulation
router.post('/simulate', RiskController.simulateRate);

// Deterministic on-demand evaluation of a specific milestone risk
router.get('/:orderId/:milestoneId', RiskController.evaluateMilestone);

export const riskRoutes = router;
