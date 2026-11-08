import { Router } from 'express';
import { authRoutes } from '../modules/auth/auth.routes';
import { ordersRoutes } from '../modules/orders/orders.routes';
import { riskRoutes } from '../modules/risk/risk.routes';
import { productionRoutes } from '../modules/production/production.routes';
import { aiRoutes } from '../modules/ai/ai.routes';
import { buyerPortalRoutes } from '../modules/buyer-portal/buyer.routes';
import { auditRoutes } from '../modules/audit/audit.routes';
import { reportsRoutes } from '../modules/reports/reports.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/orders', ordersRoutes);
router.use('/risk', riskRoutes);
router.use('/production', productionRoutes);
router.use('/ai', aiRoutes);
router.use('/buyer-portal', buyerPortalRoutes);
router.use('/audit', auditRoutes);
router.use('/reports', reportsRoutes);

// Health check endpoint
router.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', version: '1.2.0', timestamp: new Date().toISOString() });
});

// Authoritative Server Time endpoint (immune to client machine clock manipulation)
router.get('/time', (_req, res) => {
  const now = new Date();
  res.status(200).json({
    success: true,
    serverTimeIso: now.toISOString(),
    serverTimestamp: now.getTime(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
  });
});

export const apiRouter = router;
