import { prisma } from '../../config/db';
import { Role, RiskLevel, Stage, ApprovalStatus, AuditCategory } from '@prisma/client';
import { AppError } from '../../common/errors/AppError';
import { AuthenticatedUser } from '../../common/types/express';
import { calculateAuditHash } from '../../common/utils/crypto';
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

    const isConfirmed = existing?.approvalStatus === ApprovalStatus.CONFIRMED;
    const isOverridden = existing?.approvalStatus === ApprovalStatus.OVERRIDDEN;

    const dataToSave = {
      riskLevel: evaluation.riskLevel,
      requiredDailyRate: evaluation.requiredDailyRate,
      actualRollingRate: evaluation.actualRollingRate,
      varianceQtyPerDay: evaluation.varianceQtyPerDay,
      projectedCompletionDate: evaluation.projectedCompletionDate,
      daysLate: evaluation.daysLate,
      financialExposureRupees: evaluation.financialExposureRupees,
      mathBreakdown: JSON.stringify(evaluation.mathBreakdown),
      // Raw panic is never buyer-visible without merchandiser confirmation
      isBuyerVisible: isConfirmed,
      approvalStatus: isConfirmed
        ? ApprovalStatus.CONFIRMED
        : isOverridden
        ? ApprovalStatus.OVERRIDDEN
        : ApprovalStatus.PENDING_REVIEW,
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

  /**
   * Feature 10: Human-in-the-Loop Review Gate
   * Retrieves alerts for merchandiser triage: Raw floor voice/text, AI classification,
   * risk metrics, and buyer-visibility approval status.
   */
  static async listAlerts(
    filters: {
      status?: 'PENDING_REVIEW' | 'CONFIRMED' | 'OVERRIDDEN' | 'ALL';
      orderId?: string;
      riskLevel?: RiskLevel;
    },
    user: AuthenticatedUser
  ) {
    const where: any = {
      order: {
        deletedAt: null,
        status: 'ACTIVE',
      },
    };

    // Buyer scoping: International buyers can ONLY see CONFIRMED + isBuyerVisible alerts
    if (user.role === Role.BUYER) {
      if (!user.buyerId) {
        throw new AppError('Buyer account missing organization association', 403);
      }
      where.order.buyerId = user.buyerId;
      where.isBuyerVisible = true;
      where.approvalStatus = ApprovalStatus.CONFIRMED;
    } else {
      // Merchandiser / Admin filtering
      if (filters.status && filters.status !== 'ALL') {
        where.approvalStatus = filters.status as ApprovalStatus;
      }
    }

    if (filters.orderId) {
      where.orderId = filters.orderId;
    }

    if (filters.riskLevel) {
      where.riskLevel = filters.riskLevel;
    }

    const warnings = await prisma.riskWarning.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            poNumber: true,
            style: true,
            totalQuantity: true,
            exFactoryDate: true,
            currency: true,
            fobPricePerPiece: true,
            exchangeRate: true,
            buyer: { select: { id: true, name: true, code: true } },
            unit: { select: { id: true, name: true, code: true } },
          },
        },
        milestone: {
          select: {
            id: true,
            stage: true,
            sequenceOrder: true,
            targetQuantity: true,
            completedQuantity: true,
            plannedStart: true,
            plannedEnd: true,
            bufferDaysAhead: true,
          },
        },
        mitigationActions: {
          orderBy: { createdAt: 'desc' },
          include: { authorizedBy: { select: { id: true, name: true } } },
        },
      },
      orderBy: [
        { riskLevel: 'desc' },
        { financialExposureRupees: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    // For each warning, attach latest relevant production update with raw Tamil voice/text and AI triage
    const alerts = await Promise.all(
      warnings.map(async (w) => {
        const update = await prisma.productionUpdate.findFirst({
          where: {
            orderId: w.orderId,
            milestoneId: w.milestoneId,
          },
          orderBy: { clientEventAt: 'desc' },
          include: {
            supervisor: { select: { id: true, name: true } },
            issueClassification: true,
          },
        });

        const reviewer = w.reviewedById
          ? await prisma.user.findUnique({
              where: { id: w.reviewedById },
              select: { id: true, name: true, email: true },
            })
          : null;

        return {
          id: w.id,
          orderId: w.orderId,
          milestoneId: w.milestoneId,
          poNumber: w.order.poNumber,
          style: w.order.style,
          totalQuantity: w.order.totalQuantity,
          exFactoryDate: w.order.exFactoryDate,
          currency: w.order.currency,
          buyer: w.order.buyer,
          unit: w.order.unit,
          stage: w.milestone.stage,
          sequenceOrder: w.milestone.sequenceOrder,
          targetQuantity: w.milestone.targetQuantity,
          completedQuantity: w.milestone.completedQuantity,
          riskLevel: w.riskLevel,
          requiredDailyRate: w.requiredDailyRate,
          actualRollingRate: w.actualRollingRate,
          varianceQtyPerDay: w.varianceQtyPerDay,
          projectedCompletionDate: w.projectedCompletionDate,
          daysLate: w.daysLate,
          financialExposureRupees: w.financialExposureRupees,
          approvalStatus: w.approvalStatus,
          isBuyerVisible: w.isBuyerVisible,
          mitigationPlan: w.mitigationPlan,
          reviewedAt: w.reviewedAt,
          reviewedBy: reviewer,
          mitigationActions: w.mitigationActions,
          createdAt: w.createdAt,
          updatedAt: w.updatedAt,
          // Floor context (Tamil voice/text & AI classification)
          floorIssue: update
            ? {
                productionUpdateId: update.id,
                shift: update.shift,
                machineLine: update.machineLine,
                supervisorName: update.supervisor?.name || 'Floor Supervisor',
                rawTamilText: update.issueClassification?.rawTamilText || update.notes || null,
                translatedText: update.issueClassification?.translatedText || update.notes || null,
                category: update.issueClassification?.category || 'OTHER',
                confidenceScore: update.issueClassification?.confidenceScore ?? 0.85,
                classifiedBy: update.issueClassification?.classifiedBy || 'AI',
                loggedAt: update.clientEventAt,
              }
            : null,
        };
      })
    );

    // Compute Executive Financial Summary
    const allActiveWarnings = await prisma.riskWarning.findMany({
      where: {
        order: { deletedAt: null, status: 'ACTIVE' },
      },
      select: {
        id: true,
        orderId: true,
        riskLevel: true,
        approvalStatus: true,
        financialExposureRupees: true,
      },
    });

    const pendingReviewWarnings = allActiveWarnings.filter(
      (w) => w.approvalStatus === ApprovalStatus.PENDING_REVIEW && (w.riskLevel === RiskLevel.RED || w.riskLevel === RiskLevel.AMBER)
    );
    const confirmedWarnings = allActiveWarnings.filter(
      (w) => w.approvalStatus === ApprovalStatus.CONFIRMED
    );
    const overriddenWarnings = allActiveWarnings.filter(
      (w) => w.approvalStatus === ApprovalStatus.OVERRIDDEN
    );

    const ordersAtRiskSet = new Set(
      allActiveWarnings
        .filter((w) => w.riskLevel === RiskLevel.RED || w.riskLevel === RiskLevel.AMBER)
        .map((w) => w.orderId)
    );

    const totalExposureRupees = allActiveWarnings
      .filter((w) => w.riskLevel === RiskLevel.RED || w.riskLevel === RiskLevel.AMBER)
      .reduce((sum, w) => sum + w.financialExposureRupees, 0);

    const summary = {
      totalAtRiskRupees: totalExposureRupees,
      ordersAtRiskCount: ordersAtRiskSet.size,
      totalPendingReview: pendingReviewWarnings.length,
      totalConfirmed: confirmedWarnings.length,
      totalOverridden: overriddenWarnings.length,
    };

    return {
      summary,
      alerts,
    };
  }

  /**
   * Merchandiser confirms alert for buyer visibility with an external mitigation note.
   */
  static async confirmAlert(
    alertId: string,
    payload: {
      mitigationPlan: string;
      actionType?: string;
      addedDailyCapacity?: number;
      estimatedCostRupees?: number;
    },
    user: AuthenticatedUser
  ) {
    if (!payload.mitigationPlan?.trim()) {
      throw new AppError('An external mitigation plan for buyer view is required to confirm this alert', 400);
    }

    const alert = await prisma.riskWarning.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      throw new AppError(`Alert #${alertId} not found`, 404);
    }

    const previousStatus = alert.approvalStatus;
    const previousVisibility = alert.isBuyerVisible;

    // Resolve valid user ID for foreign key constraint in mitigation actions & audit trail
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true },
    });
    const fallbackUser = dbUser || (await prisma.user.findFirst({ select: { id: true } }));
    const authorizedUserId = fallbackUser?.id || user.id;

    const updated = await prisma.$transaction(async (tx) => {
      const rw = await tx.riskWarning.update({
        where: { id: alertId },
        data: {
          approvalStatus: ApprovalStatus.CONFIRMED,
          isBuyerVisible: true,
          mitigationPlan: payload.mitigationPlan.trim(),
          reviewedById: authorizedUserId,
          reviewedAt: new Date(),
        },
      });

      if (payload.actionType && fallbackUser) {
        await tx.riskMitigationAction.create({
          data: {
            riskWarningId: alertId,
            actionType: payload.actionType,
            description: payload.mitigationPlan.trim(),
            addedDailyCapacity: payload.addedDailyCapacity || 0,
            estimatedCostRupees: payload.estimatedCostRupees || 0,
            authorizedById: authorizedUserId,
          },
        });
      }

      // Record tamper-evident SHA-256 audit event
      const latestAudit = await tx.auditEvent.findFirst({
        where: { entityId: alertId },
        orderBy: { timestamp: 'desc' },
      });

      const auditDate = new Date();
      const auditTimestamp = auditDate.toISOString();
      const auditHash = calculateAuditHash(
        latestAudit?.auditHash || null,
        alertId,
        'CONFIRM_RISK_WARNING',
        'MERCHANDISER_CONFIRMATION',
        auditTimestamp,
        payload.estimatedCostRupees || 0
      );

      await tx.auditEvent.create({
        data: {
          timestamp: auditDate,
          entityType: 'RiskWarning',
          entityId: alertId,
          action: 'CONFIRM_RISK_WARNING',
          category: AuditCategory.RISK_STATUS_CHANGE,
          reasonCode: 'MERCHANDISER_CONFIRMATION',
          notes: `Confirmed alert for buyer view with mitigation: "${payload.mitigationPlan.trim()}"`,
          previousValue: JSON.stringify({ approvalStatus: previousStatus, isBuyerVisible: previousVisibility }),
          newValue: JSON.stringify({ approvalStatus: 'CONFIRMED', isBuyerVisible: true, mitigationPlan: payload.mitigationPlan.trim() }),
          financialImpactRupees: payload.estimatedCostRupees || 0,
          currency: 'INR',
          auditHash,
          userId: user.id,
          userRole: user.role,
        },
      });

      return rw;
    });

    return updated;
  }

  /**
   * Merchandiser internally resolves / overrides alert without buyer escalation.
   */
  static async overrideAlert(
    alertId: string,
    payload: { resolutionReason: string },
    user: AuthenticatedUser
  ) {
    if (!payload.resolutionReason?.trim()) {
      throw new AppError('An internal resolution reason is required to override this alert', 400);
    }

    const alert = await prisma.riskWarning.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      throw new AppError(`Alert #${alertId} not found`, 404);
    }

    const previousStatus = alert.approvalStatus;
    const previousVisibility = alert.isBuyerVisible;

    const updated = await prisma.$transaction(async (tx) => {
      const rw = await tx.riskWarning.update({
        where: { id: alertId },
        data: {
          approvalStatus: ApprovalStatus.OVERRIDDEN,
          isBuyerVisible: false,
          mitigationPlan: payload.resolutionReason.trim(),
          reviewedById: user.id,
          reviewedAt: new Date(),
        },
      });

      const latestAudit = await tx.auditEvent.findFirst({
        where: { entityId: alertId },
        orderBy: { timestamp: 'desc' },
      });

      const auditDate = new Date();
      const auditTimestamp = auditDate.toISOString();
      const auditHash = calculateAuditHash(
        latestAudit?.auditHash || null,
        alertId,
        'OVERRIDE_RISK_WARNING',
        'INTERNAL_OVERRIDE',
        auditTimestamp,
        0
      );

      await tx.auditEvent.create({
        data: {
          timestamp: auditDate,
          entityType: 'RiskWarning',
          entityId: alertId,
          action: 'OVERRIDE_RISK_WARNING',
          category: AuditCategory.RISK_STATUS_CHANGE,
          reasonCode: 'INTERNAL_OVERRIDE',
          notes: `Internally overridden by merchandiser: "${payload.resolutionReason.trim()}" (Kept hidden from international buyer)`,
          previousValue: JSON.stringify({ approvalStatus: previousStatus, isBuyerVisible: previousVisibility }),
          newValue: JSON.stringify({ approvalStatus: 'OVERRIDDEN', isBuyerVisible: false, mitigationPlan: payload.resolutionReason.trim() }),
          financialImpactRupees: 0,
          currency: 'INR',
          auditHash,
          userId: user.id,
          userRole: user.role,
        },
      });

      return rw;
    });

    return updated;
  }

  /**
   * AI Copilot: Generates a courteous, professional buyer-ready mitigation draft from floor panic.
   */
  static async generateBuyerMitigationDraft(alertId: string) {
    const alert = await prisma.riskWarning.findUnique({
      where: { id: alertId },
      include: {
        order: { select: { poNumber: true, style: true, buyer: { select: { name: true } } } },
        milestone: { select: { stage: true } },
      },
    });

    if (!alert) {
      throw new AppError(`Alert #${alertId} not found`, 404);
    }

    const latestUpdate = await prisma.productionUpdate.findFirst({
      where: { orderId: alert.orderId, milestoneId: alert.milestoneId },
      orderBy: { clientEventAt: 'desc' },
      include: { issueClassification: true },
    });

    const stageName = alert.milestone.stage.replace(/_/g, ' ').toLowerCase();
    const cleanIssue = latestUpdate?.issueClassification?.translatedText || latestUpdate?.notes || 'a brief floor pacing variance';
    const variance = Math.abs(Math.round(alert.varianceQtyPerDay));
    const daysLate = alert.daysLate;

    let draftText = '';
    if (daysLate > 0) {
      draftText = `During operations in the ${stageName} stage, ${cleanIssue.toLowerCase()} created a temporary throughput variance of ~${variance.toLocaleString()} pcs/day. Our factory management has mobilized auxiliary line capacity and scheduled a 1.5-hour evening shift extension to recover the pace. We anticipate catching up within 48 hours and preserving the scheduled delivery date.`;
    } else {
      draftText = `A brief technical pause occurred in ${stageName} (${cleanIssue.toLowerCase()}). Our downstream buffer absorbs this adjustment with zero impact to the promised ex-factory shipment schedule.`;
    }

    return { draftText };
  }
}
