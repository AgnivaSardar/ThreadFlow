import { prisma } from '../config/db';
import { AIService } from '../modules/ai/ai.service';
import { IssueCategory } from '@prisma/client';

/**
 * Background Asynchronous Worker Job:
 * Sweeps for unclassified production updates or updates pending AI translation
 * and processes them in batches without blocking user floor operations.
 */
export async function runAiClassificationSweep(batchSize: number = 20): Promise<{
  processedCount: number;
  updatedCount: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let processedCount = 0;
  let updatedCount = 0;

  try {
    // Find production updates that have notes but no issueClassification record
    const unclassifiedUpdates = await prisma.productionUpdate.findMany({
      where: {
        notes: { not: null },
        issueClassification: null,
      },
      take: batchSize,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        notes: true,
        orderId: true,
      },
    });

    for (const update of unclassifiedUpdates) {
      if (!update.notes || !update.notes.trim()) continue;

      try {
        processedCount++;
        const classification = await AIService.classifyIssueNote(update.notes, {
          productionUpdateId: update.id,
          orderId: update.orderId,
          timeoutMs: 3000,
        });

        await prisma.issueClassification.create({
          data: {
            productionUpdateId: update.id,
            category: classification.category,
            confidenceScore: classification.confidenceScore,
            needsReview: classification.needsReview,
            isConfirmed: classification.confidenceScore >= 0.90 && !classification.needsReview,
            rawTamilText: update.notes,
            translatedText: classification.translatedText || classification.englishSummary,
            classifiedBy: classification.classifiedBy,
          },
        });

        updatedCount++;
      } catch (err: any) {
        errors.push(`Update #${update.id}: ${err?.message || String(err)}`);
      }
    }
  } catch (err: any) {
    errors.push(`Sweep error: ${err?.message || String(err)}`);
  }

  return { processedCount, updatedCount, errors };
}
