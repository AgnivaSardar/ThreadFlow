import { prisma } from '../../config/db';
import { Role, Stage, IssueCategory, AuditCategory } from '@prisma/client';
import { AppError } from '../../common/errors/AppError';
import { AuthenticatedUser } from '../../common/types/express';
import { CreateProductionUpdateInput } from './production.schema';
import { calculateAuditHash } from '../../common/utils/crypto';
import { RiskService } from '../risk/risk.service';
import { AIService } from '../ai/ai.service';
import { EventEmitter } from 'events';

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

    if (requestedUnitId && requestedUnitId !== 'ALL') {
      unitId = requestedUnitId;
    } else if (user.role === Role.SUPERVISOR) {
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
          where: { code: 'UNIT_1' },
        });
        unitId = defaultUnit?.id || null;
      }
    }

    const unit = unitId
      ? await prisma.unit.findUnique({ where: { id: unitId } })
      : null;

    const allUnits = await prisma.unit.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, name: true, code: true, type: true },
    });

    const orders = await prisma.order.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        ...(unitId
          ? {
              OR: [
                { unitId },
                { milestones: { some: { unitId } } },
              ],
            }
          : {}),
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

      // Calculate completed quantity for each orderLine in THIS active milestone:
      const activeMilestoneUpdates = activeMilestone
        ? (order as any).productionUpdates?.filter((u: any) => u.milestoneId === activeMilestone.id) || []
        : [];

      const stageLineCompletedMap = new Map<string, number>();
      let hasLoggedLines = false;
      for (const update of activeMilestoneUpdates) {
        for (const line of update.sizeBreakdownLines) {
          hasLoggedLines = true;
          const cur = stageLineCompletedMap.get(line.orderLineId) || 0;
          stageLineCompletedMap.set(line.orderLineId, cur + line.goodQuantity);
        }
      }

      const activeMilestoneRatio =
        activeMilestone && activeMilestone.targetQuantity > 0
          ? activeMilestone.completedQuantity / activeMilestone.targetQuantity
          : 0;

      const orderLines = order.orderLines.map((l) => {
        let completedInStage = 0;
        if (hasLoggedLines) {
          completedInStage = stageLineCompletedMap.get(l.id) || 0;
        } else if (activeMilestone && activeMilestone.completedQuantity > 0) {
          completedInStage = Math.min(
            l.plannedQty,
            Math.round(l.plannedQty * activeMilestoneRatio)
          );
        } else {
          completedInStage = 0;
        }

        return {
          id: l.id,
          size: l.size,
          color: l.color,
          plannedQty: l.plannedQty,
          completedQty: completedInStage,
        };
      });

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
      unit: unit ? { id: unit.id, name: unit.name, code: unit.code, type: unit.type } : null,
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
    const ceilingAllowed = Math.round(order.totalQuantity * 1.03);
    if (input.goodQuantity > 0 && proposedCumulativeOutput > ceilingAllowed) {
      throw new AppError(
        `Tolerance ceiling exceeded: Proposed stage output (${proposedCumulativeOutput.toLocaleString()} pcs) ` +
          `exceeds maximum allowed ${ceilingAllowed.toLocaleString()} pcs (PO Qty: ${order.totalQuantity.toLocaleString()} + 3% tolerance ceiling). Check entry for extra zeroes.`,
        400
      );
    }

    // 5. Invariant 1 (Sequential Stage Constraint):
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

    // 6. Invariant 3 (Per-Size Breakdown Lines Reconciliation):
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
          const lineCeiling = Math.round(orderLine.plannedQty * 1.03);
          const stageAgg = await prisma.productionUpdateLine.aggregate({
            where: {
              orderLineId: line.orderLineId,
              productionUpdate: { milestoneId: targetMilestone.id },
            },
            _sum: { goodQuantity: true },
          });
          const stageCompleted = stageAgg._sum.goodQuantity || 0;
          const proposedLineTotal = stageCompleted + line.goodQuantity;
          if (proposedLineTotal > lineCeiling) {
            throw new AppError(
              `Tolerance ceiling exceeded for size ${orderLine.size}: Proposed stage output (${proposedLineTotal.toLocaleString()} pcs) exceeds maximum allowed ${lineCeiling.toLocaleString()} pcs (Planned: ${orderLine.plannedQty.toLocaleString()} + 3%).`,
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

    // 7. Execute Atomic ACID transaction with concurrency race protection
    const result = await prisma.$transaction(async (tx) => {
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
            await tx.orderLine.update({
              where: { id: line.orderLineId },
              data: {
                completedQty: { increment: line.goodQuantity },
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
        // Run resilient AI classifier with deterministic fallback
        const aiResult = input.notes
          ? await AIService.classifyIssueNote(input.notes, {
              timeoutMs: 2500,
              orderId: order.id,
              context: {
                orderId: order.id,
                style: order.style,
                buyer: (order as any).buyer?.name,
                stage: input.stage,
                sizes: (order as any).orderLines?.map((l: any) => l.size) || [],
                colors: (order as any).orderLines?.map((l: any) => l.color) || [],
              },
            })
          : null;

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
    });

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
}
