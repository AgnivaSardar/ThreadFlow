import { Request, Response } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { RiskService, RiskFilterQuery } from './risk.service';
import { AppError } from '../../common/errors/AppError';

export class RiskController {
  static listRisks = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const result = await RiskService.listActiveRisks(req.query as RiskFilterQuery, req.user);
    res.status(200).json({
      success: true,
      data: result,
    });
  });

  static evaluateMilestone = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const { orderId, milestoneId } = req.params;
    const result = await RiskService.evaluateOrderMilestoneRisk(orderId, milestoneId, req.user);
    res.status(200).json({
      success: true,
      data: result,
    });
  });

  static simulateRate = asyncHandler(async (req: Request, res: Response) => {
    const {
      remainingPieces,
      simulatedRate,
      workingDaysToShip,
      downstreamBufferDays,
      plannedStageEnd,
    } = req.body;

    if (
      remainingPieces === undefined ||
      simulatedRate === undefined ||
      workingDaysToShip === undefined ||
      downstreamBufferDays === undefined ||
      !plannedStageEnd
    ) {
      throw new AppError('Missing parameters for rate simulation', 400);
    }

    const result = RiskService.simulateRateAdjustment(
      Number(remainingPieces),
      Number(simulatedRate),
      Number(workingDaysToShip),
      Number(downstreamBufferDays),
      plannedStageEnd
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  });
}
