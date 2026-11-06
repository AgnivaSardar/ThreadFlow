import React, { useState } from 'react';
import { TnaMilestone, Stage } from '../../types';
import { useLanguage } from '../../hooks/useLanguage';
import { translateStage } from '../supervisor/supervisorTranslations';
import {
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  Scissors,
  CheckCheck,
  Package,
  Droplets,
  AlertTriangle,
  CircleDot,
  Calendar,
  ChevronRight,
} from 'lucide-react';

interface CircularTnaPipelineProps {
  milestones: TnaMilestone[];
  currentStage?: Stage;
}

const STAGE_METADATA: Record<
  Stage,
  { label: string; department: string; icon: React.ReactNode; color: string }
> = {
  KNITTING: {
    label: 'Knitting',
    department: 'Yarn to Greige Fabric',
    icon: <Layers className="w-4 h-4" />,
    color: '#0284C7', // sky-600
  },
  DYEING_WASHING: {
    label: 'Dyeing & Washing',
    department: 'Wet Processing & Softening',
    icon: <Droplets className="w-4 h-4" />,
    color: '#4F46E5', // indigo-600
  },
  PRINTING: {
    label: 'Printing & Embroidery',
    department: 'Chest Prints & Badges',
    icon: <Sparkles className="w-4 h-4" />,
    color: '#9333EA', // purple-600
  },
  CUTTING: {
    label: 'Fabric Cutting',
    department: 'Pattern Lay & Bundle Prep',
    icon: <Scissors className="w-4 h-4" />,
    color: '#D97706', // amber-600
  },
  STITCHING: {
    label: 'Assembly & Stitching',
    department: 'Sewing Lines & Assembly',
    icon: <CircleDot className="w-4 h-4" />,
    color: '#059669', // emerald-600
  },
  CHECKING: {
    label: 'Quality Checking',
    department: 'Inline & Needle Inspection',
    icon: <CheckCheck className="w-4 h-4" />,
    color: '#0D9488', // teal-600
  },
  FINISHING: {
    label: 'Finishing & Packing',
    department: 'Steam Iron & Carton Packing',
    icon: <Package className="w-4 h-4" />,
    color: '#2563EB', // blue-600
  },
};

