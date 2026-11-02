import { Request, Response } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { ProductionService } from './production.service';
import { CreateProductionUpdateInput } from './production.schema';
import { AppError } from '../../common/errors/AppError';

export class ProductionController {
  /**
   * GET /api/v1/production/work
   * Returns active orders and milestones assigned to the supervisor's manufacturing unit.
   */
  static getSupervisorWork = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const data = await ProductionService.getSupervisorWork(req.user);
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
