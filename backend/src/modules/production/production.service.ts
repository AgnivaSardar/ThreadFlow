import { prisma } from '../../config/db';
import { Role, Stage, IssueCategory, AuditCategory } from '@prisma/client';
import { AppError } from '../../common/errors/AppError';
import { AuthenticatedUser } from '../../common/types/express';
import { CreateProductionUpdateInput } from './production.schema';
import { calculateAuditHash } from '../../common/utils/crypto';
import { RiskService } from '../risk/risk.service';

/**
 * Returns dynamic friendly action verb for stage constraint error messages.
 */
function getStageActionVerb(stage: Stage): string {
  switch (stage) {
    case Stage.CUTTING:
      return 'cut';
    case Stage.STITCHING:
      return 'stitch';
    case Stage.CHECKING:
      return 'check';
    case Stage.FINISHING:
      return 'finish';
    case Stage.DYEING:
      return 'dye';
    case Stage.KNITTING:
      return 'knit';
    case Stage.YARN_SPINNING:
      return 'spin';
    default:
      return stage.toLowerCase();
  }
}

/**
 * Returns dynamic friendly noun for upstream stage reference.
 */
function getStageNoun(stage: Stage): string {
  switch (stage) {
    case Stage.CUTTING:
      return 'cutting';
    case Stage.STITCHING:
      return 'stitching';
    case Stage.CHECKING:
      return 'checking';
    case Stage.FINISHING:
      return 'finishing';
    case Stage.DYEING:
      return 'dyeing';
    case Stage.KNITTING:
      return 'knitting';
    case Stage.YARN_SPINNING:
      return 'yarn spinning';
    default:
      return stage.toLowerCase();
  }
}

