import { prisma } from '../../config/db';
import { Role, RiskLevel, Stage } from '@prisma/client';
import { AppError } from '../../common/errors/AppError';
import { AuthenticatedUser } from '../../common/types/express';
import {
  evaluateProductionRisk,
  calculateWorkingDaysExcludingSundays,
  RiskEngineInput,
  RiskEvaluationResult,
} from './risk.engine';

export interface RiskFilterQuery {
  riskLevel?: RiskLevel | 'ALL' | 'COMPLETED';
  buyerId?: string;
  unitId?: string;
  stage?: Stage | 'ALL';
  search?: string;
}

export class RiskService {
  /**
   * Evaluates and updates risk warning records across active production milestones.
   */
  static async evaluateOrderMilestoneRisk(
    orderId: string,
    milestoneId: string,
    user: AuthenticatedUser
  ): Promise<RiskEvaluationResult> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: true,
        unit: true,
        milestones: { where: { id: milestoneId } },
        productionUpdates: {
          where: { milestoneId },
          orderBy: { clientEventAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!order) {
      throw new AppError(`Order #${orderId} was not found`, 404);
    }

    // Buyer scoping check
    if (user.role === Role.BUYER && user.buyerId !== order.buyerId) {
      throw new AppError('Forbidden: Access to this order is restricted', 403);
    }

    const milestone = order.milestones[0];
    if (!milestone) {
      throw new AppError(`Milestone #${milestoneId} was not found for this order`, 404);
    }

    // Map production updates to daily logs for WMA
    const dailyLogs = order.productionUpdates.map((u) => ({
      date: u.clientEventAt,
      quantity: u.goodQuantity,
    }));

    const riskInput: RiskEngineInput = {
      orderId: order.id,
      milestoneId: milestone.id,
      stage: milestone.stage,
      targetQuantity: milestone.targetQuantity,
      completedQuantity: milestone.completedQuantity,
      exFactoryDate: order.exFactoryDate,
      plannedStageStart: milestone.plannedStart,
      plannedStageEnd: milestone.plannedEnd,
      dailyLogs,
      fobPricePerPiece: order.fobPricePerPiece || undefined,
      exchangeRate: order.exchangeRate || 100,
      currency: order.currency,
      simulatedToday: new Date('2026-11-02T10:00:00Z'),
    };

    const evaluation = evaluateProductionRisk(riskInput);

    // Persist or update RiskWarning table
    const existing = await prisma.riskWarning.findFirst({
      where: { orderId: order.id, milestoneId: milestone.id },
    });

    const dataToSave = {
      riskLevel: evaluation.riskLevel,
      requiredDailyRate: evaluation.requiredDailyRate,
      actualRollingRate: evaluation.actualRollingRate,
      varianceQtyPerDay: evaluation.varianceQtyPerDay,
      projectedCompletionDate: evaluation.projectedCompletionDate,
      daysLate: evaluation.daysLate,
      financialExposureRupees: evaluation.financialExposureRupees,
      mathBreakdown: JSON.stringify(evaluation.mathBreakdown),
      isBuyerVisible: evaluation.riskLevel !== RiskLevel.GREEN,
    };

    if (existing) {
      await prisma.riskWarning.update({
        where: { id: existing.id },
        data: dataToSave,
      });
    } else {
      await prisma.riskWarning.create({
        data: {
          orderId: order.id,
          milestoneId: milestone.id,
          ...dataToSave,
        },
      });
    }

    return evaluation;
  }

