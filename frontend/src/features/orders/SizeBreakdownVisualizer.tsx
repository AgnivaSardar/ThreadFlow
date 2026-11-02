import React from 'react';
import { SizeProgress } from '../../types';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

interface SizeBreakdownVisualizerProps {
  sizeProgress: SizeProgress[];
  hasSkewWarning: boolean;
  totalPlanned: number;
  totalCompleted: number;
  overallCompletionPct: number;
}

const SIZE_PALETTE = ['#0284C7', '#4F46E5', '#0D9488', '#D97706', '#9333EA', '#EC4899'];

export const SizeBreakdownVisualizer: React.FC<SizeBreakdownVisualizerProps> = ({
  sizeProgress,
  hasSkewWarning,
  totalPlanned,
  totalCompleted,
  overallCompletionPct,
}) => {
  // SVG Donut Calculations for Size Distribution
  const R = 80;
  const C = 2 * Math.PI * R; // ~502.65

  // Calculate cumulative slice offsets
  let cumulativePct = 0;
  const slices = sizeProgress.map((sp, idx) => {
    const fraction = totalPlanned > 0 ? sp.plannedQty / totalPlanned : 0;
    const strokeDash = fraction * C;
    const offset = -(cumulativePct * C);
    cumulativePct += fraction;
    const color = SIZE_PALETTE[idx % SIZE_PALETTE.length];

    return {
      ...sp,
      colorHex: color,
      fraction,
      strokeDash,
      offset,
    };
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <h3 className="text-base font-bold text-slate-800">Size Ratio & Completion</h3>
          {hasSkewWarning ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
              <AlertTriangle className="w-3.5 h-3.5" /> Ratio Skew Alert
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" /> Balanced Ratio
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <span className="text-slate-400">Total Completion:</span>
          <span className="font-mono text-sm font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg">
            {totalCompleted.toLocaleString()} / {totalPlanned.toLocaleString()} pcs ({overallCompletionPct}%)
          </span>
        </div>
      </div>

      {/* Graphs Grid: Left Donut Chart | Right Progress Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Side: Size Distribution Donut Chart (5 cols) */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center">
          <div className="relative w-56 h-56 flex items-center justify-center select-none">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 200 200">
              {/* Background Circle */}
              <circle cx="100" cy="100" r={R} fill="none" stroke="#F1F5F9" strokeWidth="22" />

              {/* Slices */}
              {slices.map((slice) => (
                <circle
                  key={slice.id}
                  cx="100"
                  cy="100"
                  r={R}
                  fill="none"
                  stroke={slice.isSkewed ? '#EF4444' : slice.colorHex}
                  strokeWidth={22}
                  strokeDasharray={`${slice.strokeDash} ${C - slice.strokeDash}`}
                  strokeDashoffset={slice.offset}
                  className="transition-all duration-300"
                />
              ))}
            </svg>

            {/* Donut Center */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total Planned
              </span>
              <span className="text-2xl font-mono font-black text-slate-900 my-0.5">
                {totalPlanned.toLocaleString()}
              </span>
              <span className="text-[10px] font-semibold text-slate-500">
                {sizeProgress.length} Size Ratios
              </span>
            </div>
          </div>

          {/* Size Legends */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-3">
            {slices.map((slice) => (
              <div key={slice.id} className="flex items-center gap-1.5 text-xs text-slate-700">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: slice.isSkewed ? '#EF4444' : slice.colorHex }}
                />
                <span className="font-bold">{slice.size}</span>
                <span className="text-[11px] text-slate-400 font-mono">
                  ({Math.round(slice.fraction * 100)}%)
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Size Completion Progress Matrix (7 cols) */}
        <div className="lg:col-span-7 space-y-3.5">
          {slices.map((sp) => (
            <div
              key={sp.id}
              className={`p-3.5 rounded-xl border transition-all ${
                sp.isSkewed
                  ? 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-400/20'
                  : 'bg-slate-50/70 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="w-6 h-6 rounded-lg text-white font-mono text-xs font-bold flex items-center justify-center shadow-2xs"
                    style={{ backgroundColor: sp.isSkewed ? '#EF4444' : sp.colorHex }}
                  >
                    {sp.size}
                  </span>
                  <span className="text-xs font-semibold text-slate-800">{sp.color}</span>
                  {sp.isSkewed && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-200/80 text-rose-900">
                      Deficit -{sp.lagDeficit}%
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="font-bold text-slate-800">{sp.completionPct}%</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    backgroundColor: sp.isSkewed ? '#EF4444' : sp.colorHex,
                    width: `${Math.min(100, sp.completionPct)}%`,
                  }}
                ></div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium mt-1">
                <span>Completed</span>
                <span className="font-mono text-slate-700">
                  {sp.completedQty.toLocaleString()} / {sp.plannedQty.toLocaleString()} pcs
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
