import { Request, Response } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { AuditService } from './audit.service';

export class AuditController {
  static listEvents = asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      action: req.query.action as string,
      category: req.query.category as string,
      userRole: req.query.userRole as string,
      entityType: req.query.entityType as string,
      search: req.query.search as string,
    };

    const result = await AuditService.listAuditEvents(filters);
    res.status(200).json({
      success: true,
      data: result,
    });
  });

  static verifyChain = asyncHandler(async (_req: Request, res: Response) => {
    const result = await AuditService.verifyAuditChain();
    res.status(200).json({
      success: true,
      data: result,
    });
  });
}