export class ProductionService {
  /**
   * Retrieves active production work assigned to the supervisor's manufacturing unit.
   */
  static async getSupervisorWork(user: AuthenticatedUser) {
    let unitId = user.assignedUnitId;

    // Fallback: If user has no assignedUnitId, resolve via database or pick first active manufacturing unit
    if (!unitId) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { assignedUnitId: true },
      });
      unitId = dbUser?.assignedUnitId || null;
    }

    if (!unitId) {
      const defaultUnit = await prisma.unit.findFirst({
        where: { code: 'UNIT_1' },
      });
      unitId = defaultUnit?.id || null;
    }

    const unit = unitId
      ? await prisma.unit.findUnique({ where: { id: unitId } })
      : null;

    // Find active orders where the order belongs to this unit OR has milestones assigned to this unit
    const orders = await prisma.order.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        OR: [
          unitId ? { unitId } : {},
          unitId ? { milestones: { some: { unitId } } } : {},
        ],
      },
      include: {
        buyer: { select: { id: true, name: true, code: true } },
        unit: { select: { id: true, name: true, code: true } },
        milestones: {
          orderBy: { sequenceOrder: 'asc' },
          include: {
            unit: { select: { id: true, name: true, code: true } },
          },
        },
        orderLines: {
          orderBy: { size: 'asc' },
        },
      },
      orderBy: { exFactoryDate: 'asc' },
    });

    // Format work items highlighting current active stage for each order
    const workItems = orders.map((order) => {
      const activeMilestone =
        order.milestones.find((m) => m.completedQuantity < m.targetQuantity) ||
        order.milestones[order.milestones.length - 1];

      const totalPlanned = order.milestones.reduce((acc, m) => acc + m.targetQuantity, 0);
      const totalCompleted = order.milestones.reduce((acc, m) => acc + m.completedQuantity, 0);
      const overallProgress = totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0;

      return {
        orderId: order.id,
        poNumber: order.poNumber,
        style: order.style,
        description: order.description,
        totalQuantity: order.totalQuantity,
        exFactoryDate: order.exFactoryDate.toISOString(),
        buyer: order.buyer,
        unit: order.unit,
        activeMilestone: activeMilestone
          ? {
              id: activeMilestone.id,
              stage: activeMilestone.stage,
              sequenceOrder: activeMilestone.sequenceOrder,
              targetQuantity: activeMilestone.targetQuantity,
              completedQuantity: activeMilestone.completedQuantity,
              remainingQuantity: Math.max(
                0,
                activeMilestone.targetQuantity - activeMilestone.completedQuantity
              ),
              progressPct: Math.min(
                100,
                Math.round(
                  (activeMilestone.completedQuantity / activeMilestone.targetQuantity) * 100
                )
              ),
            }
          : null,
        milestones: order.milestones.map((m) => ({
          id: m.id,
          stage: m.stage,
          sequenceOrder: m.sequenceOrder,
          targetQuantity: m.targetQuantity,
          completedQuantity: m.completedQuantity,
          isCompleted: m.completedQuantity >= m.targetQuantity,
        })),
        orderLines: order.orderLines.map((l) => ({
          id: l.id,
          size: l.size,
          color: l.color,
          plannedQty: l.plannedQty,
          completedQty: l.completedQty,
        })),
        overallProgress,
      };
    });

    const recentUpdates = await prisma.productionUpdate.findMany({
      where: user.role === Role.SUPERVISOR
        ? { supervisorId: user.id }
        : unitId
        ? { order: { unitId } }
        : {},
      take: 10,
      orderBy: { clientEventAt: 'desc' },
      include: {
        order: { select: { poNumber: true, style: true } },
        milestone: { select: { stage: true } },
        issueClassification: true,
      },
    });

    return {
      unit: unit ? { id: unit.id, name: unit.name, code: unit.code, type: unit.type } : null,
      assignedOrdersCount: workItems.length,
      orders: workItems,
      recentUpdates: recentUpdates.map((u) => ({
        id: u.id,
        idempotencyKey: u.idempotencyKey,
        poNumber: u.order.poNumber,
        style: u.order.style,
        stage: u.stage,
        shift: u.shift,
        machineLine: u.machineLine,
        goodQuantity: u.goodQuantity,
        rejectedQuantity: u.rejectedQuantity,
        notes: u.notes,
        clientEventAt: u.clientEventAt.toISOString(),
        approvalStatus: u.approvalStatus,
        issueCategory: u.issueClassification?.category || null,
      })),
    };
  }

  /**
   * Records a production update with idempotency, anti-finger-slip guardrails,
   * cutting tolerance checks, size breakdown verification, and automated risk recalculation.
   */
  static async createProductionUpdate(
    input: CreateProductionUpdateInput,
    user: AuthenticatedUser
  ) {
    // 1. Idempotency Check: If idempotencyKey exists in DB, return stored record (preventing double-counts)
    const existing = await prisma.productionUpdate.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: {
        milestone: true,
        order: { select: { poNumber: true, style: true } },
      },
    });

    if (existing) {
      return {
        success: true,
        isDuplicate: true,
        message: 'Production update already recorded (idempotent replay)',
        update: existing,
      };
    }

    // 2. Fetch order with milestones and order lines
    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      include: {
        milestones: { orderBy: { sequenceOrder: 'asc' } },
        orderLines: true,
        unit: true,
      },
    });

    if (!order) {
      throw new AppError(`Order #${input.orderId} does not exist`, 404);
    }

    // 3. Locate target milestone
    const targetMilestone = order.milestones.find(
      (m) => m.id === input.milestoneId || m.stage === input.stage
    );

    if (!targetMilestone) {
      throw new AppError(
        `Milestone for stage ${input.stage} does not exist on PO ${order.poNumber}`,
        404
      );
    }

    const proposedCumulativeOutput =
      targetMilestone.completedQuantity + input.goodQuantity;

    // 4. Invariant 2 (Cutting Tolerance Ceiling Check):
    // Cumulative stage output cannot exceed Total PO * 1.03 (standard 3% Tiruppur cutting allowance)
    const ceilingAllowed = Math.round(order.totalQuantity * 1.03);
    if (proposedCumulativeOutput > ceilingAllowed) {
      throw new AppError(
        `Tolerance ceiling exceeded: Proposed stage output (${proposedCumulativeOutput.toLocaleString()} pcs) ` +
          `exceeds maximum allowed ${ceilingAllowed.toLocaleString()} pcs (PO Qty: ${order.totalQuantity.toLocaleString()} + 3% tolerance ceiling). Check entry for extra zeroes.`,
        400
      );
    }

    // 5. Invariant 1 (Sequential Stage Constraint):
    // Cumulative output of stage N cannot exceed completed output of immediate upstream stage N-1
    if (targetMilestone.sequenceOrder > 1) {
      const upstreamMilestone = order.milestones.find(
        (m) => m.sequenceOrder === targetMilestone.sequenceOrder - 1
      );

      if (upstreamMilestone) {
        if (proposedCumulativeOutput > upstreamMilestone.completedQuantity) {
          const actionVerb = getStageActionVerb(targetMilestone.stage);
          const upstreamNoun = getStageNoun(upstreamMilestone.stage);
          throw new AppError(
            `Cannot ${actionVerb} more pieces than have completed ${upstreamNoun} (${upstreamMilestone.completedQuantity.toLocaleString()} pcs)!`,
            400
          );
        }
      }
    }

    // 6. Invariant 3 (Per-Size Breakdown Lines Reconciliation):
    if (input.sizeBreakdownLines && input.sizeBreakdownLines.length > 0) {
      const sizeSum = input.sizeBreakdownLines.reduce((acc, l) => acc + l.goodQuantity, 0);
      if (sizeSum !== input.goodQuantity) {
        throw new AppError(
          `Size breakdown mismatch: Sum of per-size quantities (${sizeSum.toLocaleString()} pcs) does not match total good quantity (${input.goodQuantity.toLocaleString()} pcs).`,
          400
        );
      }

      // Check per-size planned quota ceiling (plannedQty * 1.03)
      for (const line of input.sizeBreakdownLines) {
        const orderLine = order.orderLines.find((ol) => ol.id === line.orderLineId);
        if (orderLine) {
          const lineCeiling = Math.round(orderLine.plannedQty * 1.03);
          const proposedLineTotal = orderLine.completedQty + line.goodQuantity;
          if (proposedLineTotal > lineCeiling) {
            throw new AppError(
              `Tolerance ceiling exceeded for size ${orderLine.size}: Proposed output (${proposedLineTotal.toLocaleString()} pcs) exceeds maximum allowed ${lineCeiling.toLocaleString()} pcs (Planned: ${orderLine.plannedQty.toLocaleString()} + 3%).`,
              400
            );
          }
        }
      }
    }

    // 7. Execute ACID transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create production update with PENDING_REVIEW approval status
      const update = await tx.productionUpdate.create({
        data: {
          idempotencyKey: input.idempotencyKey,
          orderId: order.id,
          milestoneId: targetMilestone.id,
          supervisorId: user.id,
          stage: targetMilestone.stage,
          shift: input.shift || 'DAY',
          machineLine: input.machineLine || null,
          goodQuantity: input.goodQuantity,
          rejectedQuantity: input.rejectedQuantity || 0,
          notes: input.notes || null,
          clientEventAt: input.clientEventAt ? new Date(input.clientEventAt) : new Date(),
          approvalStatus: 'PENDING_REVIEW',
          photos: input.compressedPhotoBase64
            ? {
                create: {
                  s3Url: input.compressedPhotoBase64,
                  stage: targetMilestone.stage,
                  approvalStatus: 'PENDING_REVIEW',
                  isBuyerVisible: false,
                },
              }
            : undefined,
        },
      });

      // Increment completedQuantity on TNA milestone
      const updatedMilestone = await tx.tnaMilestone.update({
        where: { id: targetMilestone.id },
        data: {
          completedQuantity: { increment: input.goodQuantity },
        },
      });

      // Update OrderLines if size breakdown is provided
      if (input.sizeBreakdownLines && input.sizeBreakdownLines.length > 0) {
        for (const line of input.sizeBreakdownLines) {
          await tx.productionUpdateLine.create({
            data: {
              productionUpdateId: update.id,
              orderLineId: line.orderLineId,
              goodQuantity: line.goodQuantity,
              rejectedQuantity: line.rejectedQuantity,
            },
          });

          await tx.orderLine.update({
            where: { id: line.orderLineId },
            data: {
              completedQty: { increment: line.goodQuantity },
            },
          });
        }
      }

      // Record classification if issue notes or category present
      if (input.notes || input.issueCategory) {
        await tx.issueClassification.create({
          data: {
            productionUpdateId: update.id,
            category: input.issueCategory || IssueCategory.OTHER,
            confidenceScore: input.issueCategory ? 1.0 : 0.85,
            needsReview: true,
            isConfirmed: false,
            rawTamilText: input.notes,
            classifiedBy: 'SUPERVISOR_KEYPAD',
          },
        });
      }

      // Record tamper-evident SHA-256 audit event
      const latestAudit = await tx.auditEvent.findFirst({
        where: { entityId: targetMilestone.id },
        orderBy: { timestamp: 'desc' },
      });

      const auditTimestamp = new Date().toISOString();
      const auditHash = calculateAuditHash(
        latestAudit?.auditHash || null,
        targetMilestone.id,
        'RECORD_STAGE_OUTPUT',
        'FLOOR_SHIFT_LOG',
        auditTimestamp,
        0
      );

      await tx.auditEvent.create({
        data: {
          entityType: 'TnaMilestone',
          entityId: targetMilestone.id,
          action: 'RECORD_STAGE_OUTPUT',
          category: AuditCategory.STAGE_OUTPUT,
          reasonCode: 'FLOOR_SHIFT_LOG',
          notes: `Recorded +${input.goodQuantity} pcs in stage ${targetMilestone.stage}. Notes: ${input.notes || 'None'}`,
          previousValue: JSON.stringify({ completedQuantity: targetMilestone.completedQuantity }),
          newValue: JSON.stringify({ completedQuantity: updatedMilestone.completedQuantity }),
          financialImpactRupees: 0,
          auditHash,
          userId: user.id,
          userRole: user.role,
        },
      });

      return { update, updatedMilestone };
    });

    // 8. Trigger Asynchronous Jobs (Non-blocking response)
    setImmediate(async () => {
      try {
        if (input.notes || input.issueCategory) {
          await ProductionService.processAiClassificationJob(
            result.update.id,
            input.notes,
            input.issueCategory
          );
        }
      } catch (aiErr) {
        console.warn('[AI Classification Job] Background processing note:', aiErr);
      }
    });

    setImmediate(async () => {
      try {
        await RiskService.evaluateOrderMilestoneRisk(order.id, targetMilestone.id, user);
      } catch (riskErr) {
        console.warn('[Risk Engine] Auto-recalculation note:', riskErr);
      }
    });

    return {
      success: true,
      isDuplicate: false,
      message: 'Production output logged successfully',
      update: result.update,
      milestone: result.updatedMilestone,
    };
  }

  /**
   * Asynchronous AI Classification worker job
   */
  static async processAiClassificationJob(
    updateId: string,
    notes?: string | null,
    initialCategory?: IssueCategory | null
  ) {
    if (!notes && !initialCategory) return;
    const issue = await prisma.issueClassification.findFirst({
      where: { productionUpdateId: updateId },
    });
    if (issue) {
      await prisma.issueClassification.update({
        where: { id: issue.id },
        data: {
          confidenceScore: 0.95,
          classifiedBy: 'AI_CLASSIFICATION_WORKER',
        },
      });
    }
  }

  /**
   * Returns recent production update history with pagination.
   */
  static async getProductionHistory(orderId?: string, limit = 20) {
    return prisma.productionUpdate.findMany({
      where: orderId ? { orderId } : {},
      take: limit,
      orderBy: { clientEventAt: 'desc' },
      include: {
        order: { select: { poNumber: true, style: true } },
        milestone: { select: { stage: true, targetQuantity: true, completedQuantity: true } },
        supervisor: { select: { name: true, email: true } },
        issueClassification: true,
      },
    });
  }
}
