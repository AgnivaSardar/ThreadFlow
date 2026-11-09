import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { AppError } from '../../common/errors/AppError';
import { ReportsService } from './reports.service';

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
    const now = new Date();
    const currentYear = now.getFullYear();
    const target = new Date(now.valueOf());
    const dayNr = (now.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
    }
    const currentWeek = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);

    const report = await ReportsService.saveWeeklyReportSnapshot(
      buyerId,
      Number(weekNumber) || currentWeek,
      Number(year) || currentYear,
      req.user?.id
    );
    res.status(201).json({
      success: true,
      data: report,
    });
  });
}
