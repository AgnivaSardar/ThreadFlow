import { Stage, RiskLevel } from '@prisma/client';

export interface ProductionDailyLog {
  date: Date | string;
  quantity: number;
}

export interface RiskEngineInput {
  orderId: string;
  milestoneId: string;
  stage: Stage;
  targetQuantity: number;
  completedQuantity: number;
  exFactoryDate: Date | string;
  orderDate?: Date | string;
  plannedStageStart: Date | string;
  plannedStageEnd: Date | string;
  dailyLogs: ProductionDailyLog[];
  subcontractorTransitHours?: number;
  fobPricePerPiece?: number;
  exchangeRate?: number;
  currency?: string;
  simulatedToday?: Date | string;
}

export interface FormulaBreakdown {
  formula: string;
  substituted: string;
  result: number;
}

export interface MathExplanationPayload {
  requiredRateMath: FormulaBreakdown;
  actualRateMath: FormulaBreakdown;
  varianceMath: FormulaBreakdown;
  daysLateMath: FormulaBreakdown;
  workingDaysTotal: number;
  downstreamBufferDays: number;
  effectiveWorkingDays: number;
  remainingPieces: number;
  weightsApplied: { day1: number; day2: number; day3: number };
  recentLogsSample: { date: string; quantity: number }[];
  rulesTriggered: string[];
}

export interface RiskEvaluationResult {
  riskLevel: RiskLevel;
  isCompleted?: boolean;
  requiredDailyRate: number;
  actualRollingRate: number;
  varianceQtyPerDay: number;
  differencePill: string;
  workingDaysNeeded: number;
  projectedCompletionDate: Date;
  daysLate: number;
  financialExposureRupees: number;
  mathBreakdown: MathExplanationPayload;
  rulesTriggered: string[];
}

/**
 * Standard Downstream Buffer Lead Times (in working days)
 * required after each stage before final export shipment.
 */
export const DEFAULT_DOWNSTREAM_BUFFERS: Record<Stage, number> = {
  KNITTING: 18,
  DYEING_WASHING: 14,
  PRINTING: 11,
  CUTTING: 9,
  STITCHING: 3,
  CHECKING: 2,
  FINISHING: 0,
};

/**
 * Calculates working days between two dates strictly excluding Sundays (day === 0).
 * If startDate >= endDate, returns 0.
 */
export function calculateWorkingDaysExcludingSundays(
  startDate: Date | string,
  endDate: Date | string
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Normalize times to midnight UTC for clean calendar day iteration
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const target = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

  if (cur >= target) {
    return 0;
  }

  let count = 0;
  while (cur < target) {
    cur.setUTCDate(cur.getUTCDate() + 1);
    if (cur.getUTCDay() !== 0) {
      // 0 = Sunday
      count++;
    }
  }
  return count;
}

/**
 * Computes calendar date stepping forward N working days (excluding Sundays).
 */
export function addWorkingDaysExcludingSundays(
  startDate: Date | string,
  workingDaysToAdd: number
): Date {
  const result = new Date(startDate);
  let count = 0;
  const targetDays = Math.ceil(Math.max(0, workingDaysToAdd));

  while (count < targetDays) {
    result.setDate(result.getDate() + 1);
    if (result.getDay() !== 0) {
      count++;
    }
  }
  return result;
}

/**
 * Calculates 3-Day Weighted Moving Average (WMA) of recent daily production logs.
 * Weights: Day 1 (latest) 0.50, Day 2 0.30, Day 3 0.20.
 * Gracefully handles fewer than 3 available daily logs.
 */
export function calculate3DayWeightedRate(
  dailyLogs: ProductionDailyLog[]
): {
  rate: number;
  weights: { day1: number; day2: number; day3: number };
  substitutedFormula: string;
  samples: { date: string; quantity: number }[];
} {
  if (!dailyLogs || dailyLogs.length === 0) {
    return {
      rate: 0,
      weights: { day1: 0.5, day2: 0.3, day3: 0.2 },
      substitutedFormula: '(0 × 0.50) + (0 × 0.30) + (0 × 0.20) = 0 pcs/day',
      samples: [],
    };
  }

  // Sort logs by date descending (latest first)
  const sorted = [...dailyLogs].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const q1 = sorted[0]?.quantity || 0;
  const q2 = sorted[1]?.quantity;
  const q3 = sorted[2]?.quantity;

  const samples = sorted.slice(0, 3).map((l) => ({
    date: new Date(l.date).toISOString().split('T')[0],
    quantity: l.quantity,
  }));

  // Standard 3 days available
  if (q2 !== undefined && q3 !== undefined) {
    const rate = Math.round(q1 * 0.5 + q2 * 0.3 + q3 * 0.2);
    return {
      rate,
      weights: { day1: 0.5, day2: 0.3, day3: 0.2 },
      substitutedFormula: `(${q1} × 0.50) + (${q2} × 0.30) + (${q3} × 0.20) = ${rate} pcs/day`,
      samples,
    };
  }

  // 2 days available: normalize weights (0.625 / 0.375)
  if (q2 !== undefined) {
    const rate = Math.round(q1 * (0.5 / 0.8) + q2 * (0.3 / 0.8));
    return {
      rate,
      weights: { day1: 0.625, day2: 0.375, day3: 0 },
      substitutedFormula: `(${q1} × 0.625) + (${q2} × 0.375) = ${rate} pcs/day`,
      samples,
    };
  }

  // Only 1 day available
  return {
    rate: q1,
    weights: { day1: 1.0, day2: 0, day3: 0 },
    substitutedFormula: `(${q1} × 1.0) = ${q1} pcs/day`,
    samples,
  };
}

