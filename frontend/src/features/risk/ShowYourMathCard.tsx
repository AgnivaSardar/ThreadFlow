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
} from 'lucide-react';

interface ShowYourMathCardProps {
  mathBreakdown: MathExplanationPayload;
  riskLevel: RiskLevel;
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
  differencePill,
  requiredDailyRate,
  actualRollingRate,
  varianceQtyPerDay,
  daysLate,
  projectedCompletionDate,
  financialExposureRupees,
  plannedStageEnd,
  poNumber,
  styleName,
  stageName,
}) => {
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

  // Copy standup memo to clipboard
  const handleCopyMemo = () => {
    const formattedDate = formatDate(activeResult.projectedCompletionDate);
    const effDays = mathBreakdown.workingDaysTotal - mathBreakdown.downstreamBufferDays;
    const memo = [
      `📋 THREADFLOW RUN-RATE AUDIT`,
      `PO: ${poNumber || 'B-PO'} | Style: ${styleName || 'Apparel'} | Stage: ${stageName || 'Active Stage'}`,
      `• Remaining: ${mathBreakdown.remainingPieces.toLocaleString()} pcs across ${effDays} working days`,
      `• Required Pace: ${requiredDailyRate.toLocaleString()} pcs/day`,
      `• Actual Floor Speed: ${actualRollingRate.toLocaleString()} pcs/day (Logs: Q₁=${q1}, Q₂=${q2}, Q₃=${q3})`,
      `• Variance: ${activeDifferencePill}`,
      `• Projected Finish: ${formattedDate} (${activeResult.daysLate > 0 ? `${activeResult.daysLate}d Late` : 'On Schedule'})`,
      activeResult.financialExposureRupees > 0
        ? `• Financial Exposure: ₹${activeResult.financialExposureRupees.toLocaleString()} At Risk`
        : `• Financial Exposure: ₹0 (No late shipment penalty)`,
      activeResult.daysLate > 0
        ? `• Action Directive: Elevate output to ${requiredDailyRate} pcs/day (+${Math.abs(activeResult.variance)} pcs/day) via overtime or line balancing.`
        : `• Status: Operating pace is within contractual safe thresholds.`,
    ].join('\n');

    navigator.clipboard.writeText(memo);
    setCopiedMemo(true);
    setTimeout(() => setCopiedMemo(false), 2500);
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
      // Proportional lot penalty when late
      exp = financialExposureRupees > 0 ? financialExposureRupees : 350000;
    } else if (variance < 0 || effDays < 2) {
      simRisk = 'AMBER';
      exp = Math.round((financialExposureRupees || 350000) * 0.3);
    }

    // Step forward by working days needed excluding Sundays
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

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const activeDifferencePill =
    activeResult.variance >= 0
      ? `+${activeResult.variance} pcs/day (On Track)`
      : `${activeResult.variance} pcs/day (Deficit)`;

  // Overtime ROI estimation
  const effWorkingDays = Math.max(1, mathBreakdown.workingDaysTotal - mathBreakdown.downstreamBufferDays);
  const piecesInDeficit = Math.max(0, mathBreakdown.remainingPieces - (actualRollingRate * effWorkingDays));
  const estOvertimeCost = Math.round(Math.max(4500, piecesInDeficit * 10));
  const netRoi = Math.max(0, financialExposureRupees - estOvertimeCost);

  return (
    <div className="space-y-4">
      {/* Both Formulas inside ONE cohesive div (NO inner div bg colors, NO inner div borders) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 py-2">
        {/* Formula 1: Required Run-Rate */}
        <div className="flex flex-col justify-center">
          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Formula 1: Required Run-Rate
            </span>
            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">Minimum pace to hit ship date</span>
          </div>

          {/* Sizing: Regular, legible font sizes fitting perfectly on mobile */}
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-1.5 sm:gap-3 py-2 font-mono text-xs sm:text-sm font-semibold text-slate-800">
            <span className="text-slate-600 font-sans font-medium text-xs sm:text-sm shrink-0">Required =</span>
            <div className="inline-flex flex-col items-center leading-tight shrink-0">
              <span className="border-b border-slate-600 px-2 pb-0.5 text-slate-900 text-xs sm:text-sm font-bold">
                {mathBreakdown.remainingPieces.toLocaleString()} pcs
              </span>
              <span className="pt-0.5 text-slate-600 text-[11px] sm:text-xs">
                {mathBreakdown.workingDaysTotal}d − {mathBreakdown.downstreamBufferDays}d
              </span>
            </div>
            <span className="text-sm sm:text-base text-slate-400 font-light shrink-0">=</span>
            <span className="text-base sm:text-xl font-black text-sky-900 tracking-tight shrink-0">
              {requiredDailyRate.toLocaleString()} <span className="text-[10px] sm:text-xs font-sans font-bold text-sky-700">pcs/day</span>
            </span>
          </div>

          <div className="text-[11px] sm:text-xs text-slate-500 font-mono text-center tracking-wide mt-0.5">
            Remaining: <strong className="text-slate-800">{mathBreakdown.remainingPieces.toLocaleString()} pcs</strong> in <strong className="text-slate-800">{mathBreakdown.workingDaysTotal - mathBreakdown.downstreamBufferDays}</strong> working days
          </div>
        </div>

        {/* Formula 2: 3-Day Weighted Rate (WMA) */}
        <div className="flex flex-col justify-center">
          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Formula 2: Actual Rate (3-Day WMA)
            </span>
            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">Weighted floor speed</span>
          </div>

          {/* Sizing: Regular, legible font sizes fitting perfectly on mobile */}
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-1.5 sm:gap-2.5 py-2 font-mono text-xs sm:text-sm font-semibold text-slate-800">
            <span className="text-slate-600 font-sans font-medium text-xs sm:text-sm shrink-0">Actual =</span>
            <span className="text-slate-700 text-[11px] sm:text-xs tracking-tight shrink-0">
              (Q₁×0.5 + Q₂×0.3 + Q₃×0.2)
            </span>
            <span className="text-sm sm:text-base text-slate-400 font-light shrink-0">=</span>
            <span
              className={`text-base sm:text-xl font-black tracking-tight shrink-0 ${
                (activeResult.simulatedRate > 0 ? activeResult.simulatedRate : actualRollingRate) >=
                requiredDailyRate
                  ? 'text-emerald-700'
                  : 'text-rose-700'
              }`}
            >
              {(showSimulator ? activeResult.simulatedRate : actualRollingRate).toLocaleString()}{' '}
              <span className="text-[10px] sm:text-xs font-sans font-bold text-slate-600">pcs/day</span>
            </span>
          </div>

          {/* 3-Day Shift Logs with Visual Sparkline & Momentum Badge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 pt-2 border-t border-slate-100">
            {/* Momentum Indicator Pill */}
            {hasMomentumData ? (
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                {momentumDiff > 0 ? (
                  <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[11px] sm:text-xs">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    +{momentumDiff} pcs vs yesterday (Gaining)
                  </span>
                ) : momentumDiff < 0 ? (
                  <span className="inline-flex items-center gap-1 text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 text-[11px] sm:text-xs">
                    <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                    {momentumDiff} pcs vs yesterday (Slipping)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200 text-[11px] sm:text-xs">
                    <Minus className="w-3.5 h-3.5 text-slate-400" />
                    Steady Velocity
                  </span>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-400 font-mono">Floor shift logs</div>
            )}

            {/* Visual 3-Bar Mini Sparkline */}
            <div className="flex items-end gap-2.5 text-[10px] font-mono self-center sm:self-auto">
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[9px] text-slate-400 font-medium">Q₃ 20%</span>
                <div
                  className="w-5 bg-slate-200 hover:bg-slate-300 rounded-xs transition-all"
                  style={{ height: `${Math.max(8, Math.round((q3 / maxLog) * 24))}px` }}
                  title={`Day 3: ${q3} pcs (20% weight)`}
                />
                <span className="font-bold text-slate-700">{q3}</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[9px] text-slate-400 font-medium">Q₂ 30%</span>
                <div
                  className="w-5 bg-slate-300 hover:bg-slate-400 rounded-xs transition-all"
                  style={{ height: `${Math.max(8, Math.round((q2 / maxLog) * 24))}px` }}
                  title={`Day 2: ${q2} pcs (30% weight)`}
                />
                <span className="font-bold text-slate-700">{q2}</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[9px] text-sky-700 font-bold">Q₁ 50%</span>
                <div
                  className="w-5 bg-sky-600 hover:bg-sky-700 rounded-xs transition-all shadow-2xs"
                  style={{ height: `${Math.max(8, Math.round((q1 / maxLog) * 24))}px` }}
                  title={`Day 1 (Latest): ${q1} pcs (50% weight)`}
                />
                <span className="font-bold text-sky-900">{q1}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar: Generous Spacing Between Each Metric */}
      <div className="pt-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setShowSimulator(!showSimulator)}
            className="inline-flex items-center gap-2 text-xs font-bold text-[#0C2D48] hover:text-sky-700 transition cursor-pointer self-start lg:self-auto"
          >
            <Sliders className="w-4 h-4 text-sky-600" />
            <span>{showSimulator ? 'Close Simulator' : 'Test "What-If" Rate Adjustment'}</span>
          </button>

          {/* Copy Standup Memo Button */}
          <button
            type="button"
            onClick={handleCopyMemo}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition cursor-pointer"
            title="Copy formatted standup report to clipboard"
          >
            {copiedMemo ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-bold">Copied Memo!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy Standup Memo</span>
              </>
            )}
          </button>
        </div>

        {/* Responsive spacing between Projected Finish, Late status, Difference pill, and Exposure */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-6 text-xs">
          <div className="text-slate-600">
            Projected Finish:{' '}
            <strong className="text-slate-900 font-bold ml-1">
              {formatDate(activeResult.projectedCompletionDate)}
            </strong>
          </div>

          {activeResult.daysLate > 0 ? (
            <span className="text-rose-700 font-bold bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
              {activeResult.daysLate}d Late
            </span>
          ) : (
            <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              On Schedule
            </span>
          )}

          {/* Difference Pill */}
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold ${
              activeResult.variance >= 0
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                : 'bg-rose-50 text-rose-800 border border-rose-300'
            }`}
          >
            {activeResult.variance >= 0 ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            )}
            {activeDifferencePill}
          </span>

          {/* Financial Exposure Tag */}
          {activeResult.financialExposureRupees > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              ₹{activeResult.financialExposureRupees.toLocaleString()} At Risk
            </span>
          )}
        </div>
      </div>

      {/* Interactive "What-If" Capacity Simulation Slider */}
      {showSimulator && (
        <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3.5 animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-sky-600" />
              Simulate Output Run-Rate Pace
            </span>
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-300 shadow-2xs focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20">
              <input
                type="number"
                min={1}
                max={10000}
                step={1}
                value={simulatedRate}
                onChange={(e) => handleSliderChange(Math.max(1, Number(e.target.value) || 0))}
                className="w-20 font-mono text-sm font-bold text-[#0C2D48] text-right focus:outline-none"
              />
              <span className="text-xs font-bold text-slate-500">pcs/day</span>
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
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0C2D48]"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>{Math.max(1, Math.round(requiredDailyRate * 0.2))} pcs/day</span>
              <span className="text-sky-700 font-bold">Target Pace: {requiredDailyRate} pcs/day</span>
              <span>{Math.max(2500, Math.round(requiredDailyRate * 2.5))} pcs/day</span>
            </div>
          </div>

          {/* Quick Operational Remedy Presets */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/60">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Quick Floor Actions:
            </span>
            <button
              type="button"
              onClick={() => handleSliderChange(requiredDailyRate)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                simulatedRate === requiredDailyRate
                  ? 'bg-sky-700 text-white shadow-2xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
              }`}
            >
              🎯 Match Target Pace ({requiredDailyRate} pcs/day)
            </button>
            <button
              type="button"
              onClick={() => handleSliderChange(Math.round(actualRollingRate * 1.25))}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                simulatedRate === Math.round(actualRollingRate * 1.25)
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
              }`}
            >
              ⚡ +2h Overtime (+25%)
            </button>
            <button
              type="button"
              onClick={() => handleSliderChange(actualRollingRate + 100)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                simulatedRate === actualRollingRate + 100
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
              }`}
            >
              👥 +1 Line Station (+100 pcs/day)
            </button>
            <button
              type="button"
              onClick={() => handleSliderChange(actualRollingRate)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1 cursor-pointer ${
                simulatedRate === actualRollingRate
                  ? 'bg-slate-800 text-white'
                  : 'bg-white hover:bg-slate-100 text-slate-500 border border-slate-200'
              }`}
            >
              ↺ Reset ({actualRollingRate} pcs/day)
            </button>
          </div>

          {/* Plain English Pace Explanation */}
          <div className="text-xs text-slate-600 pt-1 font-medium bg-white/70 p-2.5 rounded-lg border border-slate-200/80">
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
                <strong className="text-emerald-700">{activeResult.workingDaysNeeded} working days</strong> — completing on time within the{' '}
                {mathBreakdown.workingDaysTotal - mathBreakdown.downstreamBufferDays}-day window with safety buffers intact.
              </span>
            )}
          </div>

          {/* Overtime vs Air-Freight ROI Card */}
          {financialExposureRupees > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-emerald-50/80 border border-emerald-200/90 rounded-lg p-2.5 text-emerald-950">
              <div className="flex items-center gap-1.5 font-bold">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Overtime ROI Insight:</span>
              </div>
              <div className="text-right text-emerald-900">
                Authorizing floor overtime (~₹{estOvertimeCost.toLocaleString()}) protects{' '}
                <strong className="text-rose-900 font-extrabold">₹{financialExposureRupees.toLocaleString()}</strong> in buyer late penalties (Net Factory Savings:{' '}
                <strong className="text-emerald-800 font-extrabold">+₹{netRoi.toLocaleString()}</strong>).
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
