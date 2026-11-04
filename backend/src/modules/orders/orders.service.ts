import { Stage, Role, Prisma } from '@prisma/client';
import { prisma } from '../../config/db';
import { AppError } from '../../common/errors/AppError';
import { calculateAuditHash } from '../../common/utils/crypto';
import { AuthenticatedUser } from '../../common/types/express';
import { CreateOrderInput, OrderQueryFilters, AdvanceStageInput } from './orders.schema';

export interface StageLeadTimeConfig {
  stage: Stage;
  sequenceOrder: number;
  bufferDaysAhead: number;
  displayName: string;
}

export const DEFAULT_STAGE_CONFIGS: StageLeadTimeConfig[] = [
  { stage: Stage.KNITTING, sequenceOrder: 1, bufferDaysAhead: 18, displayName: 'Knitting' },
  { stage: Stage.DYEING_WASHING, sequenceOrder: 2, bufferDaysAhead: 14, displayName: 'Dyeing & Washing' },
  { stage: Stage.PRINTING, sequenceOrder: 3, bufferDaysAhead: 11, displayName: 'Printing & Embroidery' },
  { stage: Stage.CUTTING, sequenceOrder: 4, bufferDaysAhead: 9, displayName: 'Fabric Cutting' },
  { stage: Stage.STITCHING, sequenceOrder: 5, bufferDaysAhead: 3, displayName: 'Assembly & Stitching' },
  { stage: Stage.CHECKING, sequenceOrder: 6, bufferDaysAhead: 2, displayName: 'Quality Checking' },
  { stage: Stage.FINISHING, sequenceOrder: 7, bufferDaysAhead: 0, displayName: 'Finishing & Packing' },
];

/**
 * Calculates calendar date excluding Sundays backwards from targetDate.
 */
export function subtractWorkingDays(date: Date, daysToSubtract: number): Date {
  const result = new Date(date);
  let count = 0;
  while (count < daysToSubtract) {
    result.setDate(result.getDate() - 1);
    if (result.getDay() !== 0) {
      // 0 = Sunday
      count++;
    }
  }
  return result;
}

/**
 * Calculates calendar date excluding Sundays forwards from startDate.
 */
export function addWorkingDays(date: Date, daysToAdd: number): Date {
  const result = new Date(date);
  let count = 0;
  while (count < daysToAdd) {
    result.setDate(result.getDate() + 1);
    if (result.getDay() !== 0) {
      count++;
    }
  }
  return result;
}

/**
 * Computes ISO 8601 Ship Week from a date.
 */
export function getIsoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Generates milestone planned start & end dates backwards from exFactoryDate
 * respecting downstream buffer days and Sunday exclusions.
 */
export function computeMilestoneDates(exFactoryDate: Date, orderDate: Date) {
  const sortedStages = [...DEFAULT_STAGE_CONFIGS].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  const milestones = [];

  for (let i = 0; i < sortedStages.length; i++) {
    const config = sortedStages[i];
    // Stage planned end is exFactoryDate minus its downstream buffer days
    const plannedEnd = subtractWorkingDays(exFactoryDate, config.bufferDaysAhead);

    // Stage planned start is previous stage end or orderDate
    let plannedStart: Date;
    if (i === 0) {
      plannedStart = new Date(orderDate);
      if (plannedStart > plannedEnd) {
        plannedStart = subtractWorkingDays(plannedEnd, 3);
      }
    } else {
      const prevConfig = sortedStages[i - 1];
      plannedStart = subtractWorkingDays(exFactoryDate, prevConfig.bufferDaysAhead);
    }

    milestones.push({
      stage: config.stage,
      sequenceOrder: config.sequenceOrder,
      bufferDaysAhead: config.bufferDaysAhead,
      plannedStart,
      plannedEnd,
    });
  }

  return milestones;
}

