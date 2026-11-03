import { prisma } from '../../config/db';
import { IssueCategory, Role, AuditCategory } from '@prisma/client';
import { AppError } from '../../common/errors/AppError';
import {
  classifyWithGemini,
  runDeterministicFallback,
  ClassificationResult,
  TAMIL_FALLBACK_DICTIONARY,
} from './provider';
import { calculateAuditHash } from '../../common/utils/crypto';
import { RiskService } from '../risk/risk.service';

export interface ClassifyNoteOptions {
  timeoutMs?: number;
  skipLlm?: boolean;
  productionUpdateId?: string;
  orderId?: string;
}

export class AIService {
  /**
   * Main entry point: Classifies colloquial Tamil/Tanglish floor notes into standardized operational buckets.
   * Employs Gemini 3.1 Flash Lite API with 3,000 ms SLA race and deterministic local regex fallback.
   */
  static async classifyIssueNote(
    rawText: string,
    options: ClassifyNoteOptions = {}
  ): Promise<ClassificationResult> {
    if (!rawText || !rawText.trim()) {
      return {
        category: IssueCategory.OTHER,
        confidenceScore: 1.0,
        englishSummary: 'No notes entered',
        needsReview: false,
        classifiedBy: 'FALLBACK_DEFAULT',
        latencyMs: 0,
        rawTamilText: '',
        translatedText: '',
        severity: 'LOW',
        estimatedDowntimeHours: null,
        impactedStage: null,
      };
    }

    if (options.skipLlm) {
      return runDeterministicFallback(
        rawText,
        Date.now(),
        'Explicit deterministic fallback requested'
      );
    }

    const timeout = options.timeoutMs || 3000;
    const result = await classifyWithGemini(rawText, timeout);

    // If linked to an order and has high/critical severity, trigger run-rate risk assessment
    if (
      options.orderId &&
      (result.severity === 'CRITICAL' ||
        result.category === IssueCategory.MACHINE_BREAKDOWN ||
        result.category === IssueCategory.POWER_OUTAGE)
    ) {
      try {
        const orderId = options.orderId;
        prisma.order
          .findUnique({
            where: { id: orderId },
            include: { milestones: { orderBy: { sequenceOrder: 'asc' } } },
          })
          .then((order) => {
            if (!order) return;
            const targetMilestone =
              order.milestones.find((m) => m.completedQuantity < m.targetQuantity) ||
              order.milestones[0];
            if (targetMilestone) {
              const systemUser: any = {
                id: 'SYSTEM_AI',
                role: Role.ADMIN,
                email: 'system@threadflow.local',
                languagePreference: 'ta',
              };
              RiskService.evaluateOrderMilestoneRisk(order.id, targetMilestone.id, systemUser).catch(
                (err: any) => {
                  console.warn(`[AIService] Background risk engine trigger warning:`, err?.message);
                }
              );
            }
          })
          .catch((err: any) => {
            console.warn(`[AIService] Order lookup warning:`, err?.message);
          });
      } catch (err: any) {
        // Protect pipeline from asynchronous risk evaluation errors
      }
    }

    return result;
  }

  /**
   * Persists the classification result to the IssueClassification database table.
   * Accepts optional Prisma transaction client for atomic execution inside production update batches.
   */
  static async persistClassification(
    productionUpdateId: string,
    result: ClassificationResult,
    txClient?: any
  ) {
    const db = txClient || prisma;

    const existing = await db.issueClassification.findUnique({
      where: { productionUpdateId },
    });

    if (existing) {
      return await db.issueClassification.update({
        where: { productionUpdateId },
        data: {
          category: result.category,
          confidenceScore: result.confidenceScore,
          needsReview: result.needsReview,
          isConfirmed: result.confidenceScore >= 0.90 && !result.needsReview,
          rawTamilText: result.rawTamilText,
          translatedText: result.translatedText || result.englishSummary,
          classifiedBy: result.classifiedBy,
        },
      });
    }

    return await db.issueClassification.create({
      data: {
        productionUpdateId,
        category: result.category,
        confidenceScore: result.confidenceScore,
        needsReview: result.needsReview,
        isConfirmed: result.confidenceScore >= 0.90 && !result.needsReview,
        rawTamilText: result.rawTamilText,
        translatedText: result.translatedText || result.englishSummary,
        classifiedBy: result.classifiedBy,
      },
    });
  }

