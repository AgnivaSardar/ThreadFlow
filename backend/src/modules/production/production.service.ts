import { prisma } from '../../config/db';
import { Role, Stage, IssueCategory, AuditCategory } from '@prisma/client';
import { AppError } from '../../common/errors/AppError';
import { AuthenticatedUser } from '../../common/types/express';
import { CreateProductionUpdateInput } from './production.schema';
import { calculateAuditHash } from '../../common/utils/crypto';
import { RiskService } from '../risk/risk.service';
import { AIService } from '../ai/ai.service';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

// Real-Time Event Broadcast Hub for Production Updates
export const productionEventEmitter = new EventEmitter();

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
    case Stage.DYEING_WASHING:
      return 'dye/wash';
    case Stage.PRINTING:
      return 'print';
    case Stage.KNITTING:
      return 'knit';
    default:
      return String(stage);
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
    case Stage.DYEING_WASHING:
      return 'dyeing/washing';
    case Stage.PRINTING:
      return 'printing';
    case Stage.KNITTING:
      return 'knitting';
    default:
      return String(stage);
  }
}

export class ProductionService {
  /**
   * Retrieves active production work assigned to the supervisor's manufacturing unit.
   */
  static async getSupervisorWork(user: AuthenticatedUser, requestedUnitId?: string) {
    let unitId: string | null = null;

    if (user.role === Role.SUPERVISOR) {
      // Supervisors are strictly bound to their assigned manufacturing unit
      unitId = user.assignedUnitId || null;
      if (!unitId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { assignedUnitId: true },
        });
        unitId = dbUser?.assignedUnitId || null;
      }
      if (!unitId) {
        const defaultUnit = await prisma.unit.findFirst({
          orderBy: { createdAt: 'asc' },
        });
        unitId = defaultUnit?.id || null;
      }
    } else if (requestedUnitId && requestedUnitId !== 'ALL') {
      unitId = requestedUnitId;
    }

    const unit = unitId
      ? await prisma.unit.findUnique({
          where: { id: unitId },
          include: {
            users: {
              where: { role: Role.SUPERVISOR },
              select: { id: true, name: true, phone: true, email: true },
            },
          },
        })
      : null;

    const allUnits = await prisma.unit.findMany({
      orderBy: { code: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        type: true,
        users: {
          where: { role: Role.SUPERVISOR },
          select: { id: true, name: true, phone: true, email: true },
        },
      },
    });

    // Rule: One product is handled by one unit.
    // All supervisors under a unit share and manage all products assigned to that unit only.
    const orders = await prisma.order.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        ...(unitId ? { unitId } : {}),
      },
      include: {
        buyer: { select: { id: true, name: true, code: true } },
        unit: { select: { id: true, name: true, code: true, type: true } },
        milestones: {
          orderBy: { sequenceOrder: 'asc' },
          include: {
            unit: { select: { id: true, name: true, code: true, type: true } },
          },
        },
        orderLines: {
          orderBy: { size: 'asc' },
        },
        productionUpdates: {
          select: {
            milestoneId: true,
            sizeBreakdownLines: {
              select: {
                orderLineId: true,
                goodQuantity: true,
              },
            },
          },
        },
      },
      orderBy: { exFactoryDate: 'asc' },
    });

    const workItems = orders.map((order) => {
      const activeMilestone =
        order.milestones.find((m) => m.completedQuantity < m.targetQuantity) ||
        order.milestones[order.milestones.length - 1];

      const totalPlanned = order.milestones.reduce((acc, m) => acc + m.targetQuantity, 0);
      const totalCompleted = order.milestones.reduce((acc, m) => acc + m.completedQuantity, 0);
      const overallProgress = totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0;

      // Calculate completed quantity for each orderLine in THIS active milestone so sum ALWAYS equals activeMilestone.completedQuantity:
      const activeMilestoneUpdates = activeMilestone
        ? (order as any).productionUpdates?.filter((u: any) => u.milestoneId === activeMilestone.id) || []
        : [];

      const stageLineCompletedMap = new Map<string, number>();
      for (const update of activeMilestoneUpdates) {
        for (const line of update.sizeBreakdownLines) {
          const cur = stageLineCompletedMap.get(line.orderLineId) || 0;
          stageLineCompletedMap.set(line.orderLineId, cur + line.goodQuantity);
        }
      }

      const targetMilestoneQty = activeMilestone ? activeMilestone.completedQuantity : 0;
      const dbLinesCompletedSum = order.orderLines.reduce((acc, l) => acc + (l.completedQty || 0), 0);
      const loggedTotal = Array.from(stageLineCompletedMap.values()).reduce((a, b) => a + b, 0);

      let orderLines: Array<{
        id: string;
        size: string;
        color: string;
        plannedQty: number;
        completedQty: number;
      }> = [];

      if (targetMilestoneQty === 0) {
        orderLines = order.orderLines.map((l) => ({
          id: l.id,
          size: l.size,
          color: l.color,
          plannedQty: l.plannedQty,
          completedQty: 0,
        }));
      } else if (dbLinesCompletedSum === targetMilestoneQty) {
        // Direct match with database OrderLine completed count (e.g. final stage garments)
        orderLines = order.orderLines.map((l) => ({
          id: l.id,
          size: l.size,
          color: l.color,
          plannedQty: l.plannedQty,
          completedQty: l.completedQty,
        }));
      } else if (loggedTotal === targetMilestoneQty) {
        // Direct match with shift update size lines recorded for this milestone
        orderLines = order.orderLines.map((l) => ({
          id: l.id,
          size: l.size,
          color: l.color,
          plannedQty: l.plannedQty,
          completedQty: stageLineCompletedMap.get(l.id) || 0,
        }));
      } else if (loggedTotal > 0 && loggedTotal < targetMilestoneQty) {
        // Blend recorded update lines with remaining unallocated pieces distributed by remaining capacity
        const unallocated = targetMilestoneQty - loggedTotal;
        const remainingCapacities = order.orderLines.map((l) => {
          const base = stageLineCompletedMap.get(l.id) || 0;
          return Math.max(0, l.plannedQty - base);
        });
        const totalRemainingCapacity = remainingCapacities.reduce((a, b) => a + b, 0);

        let allocatedExtra = 0;
        orderLines = order.orderLines.map((l, idx) => {
          const base = stageLineCompletedMap.get(l.id) || 0;
          const isLast = idx === order.orderLines.length - 1;
          let extra = 0;

          if (isLast) {
            extra = Math.max(0, unallocated - allocatedExtra);
          } else if (totalRemainingCapacity > 0) {
            extra = Math.round((remainingCapacities[idx] / totalRemainingCapacity) * unallocated);
            allocatedExtra += extra;
          }

          return {
            id: l.id,
            size: l.size,
            color: l.color,
            plannedQty: l.plannedQty,
            completedQty: base + extra,
          };
        });
      } else {
        // Distribute targetMilestoneQty across lines proportional to plannedQty with zero rounding error
        const totalPlannedLines = order.orderLines.reduce((acc, l) => acc + l.plannedQty, 0);
        let allocatedSoFar = 0;

        orderLines = order.orderLines.map((l, idx) => {
          const isLast = idx === order.orderLines.length - 1;
          const completed = isLast
            ? Math.max(0, targetMilestoneQty - allocatedSoFar)
            : Math.round((l.plannedQty / totalPlannedLines) * targetMilestoneQty);
          allocatedSoFar += completed;

          return {
            id: l.id,
            size: l.size,
            color: l.color,
            plannedQty: l.plannedQty,
            completedQty: completed,
          };
        });
      }

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
        orderLines,
        overallProgress,
        isCompleted: !activeMilestone || activeMilestone.completedQuantity >= activeMilestone.targetQuantity,
      };
    });

    // Exclude completed orders from floor work
    const activeOrders = workItems.filter((item) => {
      const isDone = Boolean(
        item.isCompleted ||
        !item.activeMilestone ||
        item.activeMilestone.remainingQuantity === 0 ||
        item.activeMilestone.completedQuantity >= item.activeMilestone.targetQuantity ||
        (item.milestones && item.milestones.every((m) => m.completedQuantity >= m.targetQuantity))
      );
      return !isDone;
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
      unit: unit
        ? {
            id: unit.id,
            name: unit.name,
            code: unit.code,
            type: unit.type,
            supervisors: unit.users || [],
          }
        : null,
      allUnits,
      assignedOrdersCount: activeOrders.length,
      orders: activeOrders,
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
   * Records a production update with idempotency, concurrency guardrails,
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

    // Unit Scoping: One product is handled by one unit.
    // Multiple supervisors under that unit can update its products, but supervisors cannot update products of other units.
    if (user.role === Role.SUPERVISOR && user.assignedUnitId) {
      if (order.unitId !== user.assignedUnitId) {
        throw new AppError(
          `Unauthorized: Order #${order.poNumber} is assigned to ${order.unit?.name || 'another unit'}. You may only log shift output for products handled by your unit.`,
          403
        );
      }
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

    // 4. Invariant 1 (Sequential Stage Constraint):
    if (targetMilestone.sequenceOrder > 1 && input.goodQuantity > 0) {
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

    // 5. Invariant 2 (Required Stage Cap Check):
    const currentCumulativeOutput = targetMilestone.completedQuantity;
    const ceilingAllowed = targetMilestone.targetQuantity;
    if (input.goodQuantity > 0 && proposedCumulativeOutput > ceilingAllowed) {
      throw new AppError(
        `Cap amount exceeded: Proposed stage output (${proposedCumulativeOutput.toLocaleString()} pcs) exceeds the required cap amount of ${ceilingAllowed.toLocaleString()} pcs. Maximum remaining allowed: ${Math.max(0, ceilingAllowed - currentCumulativeOutput).toLocaleString()} pcs. Please recheck your entry.`,
        400
      );
    }

    // 6. Invariant 3 (Per-Size Breakdown Lines Reconciliation & Cap Enforcement):
    if (input.sizeBreakdownLines && input.sizeBreakdownLines.length > 0 && input.goodQuantity > 0) {
      const sizeSum = input.sizeBreakdownLines.reduce((acc, l) => acc + l.goodQuantity, 0);
      if (sizeSum !== input.goodQuantity) {
        throw new AppError(
          `Size breakdown mismatch: Sum of per-size quantities (${sizeSum.toLocaleString()} pcs) does not match total good quantity (${input.goodQuantity.toLocaleString()} pcs).`,
          400
        );
      }

      for (const line of input.sizeBreakdownLines) {
        const orderLine = order.orderLines.find((ol) => ol.id === line.orderLineId);
        if (orderLine) {
          const lineCap = orderLine.plannedQty;
          const stageAgg = await prisma.productionUpdateLine.aggregate({
            where: {
              orderLineId: line.orderLineId,
              productionUpdate: { milestoneId: targetMilestone.id },
            },
            _sum: { goodQuantity: true },
          });
          const stageCompleted = stageAgg._sum.goodQuantity || 0;
          const proposedLineTotal = stageCompleted + line.goodQuantity;
          if (line.goodQuantity > 0 && proposedLineTotal > lineCap) {
            throw new AppError(
              `Cap amount exceeded for Size ${orderLine.size}: Proposed output (${proposedLineTotal.toLocaleString()} pcs) exceeds required cap of ${lineCap.toLocaleString()} pcs (Planned: ${orderLine.plannedQty.toLocaleString()} pcs). Maximum remaining allowed: ${Math.max(0, lineCap - stageCompleted).toLocaleString()} pcs. Please recheck your entry.`,
              400
            );
          }
        }
      }
    }

    // Upgrade 5: Line Velocity Sanity Guardrail (Alert if single-shift logged qty > 1500)
    const isVelocityAnomaly = input.goodQuantity > 1500;
    const finalNotes = isVelocityAnomaly
      ? `${input.notes ? `${input.notes} ` : ''}[VELOCITY_NOTICE: +${input.goodQuantity} pcs logged in shift]`
      : input.notes;

    // Pre-classify issue note outside transaction boundary so external network calls do not hold DB locks or cause transaction timeout
    let aiResult: any = null;
    if (input.notes) {
      try {
        aiResult = await AIService.classifyIssueNote(input.notes, {
          timeoutMs: 8000,
          orderId: order.id,
          context: {
            orderId: order.id,
            style: order.style,
            buyer: (order as any).buyer?.name,
            stage: input.stage,
            sizes: (order as any).orderLines?.map((l: any) => l.size) || [],
            colors: (order as any).orderLines?.map((l: any) => l.color) || [],
          },
        });
      } catch (classifyErr) {
        console.warn('AI issue classification error outside transaction boundary:', classifyErr);
      }
    }

    // 7. Execute Atomic ACID transaction with concurrency race protection
    const result = await prisma.$transaction(
      async (tx) => {
      // Re-query current completed count inside transaction boundary for concurrency lock
      const freshMilestone = await tx.tnaMilestone.findUnique({
        where: { id: targetMilestone.id },
        select: { completedQuantity: true },
      });

      const currentCompleted = freshMilestone?.completedQuantity || 0;
      const finalCumulativeOutput = currentCompleted + input.goodQuantity;

      if (finalCumulativeOutput > ceilingAllowed) {
        throw new AppError(
          `Concurrency conflict: Cumulative stage output (${finalCumulativeOutput.toLocaleString()} pcs) exceeds maximum allowed ${ceilingAllowed.toLocaleString()} pcs. Another update was recorded simultaneously.`,
          400
        );
      }

      // Check if stage is now 100% completed (Upgrade 3: Automated Milestone Completion & Pipeline Advance)
      const isStageCompleted = finalCumulativeOutput >= targetMilestone.targetQuantity;

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
          notes: finalNotes || null,
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

      // Increment completedQuantity on TNA milestone & auto-complete if target met
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

          // Only increment OrderLine.completedQty if this is the final milestone (FINISHING)
          // because OrderLine.completedQty represents the final finished garments ready for dispatch!
          if (targetMilestone.sequenceOrder === order.milestones.length) {
            const dbLine = await tx.orderLine.findUnique({ where: { id: line.orderLineId } });
            const cappedQty = Math.min(dbLine?.plannedQty || 999999, (dbLine?.completedQty || 0) + line.goodQuantity);
            await tx.orderLine.update({
              where: { id: line.orderLineId },
              data: {
                completedQty: cappedQty,
              },
            });
          }
        }
      } else if (input.goodQuantity > 0 && order.orderLines && order.orderLines.length > 0) {
        // Automatically distribute general output proportionally across order lines for final milestone
        if (targetMilestone.sequenceOrder === order.milestones.length) {
          const totalPlanned = order.orderLines.reduce((acc, l) => acc + l.plannedQty, 0);
          let allocated = 0;
          for (let i = 0; i < order.orderLines.length; i++) {
            const line = order.orderLines[i];
            const share =
              i === order.orderLines.length - 1
                ? Math.max(0, input.goodQuantity - allocated)
                : Math.round((line.plannedQty / totalPlanned) * input.goodQuantity);
            allocated += share;

            await tx.orderLine.update({
              where: { id: line.id },
              data: {
                completedQty: { increment: share },
              },
            });
          }
        }
      }

      // Record classification if issue notes or category present
      if (input.notes || input.issueCategory) {
        await tx.issueClassification.create({
          data: {
            productionUpdateId: update.id,
            category: input.issueCategory || aiResult?.category || IssueCategory.OTHER,
            confidenceScore: input.issueCategory ? 1.0 : (aiResult?.confidenceScore || 0.85),
            needsReview: input.issueCategory ? false : (aiResult?.needsReview ?? true),
            isConfirmed: input.issueCategory ? true : ((aiResult?.confidenceScore || 0) >= 0.90 && !aiResult?.needsReview),
            rawTamilText: input.notes || null,
            translatedText: aiResult?.translatedText || aiResult?.englishSummary || null,
            classifiedBy: input.issueCategory ? 'SUPERVISOR_KEYPAD' : (aiResult?.classifiedBy || 'AI'),
          },
        });

        // Ensure note is saved exclusively in clean English translation as requested
        const cleanEnglishNote = aiResult?.translatedText || aiResult?.englishSummary;
        if (cleanEnglishNote && cleanEnglishNote !== update.notes) {
          await tx.productionUpdate.update({
            where: { id: update.id },
            data: { notes: cleanEnglishNote },
          });
        }
      }

      // Record tamper-evident SHA-256 audit event
      const latestAudit = await tx.auditEvent.findFirst({
        where: { entityId: targetMilestone.id },
        orderBy: { timestamp: 'desc' },
      });

      const auditDate = new Date();
      const auditTimestamp = auditDate.toISOString();
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
          timestamp: auditDate,
          entityType: 'TnaMilestone',
          entityId: targetMilestone.id,
          action: 'RECORD_STAGE_OUTPUT',
          category: AuditCategory.STAGE_OUTPUT,
          reasonCode: 'FLOOR_SHIFT_LOG',
          notes: `Recorded +${input.goodQuantity} pcs in stage ${targetMilestone.stage}. Notes: ${input.notes || 'None'}`,
          previousValue: JSON.stringify({ completedQuantity: currentCompleted }),
          newValue: JSON.stringify({ completedQuantity: updatedMilestone.completedQuantity }),
          financialImpactRupees: 0,
          auditHash,
          userId: user.id,
          userRole: user.role,
        },
      });

      // Automatically mark order as COMPLETED if all milestones have reached target quantity
      const allMilestones = await tx.tnaMilestone.findMany({
        where: { orderId: order.id },
        select: { targetQuantity: true, completedQuantity: true },
      });
      const isOrderFullyComplete =
        allMilestones.length > 0 &&
        allMilestones.every((m) => m.completedQuantity >= m.targetQuantity);
      if (isOrderFullyComplete) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'COMPLETED' },
        });
      }

      return { update, updatedMilestone };
    }, { timeout: 25000, maxWait: 15000 });

    // Upgrade 6: Real-Time Event Broadcast
    productionEventEmitter.emit('floor:update:committed', {
      orderId: order.id,
      milestoneId: targetMilestone.id,
      stage: targetMilestone.stage,
      goodQuantity: input.goodQuantity,
      completedQuantity: result.updatedMilestone.completedQuantity,
      isCompleted: result.updatedMilestone.completedQuantity >= targetMilestone.targetQuantity,
      timestamp: new Date().toISOString(),
    });

    // 8. Trigger Asynchronous Jobs (Upgrade 4: Tamil NLP Classifier & Risk Engine)
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
   * Upgrade 1: Bulk Batch Ingestion for high-throughput offline queue synchronization
   */
  static async createBulkProductionUpdates(
    inputs: CreateProductionUpdateInput[],
    user: AuthenticatedUser
  ) {
    const results = {
      total: inputs.length,
      processed: 0,
      duplicates: 0,
      failed: 0,
      errors: [] as { index: number; idempotencyKey: string; error: string }[],
      updates: [] as any[],
    };

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      try {
        const res = await ProductionService.createProductionUpdate(input, user);
        if (res.isDuplicate) {
          results.duplicates++;
        } else {
          results.processed++;
        }
        results.updates.push(res.update);
      } catch (err: any) {
        results.failed++;
        results.errors.push({
          index: i,
          idempotencyKey: input.idempotencyKey,
          error: err.message || 'Validation or invariant failure',
        });
      }
    }

    return results;
  }

  /**
   * Resilient Tamil AI Classification Job with Zero-Downtime Deterministic Fallback
   */
  static async processAiClassificationJob(
    updateId: string,
    notes?: string | null,
    initialCategory?: IssueCategory | null,
    orderId?: string
  ) {
    if (!notes && !initialCategory) return;

    try {
      const classification = await AIService.classifyIssueNote(notes || '', {
        productionUpdateId: updateId,
        orderId,
      });

      const issue = await prisma.issueClassification.findFirst({
        where: { productionUpdateId: updateId },
      });

      const resolvedCategory =
        initialCategory && initialCategory !== IssueCategory.OTHER
          ? initialCategory
          : classification.category;

      const resolvedConfidence =
        initialCategory && initialCategory !== IssueCategory.OTHER
          ? 1.0
          : Math.max(classification.confidenceScore, 0.95);

      const isKeypad = Boolean(initialCategory && initialCategory !== IssueCategory.OTHER);

      if (issue) {
        await prisma.issueClassification.update({
          where: { id: issue.id },
          data: {
            category: resolvedCategory,
            confidenceScore: resolvedConfidence,
            needsReview: isKeypad ? false : classification.needsReview,
            isConfirmed: isKeypad ? true : (classification.confidenceScore >= 0.90 && !classification.needsReview),
            rawTamilText: notes || issue.rawTamilText,
            translatedText: classification.translatedText || classification.englishSummary,
            classifiedBy: isKeypad ? 'SUPERVISOR_KEYPAD' : classification.classifiedBy,
          },
        });
      } else {
        await prisma.issueClassification.create({
          data: {
            productionUpdateId: updateId,
            category: resolvedCategory,
            confidenceScore: resolvedConfidence,
            needsReview: isKeypad ? false : classification.needsReview,
            isConfirmed: isKeypad ? true : (classification.confidenceScore >= 0.90 && !classification.needsReview),
            rawTamilText: notes || null,
            translatedText: classification.translatedText || classification.englishSummary,
            classifiedBy: isKeypad ? 'SUPERVISOR_KEYPAD' : classification.classifiedBy,
          },
        });
      }
    } catch (err: any) {
      console.warn(`[ProductionService] AI classification job exception:`, err?.message);
    }
  }

  /**
   * Upgrade 7: Cryptographic Merkle Chain Audit Verification
   */
  static async verifyMilestoneAuditChain(milestoneId: string) {
    const milestone = await prisma.tnaMilestone.findUnique({
      where: { id: milestoneId },
      select: { id: true, stage: true, orderId: true },
    });

    if (!milestone) {
      throw new AppError(`Milestone #${milestoneId} was not found`, 404);
    }

    const events = await prisma.auditEvent.findMany({
      where: { entityId: milestoneId },
      orderBy: { timestamp: 'asc' },
    });

    if (events.length === 0) {
      return {
        isValid: true,
        totalEvents: 0,
        message: 'No audit records found for milestone',
        genesisHash: null,
        latestHash: null,
      };
    }

    let previousHash: string | null = null;
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const expectedHash = calculateAuditHash(
        previousHash,
        event.entityId,
        event.action,
        event.reasonCode || '',
        event.timestamp.toISOString(),
        event.financialImpactRupees || 0
      );

      if (event.auditHash !== expectedHash) {
        return {
          isValid: false,
          totalEvents: events.length,
          brokenAtEventIndex: i,
          failedEventId: event.id,
          expectedHash,
          actualHash: event.auditHash,
          message: `Cryptographic audit chain broken at event #${i + 1} (${event.id})`,
        };
      }

      previousHash = event.auditHash;
    }

    return {
      isValid: true,
      totalEvents: events.length,
      genesisHash: events[0].auditHash,
      latestHash: events[events.length - 1].auditHash,
      message: 'Cryptographic audit chain is unbroken and mathematically verified',
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

  /**
   * Runs realistic, calibrated floor work production updates across active orders
   * at the exact moment of execution.
   * "Accordingly random but not totally random" - reflects natural operator velocity,
   * defect rates, and strictly adheres to per-size breakdown capacities and stage ceilings.
   */
  static async runDynamicFloorWorks(
    callingUser?: AuthenticatedUser,
    options?: { poNumber?: string; shift?: 'DAY' | 'NIGHT' }
  ) {
    const now = new Date();
    // Indian Standard Time is UTC + 5:30
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffsetMs);
    const istHour = istDate.getUTCHours();
    const detectedShift: 'DAY' | 'NIGHT' = options?.shift || (istHour >= 8 && istHour < 18 ? 'DAY' : 'NIGHT');

    // Admin fallback
    let defaultUser: AuthenticatedUser = callingUser || {
      id: '',
      email: 'admin@threadflow.com',
      role: Role.ADMIN,
      assignedUnitId: null,
      buyerId: null,
      languagePreference: 'en',
    };

    if (!defaultUser.id) {
      const adminRecord = await prisma.user.findFirst({
        where: { role: Role.ADMIN },
      });
      if (adminRecord) {
        defaultUser.id = adminRecord.id;
        defaultUser.email = adminRecord.email;
      }
    }

    // Query active orders
    const activeOrders = await prisma.order.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        ...(options?.poNumber ? { poNumber: options.poNumber } : {}),
      },
      include: {
        milestones: { orderBy: { sequenceOrder: 'asc' } },
        orderLines: { orderBy: { size: 'asc' } },
        unit: {
          include: {
            users: { where: { role: Role.SUPERVISOR } },
          },
        },
      },
      orderBy: { exFactoryDate: 'asc' },
    });

    const results: any[] = [];
    let totalGoodPieces = 0;
    let totalRejectedPieces = 0;
    let stagesCompleted = 0;

    const notesPool = [
      'Shift output logged. Operator sewing line efficiency at 94% with needle calibration verified.',
      'Shift production completed on schedule. Intermediate bundle QC checks passed AQL 1.5 standard.',
      'Line velocity steady across all active operator tables. Garment bundles dispatched.',
      'Normal operations across all lines. Quality parameters within standard AQL 1.5 tolerance.',
      'Full team attendance on shop floor. Sizing batches cleared and tallied on floor board.',
      'Bundle processing smooth. Intermediate quality checks completed with low defect rate.',
      'Smooth production flow. Shift supervisor completed in-line measurement verification.',
      'Finishing and iron press lines fully staffed. In-line measurement checks passed 100%.',
      'Fabric lot inspected and cleared by internal QC. Color shading verified against master swatch.',
      'Shift milestone quota successfully reached with zero machine stoppage or defect clusters.',
    ];

    for (const order of activeOrders) {
      const activeMilestone = order.milestones.find((m) => m.completedQuantity < m.targetQuantity);
      if (!activeMilestone) {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'COMPLETED' },
        });
        continue;
      }

      const targetHeadroom = activeMilestone.targetQuantity - activeMilestone.completedQuantity;
      let upstreamHeadroom = targetHeadroom;
      if (activeMilestone.sequenceOrder > 1) {
        const upstreamMilestone = order.milestones.find((m) => m.sequenceOrder === activeMilestone.sequenceOrder - 1);
        if (upstreamMilestone) {
          upstreamHeadroom = Math.max(0, upstreamMilestone.completedQuantity - activeMilestone.completedQuantity);
        }
      }

      const maxAllowed = Math.min(targetHeadroom, upstreamHeadroom);
      if (maxAllowed <= 0) {
        results.push({
          poNumber: order.poNumber,
          style: order.style,
          unit: order.unit?.name || order.unit?.code || 'Assigned Unit',
          stage: activeMilestone.stage,
          status: 'WAITING_UPSTREAM',
          message: 'Stage waiting for predecessor stage output before additional pieces can advance.',
          currentProgress: `${activeMilestone.completedQuantity.toLocaleString()} / ${activeMilestone.targetQuantity.toLocaleString()} pcs`,
        });
        continue;
      }

      // "Accordingly random, but not totally random"
      // Daily target benchmark is paced over ~20 shifts for this order
      const baseDailyRate = Math.max(180, Math.min(650, Math.round(activeMilestone.targetQuantity / 20)));
      // Realistic shop floor variance +/- 10% to 15%
      const jitterFactor = 0.88 + Math.random() * 0.24; // 88% to 112%
      let rawDesiredGood = Math.round(baseDailyRate * jitterFactor);

      if (maxAllowed <= 480) {
        rawDesiredGood = maxAllowed;
      } else {
        rawDesiredGood = Math.min(maxAllowed, rawDesiredGood);
      }

      // Safe size breakdown line allocation respecting individual size ceilings
      let finalGoodQty = rawDesiredGood;
      let finalRejQty = Math.max(1, Math.min(6, Math.round(rawDesiredGood * (0.01 + Math.random() * 0.008))));
      let sizeBreakdownLines: Array<{ orderLineId: string; goodQuantity: number; rejectedQuantity: number }> | undefined = undefined;

      if (order.orderLines.length > 0) {
        // Query pieces already logged per size for this milestone
        const existingAgg = await prisma.productionUpdateLine.groupBy({
          by: ['orderLineId'],
          where: {
            productionUpdate: { milestoneId: activeMilestone.id },
          },
          _sum: { goodQuantity: true },
        });

        const completedMap = new Map<string, number>();
        for (const item of existingAgg) {
          completedMap.set(item.orderLineId, item._sum.goodQuantity || 0);
        }

        const lineCapacities = order.orderLines.map((l) => {
          const done = completedMap.get(l.id) || 0;
          const headroom = Math.max(0, l.plannedQty - done);
          return { id: l.id, size: l.size, plannedQty: l.plannedQty, headroom };
        });

        const totalHeadroom = lineCapacities.reduce((sum, l) => sum + l.headroom, 0);
        finalGoodQty = Math.min(rawDesiredGood, totalHeadroom);

        if (finalGoodQty <= 0) {
          results.push({
            poNumber: order.poNumber,
            style: order.style,
            unit: order.unit?.name || order.unit?.code || 'Assigned Unit',
            stage: activeMilestone.stage,
            status: 'SIZE_CAP_REACHED',
            message: `All size breakdown caps reached for stage ${activeMilestone.stage}.`,
            currentProgress: `${activeMilestone.completedQuantity.toLocaleString()} / ${activeMilestone.targetQuantity.toLocaleString()} pcs`,
          });
          continue;
        }

        let remainingToGive = finalGoodQty;
        sizeBreakdownLines = lineCapacities.map((l) => {
          if (l.headroom <= 0 || remainingToGive <= 0) {
            return {
              orderLineId: l.id,
              goodQuantity: 0,
              rejectedQuantity: 0,
            };
          }
          const share = Math.min(l.headroom, Math.min(remainingToGive, Math.round((l.headroom / totalHeadroom) * finalGoodQty)));
          remainingToGive -= share;
          return {
            orderLineId: l.id,
            goodQuantity: share,
            rejectedQuantity: 0,
          };
        });

        // Distribute remaining rounding pieces strictly to lines with available headroom
        if (remainingToGive > 0) {
          for (const line of sizeBreakdownLines) {
            if (remainingToGive <= 0) break;
            const cap = lineCapacities.find((c) => c.id === line.orderLineId);
            if (cap) {
              const currentGiven = line.goodQuantity;
              const canTakeMore = Math.min(remainingToGive, cap.headroom - currentGiven);
              if (canTakeMore > 0) {
                line.goodQuantity += canTakeMore;
                remainingToGive -= canTakeMore;
              }
            }
          }
        }

        // Adjust finalGoodQty to exactly match the sum of lines
        finalGoodQty = sizeBreakdownLines.reduce((acc, l) => acc + l.goodQuantity, 0);
        if (finalGoodQty <= 0) continue;

        finalRejQty = Math.max(1, Math.min(6, Math.round(finalGoodQty * (0.01 + Math.random() * 0.008))));
        let rejRemaining = finalRejQty;
        for (const line of sizeBreakdownLines) {
          if (line.goodQuantity > 0 && rejRemaining > 0) {
            const lineRej = Math.min(rejRemaining, Math.max(1, Math.round(line.goodQuantity * 0.015)));
            line.rejectedQuantity = lineRej;
            rejRemaining -= lineRej;
          }
        }

        sizeBreakdownLines = sizeBreakdownLines.filter((l) => l.goodQuantity > 0 || l.rejectedQuantity > 0);
      }

      // Unit supervisor assignment
      const unitSupervisor = order.unit?.users?.[0];
      const authUser: AuthenticatedUser = unitSupervisor
        ? {
            id: unitSupervisor.id,
            email: unitSupervisor.email,
            role: Role.SUPERVISOR,
            assignedUnitId: order.unitId,
            buyerId: null,
            languagePreference: (unitSupervisor.languagePreference as any) || 'ta',
          }
        : defaultUser;

      const note = notesPool[Math.floor(Math.random() * notesPool.length)];
      const lineName = `${order.unit?.code || 'UNIT'} Line ${((activeMilestone.sequenceOrder % 3) + 1)}`;

      try {
        const updateRes = await ProductionService.createProductionUpdate(
          {
            idempotencyKey: randomUUID(),
            orderId: order.id,
            milestoneId: activeMilestone.id,
            stage: activeMilestone.stage,
            shift: detectedShift,
            machineLine: lineName,
            goodQuantity: finalGoodQty,
            rejectedQuantity: finalRejQty,
            notes: note,
            clientEventAt: now.toISOString(),
            sizeBreakdownLines,
          },
          authUser
        );

        const newCompleted = activeMilestone.completedQuantity + finalGoodQty;
        const pct = Math.min(100, Math.round((newCompleted / activeMilestone.targetQuantity) * 100));
        const isStageFinished = newCompleted >= activeMilestone.targetQuantity;

        if (isStageFinished) stagesCompleted++;
        totalGoodPieces += finalGoodQty;
        totalRejectedPieces += finalRejQty;

        results.push({
          poNumber: order.poNumber,
          style: order.style,
          unit: order.unit?.name || order.unit?.code || 'Assigned Unit',
          stage: activeMilestone.stage,
          shift: detectedShift,
          machineLine: lineName,
          goodQuantity: finalGoodQty,
          rejectedQuantity: finalRejQty,
          previousQuantity: activeMilestone.completedQuantity,
          newQuantity: newCompleted,
          targetQuantity: activeMilestone.targetQuantity,
          progressPercentage: `${pct}%`,
          stageCompleted: isStageFinished,
          notes: note,
          supervisor: unitSupervisor?.name || 'Operations Admin',
          updateId: updateRes.update?.id,
        });
      } catch (err: any) {
        results.push({
          poNumber: order.poNumber,
          style: order.style,
          stage: activeMilestone.stage,
          status: 'ERROR',
          error: err.message,
        });
      }
    }

    return {
      success: true,
      message: `Dynamic floor work executed at ${now.toISOString()} (${detectedShift} Shift): ${totalGoodPieces.toLocaleString()} pieces recorded across ${results.filter((r) => r.goodQuantity > 0).length} orders.`,
      executedAt: now.toISOString(),
      currentTimeIst: `${istDate.toISOString().replace('T', ' ').slice(0, 16)} IST`,
      shift: detectedShift,
      summary: {
        totalOrdersEvaluated: activeOrders.length,
        ordersUpdated: results.filter((r) => r.goodQuantity > 0).length,
        totalGoodPieces,
        totalRejectedPieces,
        stagesCompleted,
      },
      details: results,
    };
  }
}