  /**
   * Retrieves all active risk assessments across manufacturing units with filters
   * and multi-tenant buyer scoping.
   */
  static async listActiveRisks(filters: RiskFilterQuery, user: AuthenticatedUser) {
    const whereClause: any = {
      deletedAt: null,
      status: 'ACTIVE',
    };

    // Multi-tenant buyer restriction
    if (user.role === Role.BUYER) {
      if (!user.buyerId) {
        throw new AppError('Buyer account missing organization association', 403);
      }
      whereClause.buyerId = user.buyerId;
    } else if (filters.buyerId && filters.buyerId !== 'ALL') {
      whereClause.buyerId = filters.buyerId;
    }

    if (filters.unitId && filters.unitId !== 'ALL') {
      whereClause.unitId = filters.unitId;
    }

    if (filters.search?.trim()) {
      const term = filters.search.trim();
      whereClause.OR = [
        { poNumber: { contains: term, mode: 'insensitive' } },
        { style: { contains: term, mode: 'insensitive' } },
      ];
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        buyer: { select: { id: true, name: true, code: true } },
        unit: { select: { id: true, name: true, code: true, type: true } },
        milestones: {
          orderBy: { sequenceOrder: 'asc' },
        },
        riskWarnings: {
          orderBy: { createdAt: 'desc' },
          include: {
            milestone: { select: { id: true, stage: true, sequenceOrder: true, bufferDaysAhead: true } },
          },
        },
        productionUpdates: {
          orderBy: { clientEventAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { exFactoryDate: 'asc' },
    });

    const simulatedToday = new Date('2026-11-02T10:00:00Z');

    // Run real-time deterministic risk evaluation for each order's active milestone
    const evaluatedRisks = orders.map((order) => {
      const activeMilestone =
        order.milestones.find((m) => m.completedQuantity < m.targetQuantity) ||
        order.milestones[order.milestones.length - 1];

      // Relevant logs for active stage
      const relevantLogs = order.productionUpdates
        .filter((u) => u.milestoneId === activeMilestone?.id)
        .map((u) => ({ date: u.clientEventAt, quantity: u.goodQuantity }));

      // Fallback: if no active stage logs, use recent logs
      const logsToUse =
        relevantLogs.length > 0
          ? relevantLogs
          : order.productionUpdates.map((u) => ({
              date: u.clientEventAt,
              quantity: u.goodQuantity,
            }));

      const evaluation = evaluateProductionRisk({
        orderId: order.id,
        milestoneId: activeMilestone?.id || '',
        stage: activeMilestone?.stage || Stage.FINISHING,
        targetQuantity: activeMilestone?.targetQuantity || order.totalQuantity,
        completedQuantity: activeMilestone?.completedQuantity || 0,
        exFactoryDate: order.exFactoryDate,
        plannedStageStart: activeMilestone?.plannedStart || order.orderDate,
        plannedStageEnd: activeMilestone?.plannedEnd || order.exFactoryDate,
        dailyLogs: logsToUse,
        simulatedToday,
        fobPricePerPiece: order.fobPricePerPiece || undefined,
        exchangeRate: order.exchangeRate || 100,
        currency: order.currency,
      });

      return {
        id: order.id,
        orderId: order.id,
        poNumber: order.poNumber,
        style: order.style,
        buyer: order.buyer,
        unit: order.unit,
        exFactoryDate: order.exFactoryDate,
        workingDaysLeft: calculateWorkingDaysExcludingSundays(simulatedToday, order.exFactoryDate),
        totalQuantity: order.totalQuantity,
        activeStage: activeMilestone?.stage || Stage.FINISHING,
        activeStageSequence: activeMilestone?.sequenceOrder || 7,
        activeMilestoneId: activeMilestone?.id,
        riskLevel: evaluation.riskLevel,
        isCompleted:
          order.status === 'COMPLETED' ||
          evaluation.isCompleted ||
          (evaluation.mathBreakdown?.remainingPieces === 0) ||
          evaluation.requiredDailyRate === 0 ||
          order.milestones.every((m) => m.completedQuantity >= m.targetQuantity),
        requiredDailyRate: evaluation.requiredDailyRate,
        actualRollingRate: evaluation.actualRollingRate,
        varianceQtyPerDay: evaluation.varianceQtyPerDay,
        differencePill: evaluation.differencePill,
        workingDaysNeeded: evaluation.workingDaysNeeded,
        projectedCompletionDate: evaluation.projectedCompletionDate,
        daysLate: evaluation.daysLate,
        financialExposureRupees: evaluation.financialExposureRupees,
        mathBreakdown: evaluation.mathBreakdown,
        rulesTriggered: evaluation.rulesTriggered,
      };
    });

    // Exclude completed orders completely from Risk & Delays
    const activeEvaluatedRisks = evaluatedRisks.filter((r) => !r.isCompleted);

    // Problematic active orders first: sorted ascending by varianceQtyPerDay (actualRollingRate - requiredDailyRate)
    // so the most severely negative variance appears at the top.
    activeEvaluatedRisks.sort((a, b) => {
      if (a.varianceQtyPerDay !== b.varianceQtyPerDay) {
        return a.varianceQtyPerDay - b.varianceQtyPerDay;
      }
      return b.financialExposureRupees - a.financialExposureRupees;
    });

    // Filter by riskLevel if requested
    let filtered = activeEvaluatedRisks;
    if (filters.riskLevel && filters.riskLevel !== 'ALL') {
      filtered = filtered.filter((r) => r.riskLevel === filters.riskLevel);
    }

    if (filters.stage && filters.stage !== 'ALL') {
      filtered = filtered.filter((r) => r.activeStage === filters.stage);
    }

    // High-level summary metrics for active monitored orders
    const summary = {
      totalMonitoredOrders: activeEvaluatedRisks.length,
      redCount: activeEvaluatedRisks.filter((r) => r.riskLevel === RiskLevel.RED).length,
      amberCount: activeEvaluatedRisks.filter((r) => r.riskLevel === RiskLevel.AMBER).length,
      greenCount: activeEvaluatedRisks.filter((r) => r.riskLevel === RiskLevel.GREEN).length,
      completedCount: 0,
      totalExposureRupees: activeEvaluatedRisks.reduce((sum, r) => sum + r.financialExposureRupees, 0),
    };

    return {
      summary,
      risks: filtered,
    };
  }

  /**
   * Real-time "What-If" rate simulator.
   * Calculates new projected completion date, days late, and resulting risk status
   * when a user adjusts line capacity / target pace slider.
   */
  static simulateRateAdjustment(
    remainingPieces: number,
    simulatedRate: number,
    workingDaysToShip: number,
    downstreamBufferDays: number,
    plannedStageEnd: Date | string,
    simulatedToday: Date | string = '2026-11-02T10:00:00Z'
  ) {
    const today = new Date(simulatedToday);
    const stageEnd = new Date(plannedStageEnd);

    const effectiveWorkingDays = Math.max(1, workingDaysToShip - downstreamBufferDays);
    const requiredDailyRate =
      remainingPieces > 0 ? Math.ceil(remainingPieces / effectiveWorkingDays) : 0;

    const rate = Math.max(1, Math.round(simulatedRate));
    const workingDaysNeeded = Math.min(60, Math.ceil(remainingPieces / rate));

    let count = 0;
    const projected = new Date(today);
    while (count < workingDaysNeeded) {
      projected.setDate(projected.getDate() + 1);
      if (projected.getDay() !== 0) count++;
    }

    let daysLate = 0;
    if (workingDaysNeeded > effectiveWorkingDays) {
      daysLate = workingDaysNeeded - effectiveWorkingDays;
    }

    const variance = rate - requiredDailyRate;
    const bufferRemaining = workingDaysToShip - downstreamBufferDays;

    let simulatedRisk: RiskLevel = RiskLevel.GREEN;
    let exposure = 0;
    if (daysLate > 0 || bufferRemaining < 0) {
      simulatedRisk = RiskLevel.RED;
      exposure = 350000;
    } else if (bufferRemaining < 2 || variance < 0) {
      simulatedRisk = RiskLevel.AMBER;
      exposure = 105000;
    } else {
      simulatedRisk = RiskLevel.GREEN;
      exposure = 0;
    }

    return {
      simulatedRate: rate,
      requiredDailyRate,
      variance,
      workingDaysNeeded,
      projectedCompletionDate: projected,
      daysLate,
      simulatedRisk,
      financialExposureRupees: exposure,
    };
  }
}
