import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { AppError } from '../../common/errors/AppError';
import { ReportsService } from './reports.service';
import { getISOWeekInfo, getSystemToday } from '../../common/utils/dates';

export class ReportsController {
  static getWeeklySummary = asyncHandler(async (req: Request, res: Response) => {
    let buyerId = req.query.buyerId as string | undefined;
    const week = req.query.week as string | undefined;

    // Strict multi-tenant buyer isolation
    if (req.user?.role === Role.BUYER) {
      if (!req.user.buyerId) {
        throw new AppError('Forbidden: Buyer account has no assigned organization', 403);
      }
      if (buyerId && buyerId !== req.user.buyerId) {
        throw new AppError('Forbidden: Cannot access report for another buyer organization', 403);
      }
      buyerId = req.user.buyerId;
    }

    const summary = await ReportsService.getWeeklySummary(buyerId, week);
    res.status(200).json({
      success: true,
      data: summary,
    });
  });

  static archiveReport = asyncHandler(async (req: Request, res: Response) => {
    let { buyerId, weekNumber, year } = req.body;

    // Strict multi-tenant buyer isolation
    if (req.user?.role === Role.BUYER) {
      if (!req.user.buyerId) {
        throw new AppError('Forbidden: Buyer account has no assigned organization', 403);
      }
      if (buyerId && buyerId !== req.user.buyerId) {
        throw new AppError('Forbidden: Cannot archive report for another buyer organization', 403);
      }
      buyerId = req.user.buyerId;
    }
    const currentWeekInfo = getISOWeekInfo(getSystemToday());

    const report = await ReportsService.saveWeeklyReportSnapshot(
      buyerId,
      Number(weekNumber) || currentWeekInfo.weekNumber,
      Number(year) || currentWeekInfo.year,
      req.user?.id
    );
    res.status(201).json({
      success: true,
      data: report,
    });
  });
}
