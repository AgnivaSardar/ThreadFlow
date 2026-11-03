import React, { useState } from 'react';
import { MathExplanationPayload, RiskLevel, RateSimulationResult } from '../../types';
import {
  Sliders,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ShieldAlert,
  Copy,
  Check,
  Target,
  Zap,
  Users,
  RotateCcw,
} from 'lucide-react';

interface ShowYourMathCardProps {
  mathBreakdown: MathExplanationPayload;
  riskLevel: RiskLevel;
  isCompleted?: boolean;
  differencePill: string;
  requiredDailyRate: number;
  actualRollingRate: number;
  varianceQtyPerDay: number;
  daysLate: number;
  projectedCompletionDate: string;
  financialExposureRupees: number;
  rulesTriggered?: string[];
  plannedStageEnd?: string;
  poNumber?: string;
  styleName?: string;
  stageName?: string;
}

export const ShowYourMathCard: React.FC<ShowYourMathCardProps> = ({
  mathBreakdown,
  riskLevel,
  isCompleted: isCompletedProp,
  differencePill,
  requiredDailyRate,
  actualRollingRate,
  varianceQtyPerDay,
  daysLate,
  projectedCompletionDate,
  financialExposureRupees,
  poNumber,
  styleName,
  stageName,
}) => {
  const isCompleted = Boolean(
    isCompletedProp ||
    mathBreakdown.remainingPieces === 0 ||
    requiredDailyRate === 0
  );

  const [showSimulator, setShowSimulator] = useState(false);
  const [simulatedRate, setSimulatedRate] = useState<number>(
    actualRollingRate > 0 ? actualRollingRate : requiredDailyRate
  );
  const [simulationResult, setSimulationResult] = useState<RateSimulationResult | null>(null);
  const [copiedMemo, setCopiedMemo] = useState(false);

  // Extract Q1, Q2, Q3 values from the recent daily logs sample
  const sampleLogs = mathBreakdown.recentLogsSample || [];
  const q1 = sampleLogs[0]?.quantity ?? 0;
  const q2 = sampleLogs[1]?.quantity ?? 0;
  const q3 = sampleLogs[2]?.quantity ?? 0;

  // Maximum log value for mini sparkline scaling
  const maxLog = Math.max(1, q1, q2, q3);

  // Velocity Momentum calculation (Q1 vs Q2)
  const momentumDiff = q1 - q2;
  const hasMomentumData = q1 > 0 && q2 > 0;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Instant reactive calculation when slider is dragged (0ms latency)
  const handleSliderChange = (newRate: number) => {
    setSimulatedRate(newRate);

    const effDays = Math.max(1, mathBreakdown.workingDaysTotal - mathBreakdown.downstreamBufferDays);
    const req = requiredDailyRate;
    const daysNeeded = Math.min(60, Math.ceil(mathBreakdown.remainingPieces / Math.max(1, newRate)));
    const variance = newRate - req;
    const simLate = Math.max(0, daysNeeded - effDays);

    let simRisk: RiskLevel = 'GREEN';
    let exp = 0;
    if (simLate > 0) {
      simRisk = 'RED';
      exp = financialExposureRupees > 0 ? financialExposureRupees : 350000;
    } else if (variance < 0 || effDays < 2) {
      simRisk = 'AMBER';
      exp = Math.round((financialExposureRupees || 350000) * 0.3);
    }

    const today = new Date('2026-11-02T10:00:00Z');
    let count = 0;
    const proj = new Date(today);
    while (count < daysNeeded) {
      proj.setDate(proj.getDate() + 1);
      if (proj.getDay() !== 0) count++;
    }

    setSimulationResult({
      simulatedRate: newRate,
      requiredDailyRate: req,
      variance,
      workingDaysNeeded: daysNeeded,
      projectedCompletionDate: proj.toISOString(),
      daysLate: simLate,
      simulatedRisk: simRisk,
      financialExposureRupees: exp,
    });
  };

  // Active metrics: reactively changes when simulator slider is adjusted
  const activeResult = simulationResult || {
    simulatedRate: actualRollingRate,
    requiredDailyRate,
    variance: varianceQtyPerDay,
    workingDaysNeeded: Math.min(
      60,
      Math.ceil(mathBreakdown.remainingPieces / Math.max(1, actualRollingRate || requiredDailyRate))
    ),
    projectedCompletionDate,
    daysLate,
    simulatedRisk: riskLevel,
    financialExposureRupees,
  };

  const activeDifferencePill = isCompleted
    ? 'Completed'
    : activeResult.variance >= 0
    ? `+${activeResult.variance} pcs/day (On Track)`
    : `${activeResult.variance} pcs/day (Deficit)`;

  // Copy standup memo to clipboard
  const handleCopyMemo = () => {
    const formattedDate = formatDate(activeResult.projectedCompletionDate);
    const effDays = mathBreakdown.workingDaysTotal - mathBreakdown.downstreamBufferDays;
    const memo = [
      `[THREADFLOW RUN-RATE AUDIT]`,
      `PO: ${poNumber || 'B-PO'} | Style: ${styleName || 'Apparel'} | Stage: ${stageName || 'Active Stage'}`,
      isCompleted
        ? `• Status: COMPLETED (Target met, 0 pcs remaining for this stage)`
        : `• Remaining: ${mathBreakdown.remainingPieces.toLocaleString()} pcs across ${effDays} working days`,
      `• Required Pace: ${requiredDailyRate.toLocaleString()} pcs/day`,
      `• Actual Floor Speed: ${actualRollingRate.toLocaleString()} pcs/day (Logs: Q₁=${q1}, Q₂=${q2}, Q₃=${q3})`,
      `• Variance: ${activeDifferencePill}`,
      `• Projected Finish: ${formattedDate} (${isCompleted || activeResult.daysLate === 0 ? 'On Schedule' : `${activeResult.daysLate}d Late`})`,
      activeResult.financialExposureRupees > 0
        ? `• Financial Exposure: ₹${activeResult.financialExposureRupees.toLocaleString()} At Risk`
        : `• Financial Exposure: ₹0 (No late shipment penalty)`,
      isCompleted
        ? `• Directive: Stage completed on schedule.`
        : activeResult.daysLate > 0
        ? `• Action Directive: Elevate output to ${requiredDailyRate} pcs/day (+${Math.abs(activeResult.variance)} pcs/day) via overtime or line balancing.`
        : `• Status: Operating pace is within contractual safe thresholds.`,
    ].join('\n');

    navigator.clipboard.writeText(memo);
    setCopiedMemo(true);
    setTimeout(() => setCopiedMemo(false), 2500);
  };

  const effWorkingDays = Math.max(1, mathBreakdown.workingDaysTotal - mathBreakdown.downstreamBufferDays);
  const piecesInDeficit = Math.max(0, mathBreakdown.remainingPieces - (actualRollingRate * effWorkingDays));
  const estOvertimeCost = Math.round(Math.max(4500, piecesInDeficit * 10));
  const netRoi = Math.max(0, financialExposureRupees - estOvertimeCost);

  // =========================================================================
  // Compact COMPLETED Card View (when required pcs/day === 0 or remaining === 0)
  // =========================================================================
  if (isCompleted) {
    return (
      <div className="space-y-2 py-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-50/50 p-2.5 sm:p-3 rounded-xl border border-emerald-200/80">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                  Stage Completed
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-full border border-emerald-300">
                  0 pcs / day reqd
                </span>
              </div>
              <div className="text-[11px] text-emerald-800 font-medium">
                Production target met • 0 pcs remaining for this milestone
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-slate-400">Final Pace</div>
              <div className="text-xs font-mono font-bold text-slate-800">
                {actualRollingRate} pcs/day
              </div>
            </div>

            {/* Visual 3-Bar Mini Sparkline */}
            <div className="flex items-end gap-1.5 text-[9px] font-mono shrink-0">
              <div className="flex flex-col items-center">
                <div
                  className="w-3.5 bg-slate-200 rounded-2xs"
                  style={{ height: `${Math.max(6, Math.round((q3 / maxLog) * 16))}px` }}
                  title={`Day 3: ${q3} pcs`}
                />
                <span className="text-slate-500 font-bold">{q3}</span>
              </div>
              <div className="flex flex-col items-center">
                <div
                  className="w-3.5 bg-slate-300 rounded-2xs"
                  style={{ height: `${Math.max(6, Math.round((q2 / maxLog) * 16))}px` }}
                  title={`Day 2: ${q2} pcs`}
                />
                <span className="text-slate-600 font-bold">{q2}</span>
              </div>
              <div className="flex flex-col items-center">
                <div
                  className="w-3.5 bg-emerald-600 rounded-2xs"
                  style={{ height: `${Math.max(6, Math.round((q1 / maxLog) * 16))}px` }}
                  title={`Day 1: ${q1} pcs`}
                />
                <span className="text-emerald-900 font-bold">{q1}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Compact Bottom Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
          <button
            type="button"
            onClick={handleCopyMemo}
            className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition cursor-pointer"
          >
            {copiedMemo ? (
              <>
                <Check className="w-3 h-3 text-emerald-600" />
                <span className="text-emerald-700 font-bold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-slate-500" />
                <span>Copy Summary</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-3">
            <span className="text-slate-500 text-[11px]">
              Completed on Schedule • Buffers Preserved
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
              Completed
            </span>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Smaller, High-Density Active Card View
  // =========================================================================
  return (
    <div className="space-y-2.5">
      {/* Both Formulas in a Sleek, Compact Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-5 py-1">
        {/* Formula 1: Required Run-Rate (Compact) */}
        <div className="flex flex-col justify-between bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
          <div className="flex items-center justify-between mb-1 pb-1 border-b border-slate-200/60">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Formula 1: Required Run-Rate
            </span>
            <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
              Target pace to ship
            </span>
          </div>

          <div className="flex items-center justify-center gap-2 py-1 font-mono text-xs font-semibold text-slate-800">
            <span className="text-slate-500 font-sans font-medium text-xs shrink-0">Req =</span>
            <div className="inline-flex flex-col items-center leading-tight shrink-0">
              <span className="border-b border-slate-500 px-1.5 pb-0.5 text-slate-900 text-xs font-bold">
                {mathBreakdown.remainingPieces.toLocaleString()} pcs
              </span>
              <span className="pt-0.5 text-slate-600 text-[10px]">
                {mathBreakdown.workingDaysTotal}d − {mathBreakdown.downstreamBufferDays}d
              </span>
            </div>
            <span className="text-xs text-slate-400 font-light shrink-0">=</span>
            <span className="text-sm sm:text-base font-black text-sky-900 tracking-tight shrink-0">
              {requiredDailyRate.toLocaleString()} <span className="text-[10px] font-sans font-bold text-sky-700">pcs/day</span>
            </span>
          </div>

          <div className="text-[10px] sm:text-[11px] text-slate-500 font-mono text-center tracking-wide">
            Remaining: <strong className="text-slate-800">{mathBreakdown.remainingPieces.toLocaleString()} pcs</strong> in <strong className="text-slate-800">{mathBreakdown.workingDaysTotal - mathBreakdown.downstreamBufferDays}</strong> working days
          </div>
        </div>

        {/* Formula 2: 3-Day Weighted Rate (Compact) */}
        <div className="flex flex-col justify-between bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
          <div className="flex items-center justify-between mb-1 pb-1 border-b border-slate-200/60">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Formula 2: Actual Rate (3-Day WMA)
            </span>
            <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
              Floor pace
            </span>
          </div>

          <div className="flex items-center justify-center gap-2 py-1 font-mono text-xs font-semibold text-slate-800">
            <span className="text-slate-500 font-sans font-medium text-xs shrink-0">Actual =</span>
            <span className="text-slate-700 text-[11px] tracking-tight shrink-0">
              (Q₁×0.5 + Q₂×0.3 + Q₃×0.2)
            </span>
            <span className="text-xs text-slate-400 font-light shrink-0">=</span>
            <span
              className={`text-sm sm:text-base font-black tracking-tight shrink-0 ${
                (activeResult.simulatedRate > 0 ? activeResult.simulatedRate : actualRollingRate) >=
                requiredDailyRate
                  ? 'text-emerald-700'
                  : 'text-rose-700'
              }`}
            >
              {(showSimulator ? activeResult.simulatedRate : actualRollingRate).toLocaleString()}{' '}
              <span className="text-[10px] font-sans font-bold text-slate-600">pcs/day</span>
            </span>
          </div>

          {/* 3-Day Shift Logs Sparkline & Momentum Badge */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
            {hasMomentumData ? (
              <div className="flex items-center gap-1 text-[11px] font-semibold">
                {momentumDiff > 0 ? (
                  <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">
                    <TrendingUp className="w-3 h-3 text-emerald-600" />
                    +{momentumDiff} pcs vs yesterday
                  </span>
                ) : momentumDiff < 0 ? (
                  <span className="inline-flex items-center gap-1 text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded text-[10px]">
                    <TrendingDown className="w-3 h-3 text-rose-600" />
                    {momentumDiff} pcs vs yesterday
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                    <Minus className="w-3 h-3 text-slate-400" />
                    Steady
                  </span>
                )}
              </div>
            ) : (
              <span className="text-[10px] text-slate-400 font-mono">Floor logs</span>
            )}

            {/* Visual 3-Bar Mini Sparkline */}
            <div className="flex items-end gap-2 text-[9px] font-mono shrink-0">
              <div className="flex flex-col items-center">
                <div
                  className="w-3.5 bg-slate-200 rounded-2xs"
                  style={{ height: `${Math.max(6, Math.round((q3 / maxLog) * 16))}px` }}
                  title={`Day 3: ${q3} pcs (20%)`}
                />
                <span className="text-slate-500 font-bold">{q3}</span>
              </div>
              <div className="flex flex-col items-center">
                <div
                  className="w-3.5 bg-slate-300 rounded-2xs"
                  style={{ height: `${Math.max(6, Math.round((q2 / maxLog) * 16))}px` }}
                  title={`Day 2: ${q2} pcs (30%)`}
                />
                <span className="text-slate-600 font-bold">{q2}</span>
              </div>
              <div className="flex flex-col items-center">
                <div
                  className="w-3.5 bg-sky-600 rounded-2xs"
                  style={{ height: `${Math.max(6, Math.round((q1 / maxLog) * 16))}px` }}
                  title={`Day 1: ${q1} pcs (50%)`}
                />
                <span className="text-sky-900 font-bold">{q1}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Compact Bottom Bar */}
      <div className="pt-2 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSimulator(!showSimulator)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0C2D48] hover:text-sky-700 transition cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-sky-600" />
            <span>{showSimulator ? 'Close Simulator' : 'Test "What-If" Rate'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyMemo}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-md border border-slate-200 transition cursor-pointer"
            title="Copy standup memo"
          >
            {copiedMemo ? (
              <>
                <Check className="w-3 h-3 text-emerald-600" />
                <span className="text-emerald-700 font-bold">Copied Memo!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-slate-500" />
                <span>Copy Standup Memo</span>
              </>
            )}
          </button>
        </div>

        {/* Status Metrics Inline */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
          <div className="text-slate-600 text-[11px]">
            Projected Finish:{' '}
            <strong className="text-slate-900 font-bold ml-0.5">
              {formatDate(activeResult.projectedCompletionDate)}
            </strong>
          </div>

          {activeResult.daysLate > 0 ? (
            <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded text-[11px] border border-rose-200">
              {activeResult.daysLate}d Late
            </span>
          ) : (
            <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded text-[11px] border border-emerald-200">
              On Schedule
            </span>
          )}

          {/* Difference Pill */}
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${
              activeResult.variance >= 0
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                : 'bg-rose-50 text-rose-800 border border-rose-300'
            }`}
          >
            {activeResult.variance >= 0 ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-3 h-3 text-rose-600" />
            )}
            {activeDifferencePill}
          </span>

          {/* Financial Exposure Tag */}
          {activeResult.financialExposureRupees > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
              <ShieldAlert className="w-3 h-3 text-amber-600" />
              ₹{activeResult.financialExposureRupees.toLocaleString()} At Risk
            </span>
          )}
        </div>
      </div>

      {/* Interactive "What-If" Capacity Simulation Slider */}
      {showSimulator && (
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 animate-in slide-in-from-top-2 duration-150 text-xs">
          <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-sky-600" />
              Simulate Output Run-Rate Pace
            </span>
            <div className="flex items-center gap-1.5 bg-white px-2 py-0.5 rounded-lg border border-slate-300 shadow-2xs">
              <input
                type="number"
                min={1}
                max={10000}
                step={1}
                value={simulatedRate}
                onChange={(e) => handleSliderChange(Math.max(1, Number(e.target.value) || 0))}
                className="w-16 font-mono text-xs font-bold text-[#0C2D48] text-right focus:outline-none"
              />
              <span className="text-[11px] font-bold text-slate-500">pcs/day</span>
            </div>
          </div>

          <div className="space-y-1">
            <input
              type="range"
              min={Math.max(1, Math.round(requiredDailyRate * 0.2))}
              max={Math.max(2500, Math.round(requiredDailyRate * 2.5))}
              step={1}
              value={simulatedRate}
              onChange={(e) => handleSliderChange(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0C2D48]"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>{Math.max(1, Math.round(requiredDailyRate * 0.2))} pcs/day</span>
              <span className="text-sky-700 font-bold">Target Pace: {requiredDailyRate} pcs/day</span>
              <span>{Math.max(2500, Math.round(requiredDailyRate * 2.5))} pcs/day</span>
            </div>
          </div>

          {/* Quick Operational Remedy Presets */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Quick Actions:
            </span>
            <button
              type="button"
              onClick={() => handleSliderChange(requiredDailyRate)}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                simulatedRate === requiredDailyRate
                  ? 'bg-sky-700 text-white shadow-2xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
              }`}
            >
              <Target className="w-3 h-3" />
              <span>Match Target ({requiredDailyRate} pcs/day)</span>
            </button>
            <button
              type="button"
              onClick={() => handleSliderChange(Math.round(actualRollingRate * 1.25))}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                simulatedRate === Math.round(actualRollingRate * 1.25)
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>+2h Overtime (+25%)</span>
            </button>
            <button
              type="button"
              onClick={() => handleSliderChange(actualRollingRate + 100)}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                simulatedRate === actualRollingRate + 100
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
              }`}
            >
              <Users className="w-3 h-3" />
              <span>+1 Station (+100)</span>
            </button>
            <button
              type="button"
              onClick={() => handleSliderChange(actualRollingRate)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition flex items-center gap-1 cursor-pointer ${
                simulatedRate === actualRollingRate
                  ? 'bg-slate-800 text-white'
                  : 'bg-white hover:bg-slate-100 text-slate-500 border border-slate-200'
              }`}
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          {/* Plain English Pace Explanation */}
          <div className="text-[11px] text-slate-600 pt-1 font-medium bg-white/70 p-2 rounded-lg border border-slate-200/80">
            {activeResult.variance < 0 ? (
              <span>
                At <strong className="text-slate-900">{activeResult.simulatedRate.toLocaleString()} pcs/day</strong>, completing the remaining{' '}
                <strong className="text-slate-900">{mathBreakdown.remainingPieces.toLocaleString()} pcs</strong> will take{' '}
                <strong className="text-rose-700">{activeResult.workingDaysNeeded} working days</strong> — exceeding the{' '}
                {mathBreakdown.workingDaysTotal - mathBreakdown.downstreamBufferDays}-day window by{' '}
                <strong className="text-rose-700">{activeResult.daysLate} days</strong>.
              </span>
            ) : (
              <span>
                At <strong className="text-slate-900">{activeResult.simulatedRate.toLocaleString()} pcs/day</strong>, completing the remaining{' '}
                <strong className="text-slate-900">{mathBreakdown.remainingPieces.toLocaleString()} pcs</strong> will take{' '}
                <strong className="text-emerald-700">{activeResult.workingDaysNeeded} working days</strong> — on time within the{' '}
                {mathBreakdown.workingDaysTotal - mathBreakdown.downstreamBufferDays}-day window with buffers intact.
              </span>
            )}
          </div>

          {/* Overtime vs Air-Freight ROI Card */}
          {financialExposureRupees > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[11px] bg-emerald-50/80 border border-emerald-200/90 rounded-lg p-2 text-emerald-950">
              <div className="flex items-center gap-1 font-bold">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Overtime ROI Insight:</span>
              </div>
              <div className="text-right text-emerald-900">
                Authorizing floor overtime (~₹{estOvertimeCost.toLocaleString()}) protects{' '}
                <strong className="text-rose-900 font-extrabold">₹{financialExposureRupees.toLocaleString()}</strong> late penalty (Net Savings:{' '}
                <strong className="text-emerald-800 font-extrabold">+₹{netRoi.toLocaleString()}</strong>).
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