/**
 * Deterministic production risk calculation engine.
 * Computes required daily run-rate, 3-day weighted moving average, calendar exclusions,
 * days late, financial exposure, and explainable math payloads.
 */
export function evaluateProductionRisk(input: RiskEngineInput): RiskEvaluationResult {
  const simulatedToday = input.simulatedToday
    ? new Date(input.simulatedToday)
    : new Date('2026-11-02T10:00:00Z');

  const exFactory = new Date(input.exFactoryDate);
  const plannedStageEnd = new Date(input.plannedStageEnd);

  // 1. Remaining Pieces
  const remainingPieces = Math.max(0, input.targetQuantity - input.completedQuantity);

  // 2. Working days from simulated today to Ex-Factory deadline (excluding Sundays)
  const workingDaysToShip = calculateWorkingDaysExcludingSundays(simulatedToday, exFactory);

  // 3. Downstream Buffer Days
  const downstreamBufferDays = DEFAULT_DOWNSTREAM_BUFFERS[input.stage] ?? 0;

  // 4. Effective Working Days available for this stage
  // (Days to Ex-Factory minus buffers reserved for downstream processes)
  const effectiveWorkingDays = Math.max(1, workingDaysToShip - downstreamBufferDays);

  // 5. Required Daily Rate
  const requiredDailyRate =
    remainingPieces > 0 ? Math.ceil(remainingPieces / effectiveWorkingDays) : 0;

  // 6. Actual Rolling Rate (3-Day WMA)
  const wma = calculate3DayWeightedRate(input.dailyLogs);
  const actualRollingRate = wma.rate;

  // 7. Variance (Actual - Required)
  const isCompleted = remainingPieces === 0 || requiredDailyRate === 0;
  const varianceQtyPerDay = actualRollingRate - requiredDailyRate;
  const differencePill = isCompleted
    ? 'Completed'
    : varianceQtyPerDay >= 0
    ? `+${varianceQtyPerDay} pcs/day (On Track)`
    : `${varianceQtyPerDay} pcs/day (Deficit)`;

  // 8. Projected Completion and Days Late
  // Days needed at current actual rate (realistic estimation, preventing absurd year-2030 extrapolations)
  let workingDaysNeeded = 0;
  if (remainingPieces > 0) {
    if (actualRollingRate > 0) {
      workingDaysNeeded = Math.min(60, Math.ceil(remainingPieces / actualRollingRate));
    } else {
      // Dormant / stalled line: realistic backlog overrun (2 to 7 working days)
      const backlogDays = Math.min(7, Math.max(2, Math.ceil(remainingPieces / Math.max(50, requiredDailyRate))));
      workingDaysNeeded = effectiveWorkingDays + backlogDays;
    }
  }

  const projectedCompletionDate = addWorkingDaysExcludingSundays(simulatedToday, workingDaysNeeded);

  // Days late: only late if working days needed exceeds effective days available to ship with buffers intact
  let daysLate = 0;
  if (remainingPieces > 0) {
    if (workingDaysNeeded > effectiveWorkingDays) {
      daysLate = workingDaysNeeded - effectiveWorkingDays;
      if (projectedCompletionDate > plannedStageEnd) {
        const stageEndLate = calculateWorkingDaysExcludingSundays(plannedStageEnd, projectedCompletionDate);
        daysLate = Math.max(daysLate, stageEndLate);
      }
    } else {
      // Pace is on track to protect all downstream buffers: exactly 0 days late
      daysLate = 0;
    }
  }

  // 9. Status Assignment Rules & Dynamic Financial Exposure Calculation
  const rulesTriggered: string[] = [];
  let riskLevel: RiskLevel = RiskLevel.GREEN;
  let financialExposureRupees = 0;

  const bufferRemaining = workingDaysToShip - downstreamBufferDays;
  const transitHours = input.subcontractorTransitHours || 0;
  const priceInr = (input.fobPricePerPiece || 10) * (input.exchangeRate || 100);
  const remainingValueInr = Math.round(remainingPieces * priceInr);

  if (isCompleted) {
    riskLevel = RiskLevel.GREEN;
    financialExposureRupees = 0;
    daysLate = 0;
    rulesTriggered.push('Production completed: 0 pcs remaining for this stage.');
  } else if (daysLate > 0 || bufferRemaining < 0) {
    riskLevel = RiskLevel.RED;
    // Disruption penalty / air-freight contingency proportional to delayed pieces and delay duration
    const penaltyPct = Math.min(0.40, 0.10 + daysLate * 0.02);
    financialExposureRupees = Math.round(remainingValueInr * penaltyPct);
    if (financialExposureRupees === 0 && daysLate > 0) {
      financialExposureRupees = 150000;
    }
    rulesTriggered.push(
      `Projected stage finish is ${daysLate} working day(s) late past planned window.`
    );
    if (bufferRemaining < 0) {
      rulesTriggered.push(
        `Ex-factory delivery window breached: buffer deficit of ${Math.abs(bufferRemaining)} days.`
      );
    }
  } else if (bufferRemaining < 2 || varianceQtyPerDay < 0 || transitHours > 48) {
    riskLevel = RiskLevel.AMBER;
    financialExposureRupees = Math.round(remainingValueInr * 0.06);
    if (financialExposureRupees === 0 && varianceQtyPerDay < 0) {
      financialExposureRupees = 65000;
    }
    if (bufferRemaining < 2) {
      rulesTriggered.push(
        `Downstream buffer compressed: only ${bufferRemaining} working day(s) of safety cushion remaining.`
      );
    }
    if (varianceQtyPerDay < 0) {
      rulesTriggered.push(
        `Actual rolling rate is lagging ${Math.abs(varianceQtyPerDay)} pcs/day below required pace.`
      );
    }
    if (transitHours > 48) {
      rulesTriggered.push(
        `Subcontractor processing transit has exceeded 48 hours (${transitHours}h logged).`
      );
    }
  } else {
    riskLevel = RiskLevel.GREEN;
    financialExposureRupees = 0;
    rulesTriggered.push(
      `On track: rolling rate meets required throughput with ${bufferRemaining} days downstream buffer.`
    );
  }

  // 10. Explainable "Show-Your-Math" Payload
  const mathBreakdown: MathExplanationPayload = {
    requiredRateMath: {
      formula: 'Required Daily Rate = Remaining Pieces / (Working Days To Ship - Downstream Buffers)',
      substituted: isCompleted
        ? '0 pcs remaining (Stage Completed)'
        : `${remainingPieces.toLocaleString()} pcs / (${workingDaysToShip}d - ${downstreamBufferDays}d) = ${requiredDailyRate} pcs/day`,
      result: requiredDailyRate,
    },
    actualRateMath: {
      formula: 'Actual Rate = (Day 1 × 0.50) + (Day 2 × 0.30) + (Day 3 × 0.20)',
      substituted: wma.substitutedFormula,
      result: actualRollingRate,
    },
    varianceMath: {
      formula: 'Variance = Actual Rolling Rate - Required Daily Rate',
      substituted: isCompleted
        ? 'Target Met (Stage Completed)'
        : `${actualRollingRate} pcs/day - ${requiredDailyRate} pcs/day = ${varianceQtyPerDay > 0 ? `+${varianceQtyPerDay}` : varianceQtyPerDay} pcs/day`,
      result: varianceQtyPerDay,
    },
    daysLateMath: {
      formula: 'Days Late = Projected Completion Date - Planned Stage End Date (Excl. Sundays)',
      substituted: isCompleted
        ? '0 days (Completed on Schedule)'
        : `${projectedCompletionDate.toISOString().split('T')[0]} - ${plannedStageEnd.toISOString().split('T')[0]} = ${daysLate} days`,
      result: daysLate,
    },
    workingDaysTotal: workingDaysToShip,
    downstreamBufferDays,
    effectiveWorkingDays,
    remainingPieces,
    weightsApplied: wma.weights,
    recentLogsSample: wma.samples,
    rulesTriggered,
  };

  return {
    riskLevel,
    isCompleted,
    requiredDailyRate,
    actualRollingRate,
    varianceQtyPerDay,
    differencePill,
    workingDaysNeeded,
    projectedCompletionDate,
    daysLate,
    financialExposureRupees,
    mathBreakdown,
    rulesTriggered,
  };
}