  /**
   * Merchandiser Human-in-the-Loop (HITL) Queue:
   * Retrieves issue notes requiring operational review (confidence < 0.65 or fallback triggered).
   */
  static async getIssuesQueue(params: {
    needsReview?: boolean;
    category?: IssueCategory;
    isConfirmed?: boolean;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (typeof params.needsReview === 'boolean') {
      where.needsReview = params.needsReview;
    }
    if (params.category) {
      where.category = params.category;
    }
    if (typeof params.isConfirmed === 'boolean') {
      where.isConfirmed = params.isConfirmed;
    }

    const [total, items] = await Promise.all([
      prisma.issueClassification.count({ where }),
      prisma.issueClassification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          productionUpdate: {
            include: {
              order: {
                select: {
                  id: true,
                  poNumber: true,
                  style: true,
                  buyer: { select: { id: true, name: true, code: true } },
                  unit: { select: { id: true, name: true, code: true } },
                },
              },
              milestone: {
                select: {
                  id: true,
                  stage: true,
                  targetQuantity: true,
                  completedQuantity: true,
                },
              },
              supervisor: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items: items.map((item) => ({
        id: item.id,
        productionUpdateId: item.productionUpdateId,
        category: item.category,
        confidenceScore: item.confidenceScore,
        needsReview: item.needsReview,
        isConfirmed: item.isConfirmed,
        rawTamilText: item.rawTamilText,
        translatedText: item.translatedText,
        classifiedBy: item.classifiedBy,
        createdAt: item.createdAt,
        poNumber: item.productionUpdate.order.poNumber,
        style: item.productionUpdate.order.style,
        buyer: item.productionUpdate.order.buyer,
        unit: item.productionUpdate.order.unit,
        stage: item.productionUpdate.milestone.stage,
        supervisorName: item.productionUpdate.supervisor.name,
        shift: item.productionUpdate.shift,
        goodQuantity: item.productionUpdate.goodQuantity,
        rejectedQuantity: item.productionUpdate.rejectedQuantity,
      })),
    };
  }

  /**
   * Merchandiser confirms AI classification without modifications.
   */
  static async confirmClassification(issueId: string, merchandiserId: string) {
    const issue = await prisma.issueClassification.findUnique({
      where: { id: issueId },
      include: {
        productionUpdate: {
          include: { order: true },
        },
      },
    });

    if (!issue) {
      throw new AppError('Issue classification record not found', 404);
    }

    const updated = await prisma.issueClassification.update({
      where: { id: issueId },
      data: {
        isConfirmed: true,
        needsReview: false,
      },
    });

    // Write tamper-evident audit record
    const latestAudit = await prisma.auditEvent.findFirst({
      where: { entityId: issue.productionUpdate.orderId },
      orderBy: { timestamp: 'desc' },
    });

    const now = new Date();
    const auditHash = calculateAuditHash(
      latestAudit?.auditHash || null,
      issue.productionUpdate.orderId,
      'CONFIRM_ISSUE_CLASSIFICATION',
      JSON.stringify({ issueId, category: issue.category }),
      now.toISOString(),
      0
    );

    await prisma.auditEvent.create({
      data: {
        timestamp: now,
        entityType: 'Order',
        entityId: issue.productionUpdate.orderId,
        orderId: issue.productionUpdate.orderId,
        category: AuditCategory.RISK_STATUS_CHANGE,
        action: 'CONFIRM_ISSUE_CLASSIFICATION',
        reasonCode: 'OPERATIONAL_REVIEW',
        userId: merchandiserId,
        userRole: Role.MERCHANDISER,
        notes: `Merchandiser confirmed ${issue.category} classification for PO ${issue.productionUpdate.order.poNumber}`,
        auditHash,
        previousValue: JSON.stringify({ category: issue.category, isConfirmed: false }),
        newValue: JSON.stringify({ category: issue.category, isConfirmed: true }),
      },
    });

    return updated;
  }

  /**
   * Merchandiser overrides AI classification to another operational category.
   */
  static async overrideClassification(
    issueId: string,
    newCategory: IssueCategory,
    merchandiserId: string,
    overrideReason?: string
  ) {
    const issue = await prisma.issueClassification.findUnique({
      where: { id: issueId },
      include: {
        productionUpdate: {
          include: { order: true },
        },
      },
    });

    if (!issue) {
      throw new AppError('Issue classification record not found', 404);
    }

    const oldCategory = issue.category;

    const updated = await prisma.issueClassification.update({
      where: { id: issueId },
      data: {
        category: newCategory,
        confidenceScore: 1.0,
        needsReview: false,
        isConfirmed: true,
        classifiedBy: 'MERCHANDISER_OVERRIDE',
        translatedText: overrideReason
          ? `[OVERRIDDEN by Merchandiser]: ${overrideReason} (Original AI: ${oldCategory})`
          : issue.translatedText,
      },
    });

    // Write audit event
    const latestAudit = await prisma.auditEvent.findFirst({
      where: { entityId: issue.productionUpdate.orderId },
      orderBy: { timestamp: 'desc' },
    });

    const now = new Date();
    const auditHash = calculateAuditHash(
      latestAudit?.auditHash || null,
      issue.productionUpdate.orderId,
      'OVERRIDE_ISSUE_CLASSIFICATION',
      JSON.stringify({ issueId, oldCategory, newCategory, overrideReason }),
      now.toISOString(),
      0
    );

    await prisma.auditEvent.create({
      data: {
        timestamp: now,
        entityType: 'Order',
        entityId: issue.productionUpdate.orderId,
        orderId: issue.productionUpdate.orderId,
        category: AuditCategory.RISK_STATUS_CHANGE,
        action: 'OVERRIDE_ISSUE_CLASSIFICATION',
        reasonCode: 'OPERATIONAL_OVERRIDE',
        userId: merchandiserId,
        userRole: Role.MERCHANDISER,
        notes: `Merchandiser overrode issue classification from ${oldCategory} to ${newCategory} on PO ${issue.productionUpdate.order.poNumber}. Reason: ${overrideReason || 'Operational re-assessment'}`,
        auditHash,
        previousValue: JSON.stringify({ category: oldCategory }),
        newValue: JSON.stringify({ category: newCategory }),
      },
    });

    return updated;
  }
}
