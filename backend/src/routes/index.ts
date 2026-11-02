import { Router } from 'express';
import { authRoutes } from '../modules/auth/auth.routes';
import { ordersRoutes } from '../modules/orders/orders.routes';
import { riskRoutes } from '../modules/risk/risk.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/orders', ordersRoutes);
router.use('/risk', riskRoutes);

// Health check endpoint
router.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
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