export const CircularTnaPipeline: React.FC<CircularTnaPipelineProps> = ({
  milestones,
  currentStage,
}) => {
  const { lang, isTa, t } = useLanguage();
  const sorted = [...milestones].sort((a, b) => a.sequenceOrder - b.sequenceOrder);

  const getDepartment = (stage: Stage) => {
    if (lang === 'ta') {
      const deptsTa: Record<Stage, string> = {
        KNITTING: 'நூல் முதல் துணி பின்னல்',
        DYEING_WASHING: 'சலவை & மென்மையாக்குதல்',
        PRINTING: 'மார்பு அச்சு & எம்பிராய்டரி',
        CUTTING: 'பேட்டர்ன் & துணி வெட்டுதல்',
        STITCHING: 'தையல் லைன்கள் & அசெம்பிளி',
        CHECKING: 'இன்லைன் தர பரிசோதனை',
        FINISHING: 'அயர்னிங் & கார்ட்டன் பேக்கிங்',
      };
      return deptsTa[stage] || stage;
    }
    return STAGE_METADATA[stage]?.department || stage;
  };

  // Default selected stage to active stage or first milestone
  const activeIndex = sorted.findIndex((m) => m.stage === currentStage);
  const initialIndex = activeIndex >= 0 ? activeIndex : 0;
  const [selectedIndex, setSelectedIndex] = useState<number>(initialIndex);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const displayIndex = hoveredIndex !== null ? hoveredIndex : selectedIndex;
  const selectedMilestone = sorted[displayIndex] || sorted[0];
  const selectedMeta = selectedMilestone
    ? STAGE_METADATA[selectedMilestone.stage]
    : STAGE_METADATA.KNITTING;

  // Total completed vs target
  const totalCompletedPieces = sorted.reduce((sum, m) => sum + m.completedQuantity, 0);
  const totalTargetPieces = sorted.reduce((sum, m) => sum + m.targetQuantity, 0);
  const overallAvgPct =
    totalTargetPieces > 0 ? Math.round((totalCompletedPieces / totalTargetPieces) * 100) : 0;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  // Dynamic count of stages (e.g. 7 stages for printed styles, 6 stages for solid/unprinted garments)
  const totalStages = sorted.length || 7;
  const hasPrintingStage = sorted.some((m) => m.stage === 'PRINTING');

  // Math for SVG Circular Gauge with distinct gap and separators adapting to stage count
  const R = 105;
  const C = 2 * Math.PI * R; // ~659.73
  const gapPx = 8;
  const segmentLength = (C / totalStages) - gapPx;

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
      {/* Header (Responsive on Mobile) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 sm:pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            {totalStages}-{t.tnaPipeline.title}
          </h3>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
            {hasPrintingStage ? t.tnaPipeline.includesPrint : t.tnaPipeline.printSkipped}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-[11px] sm:text-xs font-semibold text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> {t.tnaPipeline.completed}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> {t.tnaPipeline.inProgress}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-200"></span> {t.tnaPipeline.pending}
          </span>
        </div>
      </div>

      {/* Main Grid: Radial Donut + Detailed Inspection Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-6">
        {/* Left Side: Circular Donut (Takes 5 cols on lg) */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
          <div className="relative w-64 h-64 flex items-center justify-center select-none">
            <svg
              className="w-full h-full -rotate-90 transform"
              viewBox="0 0 260 260"
            >
              {/* Background Track Circle */}
              <circle
                cx="130"
                cy="130"
                r={R}
                fill="none"
                stroke="#F1F5F9"
                strokeWidth="20"
              />

              {/* Segment Arcs */}
              {sorted.map((ms, idx) => {
                const pct =
                  ms.targetQuantity > 0
                    ? Math.min(100, Math.round((ms.completedQuantity / ms.targetQuantity) * 100))
                    : 0;
                const isCompleted = pct >= 100;
                const isActive = ms.stage === currentStage;
                const isSelected = selectedIndex === idx;
                const isHovered = hoveredIndex === idx;

                let strokeColor = '#E2E8F0'; // Pending
                if (ms.isCriticalPathBottleneck) {
                  strokeColor = '#EF4444'; // Red Bottleneck
                } else if (isCompleted) {
                  strokeColor = '#10B981'; // Completed
                } else if (isActive || pct > 0) {
                  strokeColor = '#F59E0B'; // In Progress
                }

                // Calculate dash offset adapting dynamically to total stage count
                const dashOffset = -(idx * (C / totalStages)) - (gapPx / 2);

                return (
                  <circle
                    key={ms.id || ms.stage}
                    cx="130"
                    cy="130"
                    r={R}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isSelected ? 26 : isHovered ? 24 : 20}
                    strokeDasharray={`${segmentLength} ${C - segmentLength}`}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    onClick={() => setSelectedIndex(idx)}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    className="cursor-pointer transition-all duration-200 hover:opacity-90"
                    style={{
                      filter: isSelected
                        ? 'drop-shadow(0 0 8px rgba(12, 45, 72, 0.35))'
                        : isHovered
                        ? 'drop-shadow(0 0 5px rgba(2, 132, 199, 0.3))'
                        : 'none',
                    }}
                  />
                );
              })}

              {/* Crisp Radial White Dividers radiating between every stage */}
              {Array.from({ length: totalStages }).map((_, i) => {
                const angleDeg = (i * 360) / totalStages;
                const angleRad = (angleDeg * Math.PI) / 180;
                const rInner = R - 13;
                const rOuter = R + 13;
                const x1 = 130 + rInner * Math.cos(angleRad);
                const y1 = 130 + rInner * Math.sin(angleRad);
                const x2 = 130 + rOuter * Math.cos(angleRad);
                const y2 = 130 + rOuter * Math.sin(angleRad);

                return (
                  <line
                    key={`divider-${i}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#FFFFFF"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    className="pointer-events-none"
                  />
                );
              })}
            </svg>

            {/* Inner Circular Hub Details (pointer-events-none so hover/clicks pass to SVG) */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 pointer-events-none">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {isTa ? 'பைப்லைன் நலம்' : 'Pipeline Health'}
              </span>
              <span className="text-3xl font-mono font-black text-slate-900 tracking-tight my-0.5">
                {overallAvgPct}%
              </span>
              <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">
                {isTa ? `நிலை ${selectedMilestone?.sequenceOrder || 1} / ${totalStages}` : `Stage ${selectedMilestone?.sequenceOrder || 1} of ${totalStages}`}
              </span>
              <span className="text-[11px] font-semibold text-slate-600 mt-1 max-w-[140px] truncate">
                {translateStage(selectedMilestone.stage, lang)}
              </span>
            </div>
          </div>

          <span className="text-[11px] text-slate-400 mt-2 font-medium">
            {hoveredIndex !== null ? (
              <span className="text-sky-700 font-semibold">{isTa ? 'இந்த நிலையைக் காண கிளிக் செய்க' : 'Click to inspect this stage'}</span>
            ) : (
              isTa ? 'முன்னேற்றத்தைக் காண ஏதேனும் பகுதியைத் தேர்ந்தெடுக்கவும்' : 'Click any segment to inspect stage lead time & progress'
            )}
          </span>
        </div>

        {/* Right Side: Active Stage Detail & Lead Time Card (Takes 7 cols on lg) */}
        <div className="lg:col-span-7 bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-200/80">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0"
                style={{ backgroundColor: selectedMeta.color }}
              >
                {selectedMeta.icon}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded shrink-0">
                    {isTa ? `நிலை ${selectedMilestone.sequenceOrder}` : `Stage ${selectedMilestone.sequenceOrder}`}
                  </span>
                  <h4 className="text-base font-bold text-slate-900 truncate">{translateStage(selectedMilestone.stage, lang)}</h4>
                </div>
                <div className="text-xs text-slate-500 truncate">{getDepartment(selectedMilestone.stage)}</div>
              </div>
            </div>

            <div className="self-start sm:self-auto shrink-0">
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full inline-block ${
                  selectedMilestone.bufferDaysAhead > 0
                    ? 'bg-sky-100 text-sky-800 border border-sky-200'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {selectedMilestone.bufferDaysAhead}{isTa ? ' நாள் இடைவெளி ஒதுக்கப்பட்டது' : 'd Buffer Reserved'}
              </span>
            </div>
          </div>

          {/* Progress Bar & Piece Counter */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-700">{isTa ? 'நிலை வெளியீடு நிறைவு' : 'Stage Output Completion'}</span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {selectedMilestone.targetQuantity > 0
                  ? Math.min(100, Math.round((selectedMilestone.completedQuantity / selectedMilestone.targetQuantity) * 100))
                  : 0}
                %
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  backgroundColor: selectedMeta.color,
                  width: `${
                    selectedMilestone.targetQuantity > 0
                      ? Math.min(100, Math.round((selectedMilestone.completedQuantity / selectedMilestone.targetQuantity) * 100))
                      : 0
                  }%`,
                }}
              ></div>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium mt-1.5">
              <span>{isTa ? 'முடிந்த துண்டுகள்' : 'Completed Pieces'}</span>
              <span className="font-mono font-bold text-slate-800">
                {selectedMilestone.completedQuantity.toLocaleString()} /{' '}
                {selectedMilestone.targetQuantity.toLocaleString()} {t.common.pieces}
              </span>
            </div>
          </div>

          {/* Window & Buffer Details */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
              <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> {isTa ? 'திட்டமிடப்பட்ட காலம்' : 'Planned Window'}
              </div>
              <div className="text-xs font-bold text-slate-800">
                {formatDate(selectedMilestone.plannedStart)} – {formatDate(selectedMilestone.plannedEnd)}
              </div>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
              <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> {isTa ? 'அடுத்த கட்ட பாதுகாப்பு' : 'Downstream Protection'}
              </div>
              <div className="text-xs font-bold text-slate-800">
                {selectedMilestone.bufferDaysAhead} {isTa ? 'வேலை நாட்கள் முன்னணி நேரம்' : 'Working Days Lead Time'}
              </div>
            </div>
          </div>

          {/* Critical Path Warning if this stage is compressed */}
          {selectedMilestone.isCriticalPathBottleneck && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                {isTa
                  ? `அட்டவணை தாமதம்: இடைவெளி ${selectedMilestone.bufferCompressionDays} வேலை நாட்கள் குறைக்கப்பட்டது.`
                  : `Schedule Overrun: Buffer compressed by ${selectedMilestone.bufferCompressionDays} working days.`}
              </span>
            </div>
          )}

          {/* Quick Segment Selector Buttons */}
          <div className="pt-2 border-t border-slate-200/80">
            <div className="text-[10px] uppercase font-bold text-slate-400 mb-2 tracking-wider">
              {isTa ? 'பார்வையிட வேண்டிய கட்டத்தைத் தேர்ந்தெடுக்கவும்' : 'Select Stage to Inspect'}
            </div>
            <div
              className="grid gap-1.5"
              style={{ gridTemplateColumns: `repeat(${totalStages}, minmax(0, 1fr))` }}
            >
              {sorted.map((m, idx) => {
                const isSelected = selectedIndex === idx;
                const pct =
                  m.targetQuantity > 0
                    ? Math.min(100, Math.round((m.completedQuantity / m.targetQuantity) * 100))
                    : 0;
                const stageMeta = STAGE_METADATA[m.stage];
                return (
                  <button
                    key={m.id || m.stage}
                    type="button"
                    onClick={() => setSelectedIndex(idx)}
                    title={`${m.sequenceOrder}. ${stageMeta?.label || m.stage} (${pct}%)`}
                    className={`py-1.5 px-1 rounded-lg text-xs font-bold flex flex-col items-center justify-center transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#0C2D48] text-white shadow-xs ring-2 ring-[#0C2D48]/30'
                        : pct >= 100
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                        : m.stage === currentStage
                        ? 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>{idx + 1}</span>
                    <span className="text-[9px] font-mono font-normal">{pct}%</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
