import React from 'react';
import { TnaMilestone, Stage } from '../../types';
import {
  CheckCircle2,
  Clock,
  CircleDot,
  Layers,
  Sparkles,
  Scissors,
  CheckCheck,
  Package,
  Droplets,
} from 'lucide-react';

interface TnaTimelineProps {
  milestones: TnaMilestone[];
  currentStage?: Stage;
}

const STAGE_METADATA: Record<
  Stage,
  { label: string; short: string; icon: React.ReactNode; color: string }
> = {
  KNITTING: {
    label: 'Knitting',
    short: 'Yarn to Greige',
    icon: <Layers className="w-4 h-4" />,
    color: 'sky',
  },
  DYEING_WASHING: {
    label: 'Dyeing & Washing',
    short: 'Color & Softening',
    icon: <Droplets className="w-4 h-4" />,
    color: 'indigo',
  },
  PRINTING: {
    label: 'Printing & Embroidery',
    short: 'Chest Prints & Badges',
    icon: <Sparkles className="w-4 h-4" />,
    color: 'purple',
  },
  CUTTING: {
    label: 'Fabric Cutting',
    short: 'Pattern Lay & Bundle',
    icon: <Scissors className="w-4 h-4" />,
    color: 'amber',
  },
  STITCHING: {
    label: 'Assembly & Stitching',
    short: 'Line Sewing',
    icon: <CircleDot className="w-4 h-4" />,
    color: 'emerald',
  },
  CHECKING: {
    label: 'Quality Checking',
    short: 'Inline & Needle Check',
    icon: <CheckCheck className="w-4 h-4" />,
    color: 'teal',
  },
  FINISHING: {
    label: 'Finishing & Packing',
    short: 'Steam Iron & Carton',
    icon: <Package className="w-4 h-4" />,
    color: 'blue',
  },
};

export const TnaTimeline: React.FC<TnaTimelineProps> = ({ milestones, currentStage }) => {
  const sorted = [...milestones].sort((a, b) => a.sequenceOrder - b.sequenceOrder);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            7-Stage Time & Action (TNA) Milestone Pipeline
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Synchronized stage throughput, buffer lead times, and downstream buffer protection
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Completed (100%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> In Progress
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-200"></span> Pending
          </span>
        </div>
      </div>

      {/* Horizontal Stepper Grid */}
      <div className="overflow-x-auto pb-4 pt-1">
        <div className="flex items-stretch min-w-[980px] gap-2">
          {sorted.map((ms, idx) => {
            const meta = STAGE_METADATA[ms.stage] || {
              label: ms.stage,
              short: 'Stage',
              icon: <CircleDot className="w-4 h-4" />,
              color: 'slate',
            };

            const pct = ms.targetQuantity > 0 ? Math.min(100, Math.round((ms.completedQuantity / ms.targetQuantity) * 100)) : 0;
            const isCompleted = pct >= 100;
            const isActive = ms.stage === currentStage || (!isCompleted && (idx === 0 || sorted[idx - 1]?.completedQuantity >= sorted[idx - 1]?.targetQuantity));

            return (
              <div key={ms.id || ms.stage} className="flex-1 flex flex-col relative group">
                {/* Connecting arrow if not last */}
                {idx < sorted.length - 1 && (
                  <div className="hidden lg:block absolute -right-2 top-6 z-10 w-4 h-0.5 bg-slate-200"></div>
                )}

                <div
                  className={`flex flex-col h-full rounded-xl p-3.5 border transition-all ${
                    ms.isCriticalPathBottleneck
                      ? 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-400/50 text-slate-800'
                      : isCompleted
                      ? 'bg-emerald-50/60 border-emerald-200 text-slate-800'
                      : isActive
                      ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-400/30 text-slate-800'
                      : 'bg-slate-50/80 border-slate-200 text-slate-600'
                  }`}
                >
                  {/* Sequence & Stage Header */}
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        ms.isCriticalPathBottleneck
                          ? 'bg-rose-600 text-white animate-pulse'
                          : isCompleted
                          ? 'bg-emerald-600 text-white'
                          : isActive
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : ms.sequenceOrder}
                    </span>

                    {ms.isCriticalPathBottleneck && (ms.bufferCompressionDays || 0) > 0 ? (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1"
                        title={`Buffer compressed by ${ms.bufferCompressionDays} working days`}
                      >
                        -{ms.bufferCompressionDays}d buffer
                      </span>
                    ) : (
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          ms.bufferDaysAhead > 0
                            ? 'bg-sky-100 text-sky-800 border border-sky-200'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                        title={`${ms.bufferDaysAhead} downstream buffer days reserved for subsequent processes`}
                      >
                        {ms.bufferDaysAhead}d buffer
                      </span>
                    )}
                  </div>

                  {/* Stage Title */}
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-slate-500">{meta.icon}</span>
                    <span className="text-xs font-bold leading-tight truncate" title={meta.label}>
                      {meta.label}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mb-3 truncate">{meta.short}</div>

                  {/* Date range */}
                  <div className="mt-auto pt-2 border-t border-slate-200/60 text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        Window:
                      </span>
                      <span className="font-medium text-slate-700">
                        {formatDate(ms.plannedStart)} – {formatDate(ms.plannedEnd)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-500">
                      <span>Tally:</span>
                      <span className="font-semibold text-slate-800 font-mono text-[10px]">
                        {ms.completedQuantity.toLocaleString()} / {ms.targetQuantity.toLocaleString()}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isCompleted ? 'bg-emerald-500' : isActive ? 'bg-amber-500' : 'bg-slate-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] pt-1 font-medium">
                      <span className="text-slate-400">Progress</span>
                      <span className={isCompleted ? 'text-emerald-700 font-bold' : isActive ? 'text-amber-700 font-bold' : 'text-slate-500'}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
