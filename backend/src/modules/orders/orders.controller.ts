import { Request, Response } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { OrdersService } from './orders.service';
import {
  CreateOrderInput,
  UpdateExFactoryDateInput,
  BulkShiftExFactoryDateInput,
  OrderQueryFilters,
  AdvanceStageInput,
} from './orders.schema';
import { AppError } from '../../common/errors/AppError';

export class OrdersController {
  static createOrder = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const order = await OrdersService.createOrder(req.body as CreateOrderInput, req.user);
    res.status(201).json({
      success: true,
      message: 'Export Purchase Order & 7-Stage TNA Pipeline created successfully',
      data: order,
    });
  });

  static listOrders = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const result = await OrdersService.listOrders(req.query as OrderQueryFilters, req.user);
    res.status(200).json({
      success: true,
      count: result.orders.length,
      data: result.orders,
      pagination: result.pagination,
    });
  });

  static getOrderById = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const order = await OrdersService.getOrderById(req.params.id, req.user);
    res.status(200).json({
      success: true,
      data: order,
    });
  });

  static updateExFactoryDate = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const { id } = req.params;
    const { newExFactoryDate, reasonCode, notes, financialImpactRupees } = req.body as UpdateExFactoryDateInput;

    const updated = await OrdersService.updateExFactoryDate(
      id,
      newExFactoryDate,
      reasonCode,
      req.user.id,
      notes,
      financialImpactRupees,
      req.ip,
      req.headers['user-agent'] as string | undefined
    );

    res.status(200).json({
      success: true,
      message: 'Ex-Factory delivery date updated and tamper-evident audit record generated',
      data: updated,
    });
  });

  static bulkShiftExFactoryDate = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const { orderIds, shiftDays, newExFactoryDate, reasonCode, notes } =
      req.body as BulkShiftExFactoryDateInput;

    const result = await OrdersService.bulkShiftExFactoryDate(
      orderIds,
      shiftDays,
      newExFactoryDate,
      reasonCode,
      req.user.id,
      notes,
      req.ip,
      req.headers['user-agent'] as string | undefined
    );

    res.status(200).json({
      success: true,
      message: `Bulk ex-factory date shift applied to ${result.updatedCount} orders and buyer notifications logged`,
      data: result,
    });
  });

  static getMasterData = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const data = await OrdersService.getMasterData(req.user);
    res.status(200).json({
      success: true,
      data,
    });
  });

  static advanceStage = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const { id } = req.params;
    const result = await OrdersService.advanceStage(
      id,
      req.body as AdvanceStageInput,
      req.user.id,
      req.ip,
      req.headers['user-agent'] as string | undefined
    );

    res.status(200).json({
      success: true,
      message: `Stage successfully advanced from ${result.fromStage} to ${result.nextStage}`,
      data: result,
    });
  });
}
