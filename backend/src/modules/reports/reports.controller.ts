import { Request, Response } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { ReportsService } from './reports.service';

export class ReportsController {
  static getWeeklySummary = asyncHandler(async (req: Request, res: Response) => {
    const buyerId = req.query.buyerId as string | undefined;
    const week = req.query.week as string | undefined;
    const summary = await ReportsService.getWeeklySummary(buyerId, week);
    res.status(200).json({
      success: true,
      data: summary,
    });
  });

  static archiveReport = asyncHandler(async (req: Request, res: Response) => {
    const { buyerId, weekNumber, year } = req.body;
    const report = await ReportsService.saveWeeklyReportSnapshot(
      buyerId,
      Number(weekNumber) || 44,
      Number(year) || 2026,
      req.user?.id
    );
    res.status(201).json({
      success: true,
      data: report,
    });
  });
}
