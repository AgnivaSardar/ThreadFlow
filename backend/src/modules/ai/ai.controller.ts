import { Request, Response } from 'express';
import { AIService } from './ai.service';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { IssueCategory } from '@prisma/client';

export class AIController {
  /**
   * Direct classification of raw Tamil/Tanglish floor notes.
   */
  static classifyText = asyncHandler(async (req: Request, res: Response) => {
    const { rawText, timeoutMs, skipLlm, orderId, productionUpdateId, context } = req.body;

    const result = await AIService.classifyIssueNote(rawText, {
      timeoutMs,
      skipLlm,
      orderId,
      productionUpdateId,
      context,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  });

  /**
   * Merchandiser HITL Issue Queue retrieval.
   */
  static getIssuesQueue = asyncHandler(async (req: Request, res: Response) => {
    const { needsReview, category, isConfirmed, page, limit } = req.query as any;

    const queue = await AIService.getIssuesQueue({
      needsReview,
      category,
      isConfirmed,
      page,
      limit,
    });

    res.status(200).json({
      success: true,
      data: queue,
    });
  });

  /**
   * Merchandiser confirms AI classification.
   */
  static confirmIssue = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = req.user!;

    const updated = await AIService.confirmClassification(id, user.id);

    res.status(200).json({
      success: true,
      message: 'Issue classification confirmed successfully',
      data: updated,
    });
  });

  /**
   * Merchandiser overrides AI classification.
   */
  static overrideIssue = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { newCategory, reason } = req.body;
    const user = req.user!;

    const updated = await AIService.overrideClassification(
      id,
      newCategory as IssueCategory,
      user.id,
      reason
    );

    res.status(200).json({
      success: true,
      message: 'Issue classification overridden successfully',
      data: updated,
    });
  });
}
