/**
 * Physical Manufacturing Constraint / Stage Invariant:
 * In a discrete garment manufacturing TNA pipeline, every downstream stage's maximum
 * available quantity and completed output is physically capped by the completed output
 * of its immediate predecessor stage.
 *
 * (e.g. if Knitting only completed 7,400 pcs, Dyeing cannot have completed 8,000 pcs;
 * its maximum possible completed output is capped to 7,400 pcs).
 */
export function enforceStagePredecessorCeilings<
  T extends {
    sequenceOrder: number;
    completedQuantity: number;
    targetQuantity: number;
  }
>(milestones: T[], initialOrderQuantity?: number): T[] {
  if (!milestones || milestones.length === 0) return [];

  const sorted = [...milestones].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  let previousStageCompleted =
    initialOrderQuantity !== undefined && initialOrderQuantity > 0
      ? initialOrderQuantity
      : sorted[0]?.targetQuantity || 0;

  return sorted.map((ms, index) => {
    if (index === 0) {
      const effectiveCompleted = Math.min(ms.completedQuantity, ms.targetQuantity);
      previousStageCompleted = effectiveCompleted;
      return {
        ...ms,
        completedQuantity: effectiveCompleted,
      };
    }

    // Downstream stage: absolute maximum is the predecessor stage's completed quantity
    const stageCeiling = previousStageCompleted;
    if (stageCeiling > 0) {
      const effectiveTarget = Math.min(ms.targetQuantity, stageCeiling);
      const effectiveCompleted = Math.min(ms.completedQuantity, stageCeiling);
      previousStageCompleted = effectiveCompleted;
      return {
        ...ms,
        targetQuantity: effectiveTarget,
        completedQuantity: effectiveCompleted,
      };
    } else {
      // Upstream stage has 0 completed, so downstream can only have 0 completed
      previousStageCompleted = 0;
      return {
        ...ms,
        completedQuantity: 0,
      };
    }
  });
}