export class OrdersService {
  /**
   * Creates an Export Order, child OrderLine items, and 7 default TNA milestones
   * wrapped atomically in a Prisma $transaction.
   */
  static async createOrder(input: CreateOrderInput, user: AuthenticatedUser) {
    // 1. Check uniqueness of PO number
    const existing = await prisma.order.findUnique({
      where: { poNumber: input.poNumber },
    });
    if (existing) {
      throw new AppError(`Purchase Order #${input.poNumber} already exists in the system`, 409);
    }

    // 2. Validate Buyer and Unit existence
    const [buyer, unit] = await Promise.all([
      prisma.buyer.findUnique({ where: { id: input.buyerId } }),
      prisma.unit.findUnique({ where: { id: input.unitId } }),
    ]);

    if (!buyer) throw new AppError('Specified Buyer does not exist', 404);
    if (!unit) throw new AppError('Specified Manufacturing Unit does not exist', 404);

    const exFactoryDate = new Date(input.exFactoryDate);
    const orderDate = input.orderDate ? new Date(input.orderDate) : new Date();
    const fobPrice = input.fobPricePerPiece || 0;
    const exchangeRate = input.exchangeRate || 1.0;
    const totalOrderValue = input.totalQuantity * fobPrice * exchangeRate;

    const plannedMilestones = computeMilestoneDates(exFactoryDate, orderDate);

    // 3. Atomic Transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create master Order
      const order = await tx.order.create({
        data: {
          poNumber: input.poNumber.toUpperCase(),
          style: input.style,
          description: input.description,
          totalQuantity: input.totalQuantity,
          currency: input.currency || 'INR',
          exchangeRate,
          fobPricePerPiece: fobPrice,
          totalOrderValue,
          exFactoryDate,
          orderDate,
          buyerId: input.buyerId,
          unitId: input.unitId,
          status: 'ACTIVE',
        },
      });

      // Create OrderLines
      for (const line of input.sizeBreakdowns) {
        await tx.orderLine.create({
          data: {
            orderId: order.id,
            size: line.size.toUpperCase(),
            color: line.color,
            plannedQty: line.plannedQty,
            completedQty: 0,
          },
        });
      }

      // Create 7 TNA Milestones
      for (const ms of plannedMilestones) {
        await tx.tnaMilestone.create({
          data: {
            orderId: order.id,
            stage: ms.stage,
            sequenceOrder: ms.sequenceOrder,
            plannedStart: ms.plannedStart,
            plannedEnd: ms.plannedEnd,
            bufferDaysAhead: ms.bufferDaysAhead,
            targetQuantity: input.totalQuantity,
            completedQuantity: 0,
            unitId: input.unitId,
          },
        });
      }

      // Initial Audit Event
      const timestamp = new Date().toISOString();
      const auditHash = calculateAuditHash(
        null,
        order.id,
        'CREATE_ORDER',
        'INITIAL_PO_CREATION',
        timestamp,
        totalOrderValue
      );

      await tx.auditEvent.create({
        data: {
          entityType: 'Order',
          entityId: order.id,
          orderId: order.id,
          action: 'CREATE_ORDER',
          category: 'DATE_CHANGE',
          reasonCode: 'INITIAL_PO_CREATION',
          notes: `Export PO created with 7-stage TNA pipeline for ${buyer.name} (${input.totalQuantity} pcs)`,
          previousValue: null,
          newValue: JSON.stringify({
            poNumber: order.poNumber,
            exFactoryDate: exFactoryDate.toISOString(),
            totalQuantity: order.totalQuantity,
          }),
          financialImpactRupees: 0,
          auditHash,
          userId: user.id,
          userRole: user.role,
        },
      });

      return order;
    });

    return this.getOrderById(result.id, user);
  }

  /**
   * Updates the ex-factory date of an order with mandatory reason code
   * and tamper-evident audit log creation.
   */
  static async updateExFactoryDate(
    orderId: string,
    newDateStr: string,
    reasonCode: string,
    userId: string,
    notes?: string,
    financialImpactRupees?: number,
    ipAddress?: string,
    userAgent?: string
  ) {
    if (!reasonCode || !reasonCode.trim()) {
      throw new AppError('Reason code is mandatory when modifying ex-factory delivery dates', 400);
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { buyer: true },
    });

    if (!order) {
      throw new AppError(`Order #${orderId} was not found`, 404);
    }

    const newExFactoryDate = new Date(newDateStr);
    const previousDate = order.exFactoryDate;

    // Recalculate milestone dates
    const updatedMilestoneDates = computeMilestoneDates(newExFactoryDate, order.orderDate);

    return await prisma.$transaction(async (tx) => {
      // 1. Update Order
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          exFactoryDate: newExFactoryDate,
          version: { increment: 1 },
        },
      });

      // 2. Adjust milestones planned dates
      for (const ms of updatedMilestoneDates) {
        await tx.tnaMilestone.updateMany({
          where: { orderId, stage: ms.stage },
          data: {
            plannedStart: ms.plannedStart,
            plannedEnd: ms.plannedEnd,
            bufferDaysAhead: ms.bufferDaysAhead,
          },
        });
      }

      // 3. Fetch latest audit hash for tamper-evident chaining
      const lastAudit = await tx.auditEvent.findFirst({
        where: { entityType: 'Order', entityId: orderId },
        orderBy: { timestamp: 'desc' },
      });

      const user = await tx.user.findUnique({ where: { id: userId } });
      const timestamp = new Date().toISOString();
      const auditHash = calculateAuditHash(
        lastAudit?.auditHash || null,
        orderId,
        'UPDATE_EX_FACTORY_DATE',
        reasonCode,
        timestamp,
        financialImpactRupees || null
      );

      // 4. Create immutable Audit Event
      await tx.auditEvent.create({
        data: {
          entityType: 'Order',
          entityId: orderId,
          orderId,
          action: 'UPDATE_EX_FACTORY_DATE',
          category: 'DATE_CHANGE',
          reasonCode: reasonCode.trim(),
          notes: notes?.trim() || null,
          previousValue: JSON.stringify({
            exFactoryDate: previousDate.toISOString(),
          }),
          newValue: JSON.stringify({
            exFactoryDate: newExFactoryDate.toISOString(),
            buyerNotificationDispatched: true,
          }),
          financialImpactRupees: financialImpactRupees || 0,
          currency: order.currency || 'INR',
          auditHash,
          userId,
          userRole: user?.role || Role.MERCHANDISER,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });

      // 5. Automated Buyer Notification Dispatch Log
      const notifHash = calculateAuditHash(
        auditHash,
        orderId,
        'BUYER_SCHEDULE_NOTIFICATION',
        reasonCode,
        new Date().toISOString(),
        null
      );

      await tx.auditEvent.create({
        data: {
          entityType: 'Order',
          entityId: orderId,
          orderId,
          action: 'BUYER_SCHEDULE_NOTIFICATION',
          category: 'DATE_CHANGE',
          reasonCode: 'AUTOMATED_DISPATCH',
          notes: `Automated schedule change notification dispatched to buyer ${order.buyer?.code || ''} (${order.buyer?.name || ''}). Revised Ex-Factory: ${newExFactoryDate.toISOString().split('T')[0]}.`,
          previousValue: null,
          newValue: JSON.stringify({
            buyerId: order.buyerId,
            buyerCode: order.buyer?.code,
            recipientEmail: `merchandising@${order.buyer?.code?.toLowerCase() || 'buyer'}.global`,
            deliveryDate: newExFactoryDate.toISOString().split('T')[0],
            status: 'SENT',
          }),
          financialImpactRupees: 0,
          currency: order.currency || 'INR',
          auditHash: notifHash,
          userId,
          userRole: Role.MERCHANDISER,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });

      return updatedOrder;
    });
  }

  /**
   * Bulk shifts ex-factory dates for multiple orders in an atomic transaction,
   * recalibrates milestones for each, and generates chained audit & buyer notification logs.
   */
  static async bulkShiftExFactoryDate(
    orderIds: string[],
    shiftDays: number | undefined,
    newDateStr: string | undefined,
    reasonCode: string,
    userId: string,
    notes?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    if (!reasonCode || !reasonCode.trim()) {
      throw new AppError('Reason code is mandatory for bulk ex-factory date revisions', 400);
    }

    if (!orderIds || orderIds.length === 0) {
      throw new AppError('At least one order must be selected for bulk date shift', 400);
    }

    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds }, deletedAt: null },
      include: { buyer: true },
    });

    if (orders.length === 0) {
      throw new AppError('None of the selected orders were found', 404);
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    return await prisma.$transaction(async (tx) => {
      const updatedOrders = [];

      for (const order of orders) {
        let newExFactoryDate: Date;
        if (shiftDays !== undefined && shiftDays > 0) {
          newExFactoryDate = addWorkingDays(order.exFactoryDate, shiftDays);
        } else if (newDateStr) {
          newExFactoryDate = new Date(newDateStr);
        } else {
          continue;
        }

        const previousDate = order.exFactoryDate;
        const updatedMilestoneDates = computeMilestoneDates(newExFactoryDate, order.orderDate);

        // Update Order
        const updated = await tx.order.update({
          where: { id: order.id },
          data: {
            exFactoryDate: newExFactoryDate,
            version: { increment: 1 },
          },
        });
        updatedOrders.push(updated);

        // Adjust milestones
        for (const ms of updatedMilestoneDates) {
          await tx.tnaMilestone.updateMany({
            where: { orderId: order.id, stage: ms.stage },
            data: {
              plannedStart: ms.plannedStart,
              plannedEnd: ms.plannedEnd,
              bufferDaysAhead: ms.bufferDaysAhead,
            },
          });
        }

        // Audit Hash
        const lastAudit = await tx.auditEvent.findFirst({
          where: { entityType: 'Order', entityId: order.id },
          orderBy: { timestamp: 'desc' },
        });

        const timestamp = new Date().toISOString();
        const auditHash = calculateAuditHash(
          lastAudit?.auditHash || null,
          order.id,
          'BULK_UPDATE_EX_FACTORY_DATE',
          reasonCode,
          timestamp,
          null
        );

        // Record Audit Event
        await tx.auditEvent.create({
          data: {
            entityType: 'Order',
            entityId: order.id,
            orderId: order.id,
            action: 'BULK_UPDATE_EX_FACTORY_DATE',
            category: 'DATE_CHANGE',
            reasonCode: reasonCode.trim(),
            notes: notes?.trim() || `Bulk schedule postponement applied across ${orders.length} export orders.`,
            previousValue: JSON.stringify({
              exFactoryDate: previousDate.toISOString(),
            }),
            newValue: JSON.stringify({
              exFactoryDate: newExFactoryDate.toISOString(),
              shiftDays: shiftDays || null,
              batchSize: orders.length,
              buyerNotificationDispatched: true,
            }),
            financialImpactRupees: 0,
            currency: order.currency || 'INR',
            auditHash,
            userId,
            userRole: user?.role || Role.MERCHANDISER,
            ipAddress: ipAddress || null,
            userAgent: userAgent || null,
          },
        });

        // Buyer Notification Log
        const notifHash = calculateAuditHash(
          auditHash,
          order.id,
          'BUYER_SCHEDULE_NOTIFICATION',
          reasonCode,
          new Date().toISOString(),
          null
        );

        await tx.auditEvent.create({
          data: {
            entityType: 'Order',
            entityId: order.id,
            orderId: order.id,
            action: 'BUYER_SCHEDULE_NOTIFICATION',
            category: 'DATE_CHANGE',
            reasonCode: 'AUTOMATED_DISPATCH',
            notes: `Automated schedule change notification dispatched to buyer ${order.buyer?.code || ''}. Revised Ex-Factory: ${newExFactoryDate.toISOString().split('T')[0]}.`,
            previousValue: null,
            newValue: JSON.stringify({
              buyerId: order.buyerId,
              buyerCode: order.buyer?.code,
              deliveryDate: newExFactoryDate.toISOString().split('T')[0],
              status: 'SENT',
            }),
            financialImpactRupees: 0,
            currency: order.currency || 'INR',
            auditHash: notifHash,
            userId,
            userRole: Role.MERCHANDISER,
            ipAddress: ipAddress || null,
            userAgent: userAgent || null,
          },
        });
      }

      return {
        updatedCount: updatedOrders.length,
        orderIds: updatedOrders.map((o) => o.id),
      };
    });
  }

  /**
   * Lists orders with sticky filter parameters (status, buyer, unit, shipWeek, search)
   * and multi-tenant buyer isolation.
   */
  static async listOrders(filters: OrderQueryFilters, user: AuthenticatedUser) {
    const whereClause: Prisma.OrderWhereInput = {
      deletedAt: null,
    };

    // Multi-tenant buyer restriction
    if (user.role === Role.BUYER) {
      if (!user.buyerId) {
        throw new AppError('Buyer account missing associated organization', 403);
      }
      whereClause.buyerId = user.buyerId;
    } else if (filters.buyerId && filters.buyerId !== 'ALL') {
      whereClause.buyerId = filters.buyerId;
    }

    if (filters.unitId && filters.unitId !== 'ALL') {
      whereClause.unitId = filters.unitId;
    }

    if (filters.search) {
      const term = filters.search.trim();
      whereClause.OR = [
        { poNumber: { contains: term, mode: 'insensitive' } },
        { style: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        buyer: { select: { id: true, name: true, code: true, country: true } },
        unit: { select: { id: true, name: true, code: true, type: true } },
        orderLines: {
          select: { id: true, size: true, color: true, plannedQty: true, completedQty: true },
        },
        milestones: {
          select: {
            id: true,
            stage: true,
            sequenceOrder: true,
            plannedStart: true,
            plannedEnd: true,
            bufferDaysAhead: true,
            targetQuantity: true,
            completedQuantity: true,
          },
          orderBy: { sequenceOrder: 'asc' },
        },
        riskWarnings: {
          select: { id: true, riskLevel: true, requiredDailyRate: true, actualRollingRate: true, daysLate: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { exFactoryDate: 'asc' },
    });

    // Simulated Anchor: 2026-11-02
    const ANCHOR_DATE = new Date('2026-11-02T10:00:00Z');

    const mapped = orders.map((order) => {
      const totalPlanned = order.orderLines.reduce((acc, l) => acc + l.plannedQty, 0);
      const totalCompleted = order.orderLines.reduce((acc, l) => acc + l.completedQty, 0);
      const overallCompletionPct = totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0;

      // Active Stage
      const activeMilestone =
        order.milestones.find((m) => m.completedQuantity < m.targetQuantity) ||
        order.milestones[order.milestones.length - 1];

      // Buffer compression calculation
      let bufferCompressionDays = 0;
      if (
        activeMilestone &&
        ANCHOR_DATE > new Date(activeMilestone.plannedEnd) &&
        activeMilestone.completedQuantity < activeMilestone.targetQuantity
      ) {
        let count = 0;
        const scan = new Date(activeMilestone.plannedEnd);
        while (scan < ANCHOR_DATE) {
          scan.setDate(scan.getDate() + 1);
          if (scan.getDay() !== 0) count++;
        }
        bufferCompressionDays = count;
      }

      // Ship Week
      const shipWeek = getIsoWeekNumber(order.exFactoryDate);

      // Working days left (excl. Sundays) from simulated anchor
      let workingDaysLeft = 0;
      const cur = new Date(ANCHOR_DATE);
      const exFac = new Date(order.exFactoryDate);
      if (exFac > cur) {
        while (cur < exFac) {
          cur.setDate(cur.getDate() + 1);
          if (cur.getDay() !== 0) workingDaysLeft++;
        }
      } else {
        workingDaysLeft = 0;
      }

      // Health status based on final finishing milestone completion, risk warnings, or buffer compression
      const latestWarning = order.riskWarnings[0];
      const finalMilestone =
        order.milestones.find((m) => m.stage === 'FINISHING') ||
        order.milestones[order.milestones.length - 1];
      const isCompleted = Boolean(
        finalMilestone && finalMilestone.completedQuantity >= finalMilestone.targetQuantity
      );

      let healthStatus: 'GREEN' | 'AMBER' | 'RED' | 'COMPLETED' = 'GREEN';
      if (isCompleted) {
        healthStatus = 'COMPLETED';
      } else if (latestWarning) {
        healthStatus = latestWarning.riskLevel as any;
      } else if (bufferCompressionDays >= 3 || (workingDaysLeft <= 5 && overallCompletionPct < 80)) {
        healthStatus = 'RED';
      } else if (bufferCompressionDays > 0 || (workingDaysLeft <= 10 && overallCompletionPct < 50)) {
        healthStatus = 'AMBER';
      }

      return {
        id: order.id,
        poNumber: order.poNumber,
        style: order.style,
        description: order.description,
        totalQuantity: order.totalQuantity,
        currency: order.currency,
        exchangeRate: order.exchangeRate,
        fobPricePerPiece: order.fobPricePerPiece,
        totalOrderValue: order.totalOrderValue,
        exFactoryDate: order.exFactoryDate,
        orderDate: order.orderDate,
        status: order.status,
        shipWeek,
        workingDaysLeft,
        buyer: order.buyer,
        unit: order.unit,
        activeStage: activeMilestone?.stage || 'FINISHING',
        activeStageSequence: activeMilestone?.sequenceOrder || 7,
        activeStageProgressPct: activeMilestone && activeMilestone.targetQuantity > 0
          ? Math.min(100, Math.round((activeMilestone.completedQuantity / activeMilestone.targetQuantity) * 100))
          : 0,
        activeMilestoneCompleted: activeMilestone?.completedQuantity || 0,
        activeMilestoneTarget: activeMilestone?.targetQuantity || order.totalQuantity,
        overallCompletionPct,
        totalPlanned,
        totalCompleted,
        healthStatus,
        hasCriticalBottleneck: bufferCompressionDays > 0,
        bufferCompressionDays,
        riskWarning: latestWarning || null,
        orderLines: order.orderLines,
        milestones: order.milestones,
      };
    });

    // Sort: active orders first, completed orders pushed down to the very bottom
    mapped.sort((a, b) => {
      const aCompleted = a.healthStatus === 'COMPLETED';
      const bCompleted = b.healthStatus === 'COMPLETED';
      if (aCompleted && !bCompleted) return 1;
      if (!aCompleted && bCompleted) return -1;
      return new Date(a.exFactoryDate).getTime() - new Date(b.exFactoryDate).getTime();
    });

    // Filter by shipWeek if requested
    let filtered = mapped;
    if (filters.status && filters.status !== 'ALL') {
      filtered = filtered.filter((o) => o.healthStatus === filters.status);
    }

    if (filters.shipWeek && filters.shipWeek !== 'ALL') {
      filtered = filtered.filter((o) => o.shipWeek.toString() === filters.shipWeek);
    }

    // Pagination calculations
    const page = Math.max(1, parseInt(filters.page || '1', 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(filters.limit || '10', 10) || 10));
    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const paginatedOrders = filtered.slice((page - 1) * limit, page * limit);

    return {
      orders: paginatedOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Retrieves full details of an order including size ratio skew calculations,
   * 7-stage TNA milestone pipeline, and audit event history.
   */
  static async getOrderById(orderId: string, user: AuthenticatedUser) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: true,
        unit: true,
        orderLines: {
          orderBy: [{ size: 'asc' }, { color: 'asc' }],
        },
        milestones: {
          include: { unit: true },
          orderBy: { sequenceOrder: 'asc' },
        },
        auditEvents: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
          orderBy: { timestamp: 'desc' },
        },
        productionUpdates: {
          include: {
            supervisor: { select: { id: true, name: true, email: true, role: true } },
            photos: true,
            issueClassification: true,
            sizeBreakdownLines: {
              include: { orderLine: true },
            },
          },
          orderBy: { clientEventAt: 'desc' },
        },
        riskWarnings: {
          include: {
            mitigationActions: {
              include: {
                authorizedBy: { select: { id: true, name: true, email: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new AppError(`Order #${orderId} does not exist`, 404);
    }

    // Multi-tenant buyer restriction
    if (user.role === Role.BUYER && user.buyerId !== order.buyerId) {
      throw new AppError('Forbidden: Access to this order is restricted', 403);
    }

    // Size Breakdown & Ratio Skew Calculation (Anti-99% Done Trap)
    const totalPlanned = order.orderLines.reduce((acc, l) => acc + l.plannedQty, 0);
    const totalCompleted = order.orderLines.reduce((acc, l) => acc + l.completedQty, 0);
    const masterRate = totalPlanned > 0 ? (totalCompleted / totalPlanned) * 100 : 0;

    let hasSkewWarning = false;
    const sizeProgress = order.orderLines.map((line) => {
      const lineRate = line.plannedQty > 0 ? (line.completedQty / line.plannedQty) * 100 : 0;
      // If individual size lags > 20% behind the master rate
      const lagDeficit = masterRate - lineRate;
      const isSkewed = masterRate >= 20 && lagDeficit >= 20;
      if (isSkewed) hasSkewWarning = true;

      return {
        id: line.id,
        size: line.size,
        color: line.color,
        plannedQty: line.plannedQty,
        completedQty: line.completedQty,
        remainingQty: Math.max(0, line.plannedQty - line.completedQty),
        completionPct: Math.round(lineRate),
        isSkewed,
        lagDeficit: Math.round(lagDeficit),
      };
    });

    // Simulated Anchor: 2026-11-02
    const ANCHOR_DATE = new Date('2026-11-02T10:00:00Z');
    let workingDaysLeft = 0;
    const cur = new Date(ANCHOR_DATE);
    const exFac = new Date(order.exFactoryDate);
    if (exFac > cur) {
      while (cur < exFac) {
        cur.setDate(cur.getDate() + 1);
        if (cur.getDay() !== 0) workingDaysLeft++;
      }
    }

    const shipWeek = getIsoWeekNumber(order.exFactoryDate);
    const latestRisk = order.riskWarnings[0] || null;

    let healthStatus: 'GREEN' | 'AMBER' | 'RED' = 'GREEN';
    if (latestRisk) {
      healthStatus = latestRisk.riskLevel;
    } else if (workingDaysLeft <= 5 && masterRate < 80) {
      healthStatus = 'RED';
    } else if (workingDaysLeft <= 10 && masterRate < 50) {
      healthStatus = 'AMBER';
    }

    const activeMilestone =
      order.milestones.find((m) => m.completedQuantity < m.targetQuantity) ||
      order.milestones[order.milestones.length - 1];

    const activeStageProgressPct = activeMilestone && activeMilestone.targetQuantity > 0
      ? Math.min(100, Math.round((activeMilestone.completedQuantity / activeMilestone.targetQuantity) * 100))
      : 0;

    // Critical Path & Buffer Compression Analysis
    let criticalPathAlert: {
      stage: Stage;
      stageDisplayName: string;
      bufferCompressionDays: number;
      message: string;
      downstreamRisk: string;
    } | null = null;

    const milestonesWithBufferInfo = order.milestones.map((ms) => {
      let bufferCompressionDays = 0;
      const plannedEndDate = new Date(ms.plannedEnd);
      if (ANCHOR_DATE > plannedEndDate && ms.completedQuantity < ms.targetQuantity) {
        let count = 0;
        const scan = new Date(plannedEndDate);
        while (scan < ANCHOR_DATE) {
          scan.setDate(scan.getDate() + 1);
          if (scan.getDay() !== 0) count++;
        }
        bufferCompressionDays = count;
      }

      const isCritical = bufferCompressionDays > 0;
      if (isCritical && !criticalPathAlert) {
        criticalPathAlert = {
          stage: ms.stage,
          stageDisplayName: ms.stage.replace(/_/g, ' & '),
          bufferCompressionDays,
          message: `${ms.stage.replace(/_/g, ' & ')} has overrun planned completion by ${bufferCompressionDays} working days.`,
          downstreamRisk: `Consuming downstream Assembly & Finishing safety buffers. Immediate run-rate elevation needed to prevent ex-factory postponement.`,
        };
      }

      return {
        ...ms,
        isCriticalPathBottleneck: isCritical,
        bufferCompressionDays,
      };
    });

    // Size Skew Floor Rebalance Recommendation
    let sizeSkewRecommendation: {
      laggedSize: string;
      laggedColor: string;
      advancedSize: string;
      lagDeficit: number;
      remainingQty: number;
      directive: string;
    } | null = null;

    if (hasSkewWarning) {
      const skewedItems = [...sizeProgress].filter((s) => s.isSkewed).sort((a, b) => b.lagDeficit - a.lagDeficit);
      const topCompleted = [...sizeProgress].sort((a, b) => b.completionPct - a.completionPct)[0];
      if (skewedItems.length > 0 && topCompleted) {
        const lagged = skewedItems[0];
        sizeSkewRecommendation = {
          laggedSize: lagged.size,
          laggedColor: lagged.color,
          advancedSize: topCompleted.size,
          lagDeficit: lagged.lagDeficit,
          remainingQty: lagged.remainingQty,
          directive: `Floor Directive: Prioritize cut-bundle issuance and sewing line loading for Size ${lagged.size} (${lagged.color}). It is lagging ${lagged.lagDeficit}% behind Size ${topCompleted.size}. Clear ${lagged.remainingQty.toLocaleString()} pcs remaining to prevent packing starvation.`,
        };
      }
    }

    return {
      ...order,
      milestones: milestonesWithBufferInfo,
      shipWeek,
      workingDaysLeft,
      healthStatus,
      activeStage: activeMilestone?.stage || 'FINISHING',
      activeStageSequence: activeMilestone?.sequenceOrder || 7,
      activeStageProgressPct,
      activeMilestoneCompleted: activeMilestone?.completedQuantity || 0,
      activeMilestoneTarget: activeMilestone?.targetQuantity || order.totalQuantity,
      overallCompletionPct: Math.round(masterRate),
      totalPlanned,
      totalCompleted,
      hasSkewWarning,
      sizeProgress,
      latestRiskWarning: latestRisk,
      criticalPathAlert,
      sizeSkewRecommendation,
    };
  }

  /**
   * Returns master options for buyers and units to populate UI forms.
   */
  static async getMasterData(user: AuthenticatedUser) {
    const buyerWhere: Prisma.BuyerWhereInput = {};
    if (user.role === Role.BUYER && user.buyerId) {
      buyerWhere.id = user.buyerId;
    }

    const [buyers, units] = await Promise.all([
      prisma.buyer.findMany({
        where: buyerWhere,
        select: { id: true, name: true, code: true, country: true },
        orderBy: { name: 'asc' },
      }),
      prisma.unit.findMany({
        select: { id: true, name: true, code: true, type: true, location: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return { buyers, units };
  }

  /**
   * Manually advances an order to the next milestone stage.
   * If actual output differs from target, optionally adjusts all downstream stage targets
   * so total becomes the amount completed (e.g., short-shipment waiver / partial advance).
   */
  static async advanceStage(
    orderId: string,
    input: AdvanceStageInput,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        milestones: { orderBy: { sequenceOrder: 'asc' } },
        buyer: true,
      },
    });

    if (!order) throw new AppError('Order not found', 404);

    const currentMilestoneIndex = order.milestones.findIndex(
      (m) => m.stage === (input.fromStage as Stage)
    );

    if (currentMilestoneIndex === -1) {
      throw new AppError(`Stage ${input.fromStage} not found in order milestones`, 400);
    }

    const currentMilestone = order.milestones[currentMilestoneIndex];
    const nextMilestone = order.milestones[currentMilestoneIndex + 1];

    if (!nextMilestone) {
      throw new AppError(`Stage ${input.fromStage} is the final milestone in this pipeline.`, 400);
    }

    const actualCompleted = input.completedQuantity !== undefined
      ? input.completedQuantity
      : currentMilestone.completedQuantity;

    const previousLastAudit = await prisma.auditEvent.findFirst({
      where: { orderId: order.id },
      orderBy: { timestamp: 'desc' },
    });
    const previousHash = previousLastAudit?.auditHash || 'GENESIS_HASH_STAGE_ADVANCE';

    return await prisma.$transaction(async (tx) => {
      // 1. Mark current milestone completed at actualCompleted
      await tx.tnaMilestone.update({
        where: { id: currentMilestone.id },
        data: {
          completedQuantity: actualCompleted,
          targetQuantity: input.adjustDownstreamTargets ? actualCompleted : currentMilestone.targetQuantity,
        },
      });

      // 2. If adjustDownstreamTargets is true, cascade actualCompleted to all downstream milestones
      if (input.adjustDownstreamTargets && actualCompleted > 0) {
        for (let i = currentMilestoneIndex + 1; i < order.milestones.length; i++) {
          const downstream = order.milestones[i];
          await tx.tnaMilestone.update({
            where: { id: downstream.id },
            data: {
              targetQuantity: actualCompleted,
              completedQuantity: Math.min(downstream.completedQuantity, actualCompleted),
            },
          });
        }
        // Update order total quantity to match new downstream capacity
        await tx.order.update({
          where: { id: order.id },
          data: {
            totalQuantity: actualCompleted,
          },
        });
      }

      // 3. Record Audit Event
      const auditHash = calculateAuditHash(
        previousHash,
        order.id,
        'MANUAL_STAGE_ADVANCE_OVERRIDE',
        input.reasonCode,
        new Date().toISOString(),
        0
      );

      await tx.auditEvent.create({
        data: {
          entityType: 'Order',
          entityId: order.id,
          orderId: order.id,
          action: 'MANUAL_STAGE_ADVANCE_OVERRIDE',
          category: 'STAGE_OUTPUT',
          reasonCode: input.reasonCode.trim(),
          notes: input.overrideNotes?.trim() || `Manually advanced milestone from ${input.fromStage} to ${nextMilestone.stage} with ${actualCompleted} pcs completed. Downstream targets adjusted: ${input.adjustDownstreamTargets}.`,
          previousValue: JSON.stringify({
            stage: input.fromStage,
            completedQuantity: currentMilestone.completedQuantity,
            targetQuantity: currentMilestone.targetQuantity,
          }),
          newValue: JSON.stringify({
            stage: nextMilestone.stage,
            completedQuantity: actualCompleted,
            targetQuantity: input.adjustDownstreamTargets ? actualCompleted : currentMilestone.targetQuantity,
            downstreamTargetsAdjusted: input.adjustDownstreamTargets,
          }),
          financialImpactRupees: 0,
          currency: order.currency || 'INR',
          auditHash,
          userId,
          userRole: user.role,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });

      return {
        success: true,
        fromStage: input.fromStage,
        nextStage: nextMilestone.stage,
        actualCompleted,
        adjustDownstreamTargets: input.adjustDownstreamTargets,
      };
    });
  }
}
