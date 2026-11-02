import { prisma } from '../../config/db';
import { Role, Stage, IssueCategory, AuditCategory } from '@prisma/client';
import { AppError } from '../../common/errors/AppError';
import { AuthenticatedUser } from '../../common/types/express';
import { CreateProductionUpdateInput } from './production.schema';
import { calculateAuditHash } from '../../common/utils/crypto';
import { RiskService } from '../risk/risk.service';

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
      // For general admin/merchandiser, pick Unit 1 as default context if none specified
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
      // Find the currently active milestone (first one not 100% completed)
      const activeMilestone =
        order.milestones.find((m) => m.completedQuantity < m.targetQuantity) ||
        order.milestones[order.milestones.length - 1];

      // Calculate progress
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

    // Recent updates logged by this supervisor (or for this unit)
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
   * cutting tolerance checks, and automated risk recalculation.
   */
  static async createProductionUpdate(
    input: CreateProductionUpdateInput,
    user: AuthenticatedUser
  ) {
    // 1. Check Idempotency: If already received, return stored record (preventing double counts)
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

    // 2. Fetch order with milestones in sequence
    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      include: {
        milestones: { orderBy: { sequenceOrder: 'asc' } },
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

    // 4. Invariant Check 1: Cutting Allowance Ceiling
    // Cumulative stage output cannot exceed Total PO * 1.03 (standard 3% Tiruppur allowance)
    const ceilingAllowed = Math.round(order.totalQuantity * 1.03);
    if (proposedCumulativeOutput > ceilingAllowed) {
      throw new AppError(
        `Tolerance ceiling exceeded: Proposed stage output (${proposedCumulativeOutput} pcs) exceeds maximum allowed ` +
          `${ceilingAllowed} pcs (PO Qty: ${order.totalQuantity} + 3% tolerance ceiling). Check entry for extra zeroes.`,
        400
      );
    }

    // 5. Invariant Check 2: Sequential Stage Hierarchy (Anti-Finger-Slip Guardrail)
    // Cumulative output of stage N cannot exceed cumulative output of stage N-1
    if (targetMilestone.sequenceOrder > 1) {
      const upstreamMilestone = order.milestones.find(
        (m) => m.sequenceOrder === targetMilestone.sequenceOrder - 1
      );

      if (upstreamMilestone) {
        if (proposedCumulativeOutput > upstreamMilestone.completedQuantity) {
          throw new AppError(
            `Sequential stage violation: Cumulative output for ${targetMilestone.stage} ` +
              `(${proposedCumulativeOutput} pcs) cannot exceed completed upstream ${upstreamMilestone.stage} ` +
              `output (${upstreamMilestone.completedQuantity} pcs). Check previous stage logs.`,
            400
          );
        }
      }
    }

    // 6. Execute ACID transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create production update
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

      // Record audit event for compliance
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

    // 7. Trigger Risk Engine to recalculate rolling run rates
    try {
      await RiskService.evaluateOrderMilestoneRisk(order.id, targetMilestone.id, user);
    } catch (riskErr) {
      console.warn('Risk engine auto-recalculation notice:', riskErr);
    }

    return {
      success: true,
      isDuplicate: false,
      message: 'Production output logged successfully',
      update: result.update,
      milestone: result.updatedMilestone,
    };
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
