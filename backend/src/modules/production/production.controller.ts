import { Request, Response } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { ProductionService } from './production.service';
import {
  CreateProductionUpdateInput,
  BulkProductionUpdateInput,
} from './production.schema';
import { AppError } from '../../common/errors/AppError';
import { detectMissingShiftUpdates } from '../../jobs/shiftCutoff.job';
import { prisma } from '../../config/db';

export class ProductionController {
  /**
   * GET /api/v1/production/missing-shift-updates
   * Evaluates missing updates past the 6:00 PM IST shift cut-off time.
   */
  static getMissingShiftUpdates = asyncHandler(async (req: Request, res: Response) => {
    const simulateCutoff = req.query.simulate === 'true' || req.query.simulateCutoff === 'true';
    const result = await detectMissingShiftUpdates(simulateCutoff);
    res.status(200).json({
      success: true,
      data: result,
    });
  });

  /**
   * POST /api/v1/production/log-nudge
   * Records a WhatsApp nudge dispatch in the immutable audit event log.
   */
  static logWhatsAppNudge = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const { unitId, supervisorName, missingOrdersCount, poNumbers } = req.body;

    const event = await prisma.auditEvent.create({
      data: {
        entityType: 'Unit',
        entityId: unitId || req.user.id,
        action: 'WHATSAPP_SHIFT_NUDGE',
        category: 'STAGE_OUTPUT',
        reasonCode: 'SHIFT_CUTOFF_FOLLOWUP',
        notes: `Bilingual Tamil & English WhatsApp nudge dispatched to ${supervisorName || 'Supervisor'} for ${missingOrdersCount || 0} pending POs (${(poNumbers || []).join(', ')}).`,
        financialImpactRupees: 0,
        userId: req.user.id,
        userRole: req.user.role,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Nudge logged in audit chain',
      data: event,
    });
  });
  /**
   * GET /api/v1/production/work
   * Returns active orders and milestones assigned to the supervisor's manufacturing unit.
   */
  static getSupervisorWork = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const unitId = typeof req.query.unitId === 'string' ? req.query.unitId : undefined;
    const data = await ProductionService.getSupervisorWork(req.user, unitId);
    res.status(200).json({
      success: true,
      data,
    });
  });

  /**
   * POST /api/v1/production/updates
   * Logs a shift production quantity update with idempotency and invariant validation.
   */
  static createProductionUpdate = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const result = await ProductionService.createProductionUpdate(
      req.body as CreateProductionUpdateInput,
      req.user
    );
    res.status(result.isDuplicate ? 200 : 201).json({
      success: true,
      isDuplicate: result.isDuplicate,
      message: result.message,
      data: result.update,
      milestone: (result as any).milestone,
    });
  });

  /**
   * POST /api/v1/production/updates/bulk
   * Ingests a batch of offline production updates in a single network round-trip.
   */
  static createBulkProductionUpdates = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const { updates } = req.body as BulkProductionUpdateInput;
    const result = await ProductionService.createBulkProductionUpdates(updates, req.user);
    res.status(200).json({
      success: true,
      data: result,
    });
  });

  /**
   * GET /api/v1/production/audit/verify/:milestoneId
   * Verifies the cryptographic SHA-256 Merkle chain from genesis for an order milestone.
   */
  static verifyMilestoneAuditChain = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const { milestoneId } = req.params;
    const result = await ProductionService.verifyMilestoneAuditChain(milestoneId);
    res.status(200).json({
      success: true,
      data: result,
    });
  });

  /**
   * GET /api/v1/production/history
   * Fetches recent shift update logs.
   */
  static getProductionHistory = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const orderId = req.query.orderId as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const history = await ProductionService.getProductionHistory(orderId, limit);
    res.status(200).json({
      success: true,
      count: history.length,
      data: history,
    });
  });
}
