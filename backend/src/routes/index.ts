import { Router } from 'express';
import { authRoutes } from '../modules/auth/auth.routes';

const router = Router();

router.use('/auth', authRoutes);

// Health check endpoint
router.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

export const apiRouter = router;
