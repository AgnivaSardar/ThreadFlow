import { Router } from 'express';
import { Role } from '@prisma/client';
import { authMiddleware, requireRole, enforceBuyerTenantScope } from '../../common/middleware/auth';
import { validateRequest } from '../../common/middleware/validate';
import { OrdersController } from './orders.controller';
import {
  createOrderSchema,
  updateExFactoryDateSchema,
  bulkShiftExFactoryDateSchema,
  advanceStageSchema,
  orderQuerySchema,
} from './orders.schema';

const router = Router();

// Apply core authentication and multi-tenant scoping
router.use(authMiddleware);
router.use(enforceBuyerTenantScope);

// Master data for form selectors (Buyers, Units)
router.get('/master-data', OrdersController.getMasterData);

// List orders with query filters
router.get('/', validateRequest(orderQuerySchema), OrdersController.listOrders);

// Bulk shift ex-factory dates with mandatory reason code & buyer notification logging
router.patch(
  '/bulk/ex-factory-date',
  requireRole(Role.MERCHANDISER, Role.ADMIN),
  validateRequest(bulkShiftExFactoryDateSchema),
  OrdersController.bulkShiftExFactoryDate
);

// Single order details with size breakdown, milestones, and audit history
router.get('/:id', OrdersController.getOrderById);

// Create export order with child lines and 7 TNA milestones
router.post(
  '/',
  requireRole(Role.MERCHANDISER, Role.ADMIN),
  validateRequest(createOrderSchema),
  OrdersController.createOrder
);

// Alter ex-factory date with mandatory reason code & audit trail
router.patch(
  '/:id/ex-factory-date',
  requireRole(Role.MERCHANDISER, Role.ADMIN),
  validateRequest(updateExFactoryDateSchema),
  OrdersController.updateExFactoryDate
);

// Manually advance stage to next process (with optional downstream target adjustment & audit trail)
router.post(
  '/:id/advance-stage',
  requireRole(Role.MERCHANDISER, Role.ADMIN),
  validateRequest(advanceStageSchema),
  OrdersController.advanceStage
);

export const ordersRoutes = router;
