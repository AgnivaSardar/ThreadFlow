import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { AppError } from '../../common/errors/AppError';
import { BuyerPortalService } from './buyer.service';
import { prisma } from '../../config/db';

export class BuyerPortalController {
  /**
   * Helper to resolve the authoritative buyerId for the request.
   * For Role.BUYER: strictly locked to req.user.buyerId (impossible to spoof or override).
   * For Role.MERCHANDISER or Role.ADMIN: defaults to requested buyerId or primary buyer.
   */
  private static async resolveBuyerId(req: Request): Promise<string> {
    const user = req.user;
    if (!user) {
      throw new AppError('Authentication required', 401);
    }

    if (user.role === Role.BUYER) {
      if (!user.buyerId) {
        throw new AppError('Forbidden: Buyer account has no assigned organization', 403);
      }
      return user.buyerId;
    }

    // Merchandiser / Admin view
    if (req.query.buyerId && typeof req.query.buyerId === 'string') {
      return req.query.buyerId;
    }

    // Default to the first buyer organization if none specified
    const defaultBuyer = await prisma.buyer.findFirst({
      orderBy: { name: 'asc' },
    });

    if (!defaultBuyer) {
      throw new AppError('No buyer organization found', 404);
    }

    return defaultBuyer.id;
  }

  static getProfile = asyncHandler(async (req: Request, res: Response) => {
    const buyerId = await BuyerPortalController.resolveBuyerId(req);
    const profile = await BuyerPortalService.getBuyerProfile(buyerId);

    res.status(200).json({
      success: true,
      data: profile,
    });
  });

  static getOrders = asyncHandler(async (req: Request, res: Response) => {
    const buyerId = await BuyerPortalController.resolveBuyerId(req);
    const search = req.query.search as string | undefined;
    const orders = await BuyerPortalService.getBuyerOrders(buyerId, search);

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  });

  static getOrderById = asyncHandler(async (req: Request, res: Response) => {
    const buyerId = await BuyerPortalController.resolveBuyerId(req);
    const { id } = req.params;
    const order = await BuyerPortalService.getBuyerOrderById(buyerId, id);

    res.status(200).json({
      success: true,
      data: order,
    });
  });

  static postFeedback = asyncHandler(async (req: Request, res: Response) => {
    const buyerId = await BuyerPortalController.resolveBuyerId(req);
    const { id } = req.params;
    const { message, productionUpdateId } = req.body;

    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const feedback = await BuyerPortalService.postBuyerFeedback(
      buyerId,
      id,
      req.user,
      message,
      productionUpdateId
    );

    res.status(201).json({
      success: true,
      message: 'Buyer response logged successfully in audit registry',
      data: feedback,
    });
  });
}
