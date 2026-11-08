import React from 'react';
import { BuyerProfile, BuyerExportOrder } from './exportService';
import { useLanguage } from '../../hooks/useLanguage';
import {
  Printer,
  X,
  ShieldCheck,
  Building2,
  Sparkles,
  BarChart2,
  PieChart,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export interface StageWeeklyBar {
  week: string;
  pieces: number;
  rate: number;
}

export interface StageTrendMetric {
  stage: string;
  displayName: string;
  currentRate: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
  trendDelta: number;
  weeklyBars: StageWeeklyBar[];
}

export interface WeeklyAIIntelligence {
  headline: string;
  executiveSummary: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  confidenceScore: number;
  keyStrengths: string[];
  keyBottlenecks: string[];
  aiRecommendation: string;
  generatedAt: string;
  week: string;
}

export interface WeeklyThroughputItem {
  week: string;
  targetPcs: number;
  actualPcs: number;
  efficiencyRate: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  buyer: BuyerProfile;
  orders: BuyerExportOrder[];
  selectedWeek?: string;
  metrics?: {
    totalOrders: number;
    activeOrders: number;
    completedOrders: number;
    totalContractedPieces: number;
    onTimeConfidencePercent: number;
  };
  aiIntelligence?: WeeklyAIIntelligence;
  stageTrends?: StageTrendMetric[];
  weeklyThroughput?: WeeklyThroughputItem[];
  milestoneHealth?: {
    onTrack: number;
    minorBuffer: number;
    criticalDeficit: number;
  };
}

export const WeeklyReportPrintModal: React.FC<Props> = ({
  isOpen,
  onClose,
  buyer,
  orders,
  selectedWeek = 'CW 45 (02 Nov - 08 Nov)',
  metrics,
  aiIntelligence,
  stageTrends = [],
  weeklyThroughput = [],
  milestoneHealth,
}) => {
  const { isTa } = useLanguage();
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalContractedPcs =
    metrics?.totalContractedPieces ?? orders.reduce((sum, o) => sum + o.totalQuantity, 0);
  const completedOrders =
    metrics?.completedOrders ?? orders.filter((o) => o.progressPercent >= 100).length;
  const activeOrders = metrics?.activeOrders ?? orders.length - completedOrders;
  const totalMilestones =
    (milestoneHealth?.onTrack || 0) +
    (milestoneHealth?.minorBuffer || 0) +
    (milestoneHealth?.criticalDeficit || 0);

  const onTrackPct =
    totalMilestones > 0
      ? Math.round(((milestoneHealth?.onTrack || 0) / totalMilestones) * 100)
      : (metrics?.onTimeConfidencePercent ?? (orders.length > 0 ? Math.round((completedOrders / orders.length) * 100) : 0));

  const minorBufferPct =
    totalMilestones > 0 ? Math.round(((milestoneHealth?.minorBuffer || 0) / totalMilestones) * 100) : 0;

  const criticalDeficitPct =
    totalMilestones > 0 ? Math.round(((milestoneHealth?.criticalDeficit || 0) / totalMilestones) * 100) : 0;

  const confidenceScore =
    aiIntelligence?.confidenceScore ?? onTrackPct;

  const todayStr = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
      {/* Modal Container */}
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden print:m-0 print:p-0 print:max-w-none print:max-h-none print:shadow-none print:rounded-none">
        {/* Top Control Bar (Hidden during Print) */}
        <div className="p-3 bg-[#0C2D48] text-white flex items-center justify-between border-b border-[#143D60] print:hidden">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-xs sm:text-sm">
              Official Weekly Production & Delivery Report • {buyer.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isTa ? 'அச்சிடு / முழு PDF சேமி' : 'Print / Save Full PDF'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Full Document Body */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-5 text-slate-900 font-sans print:p-4 print:space-y-4">
          {/* 1. Formal Letterhead */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3">
            <div>
              <div className="text-xl font-black tracking-tight text-slate-950 uppercase">
                ThreadFlow Manufacturing Units
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                Cotton Knitwear Export Hub • Tiruppur 641602, Tamil Nadu, India
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                <span>ISO 9001:2015 Certified</span>
                <span>•</span>
                <span>Sedex SMETA Audited Facility</span>
                <span>•</span>
                <span>OEKO-TEX Standard 100</span>
              </div>
            </div>

            <div className="text-right">
              <span className="inline-block px-2.5 py-0.5 rounded bg-[#0C2D48] font-mono font-bold text-xs text-white">
                EXECUTIVE PRODUCTION REPORT
              </span>
              <div className="text-xs text-slate-600 font-bold mt-1">
                Cycle: {selectedWeek}
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                Generated: {todayStr}
              </div>
            </div>
          </div>

          {/* 2. Client & Facility Snapshot KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Foreign Buyer</div>
              <div className="font-bold text-slate-900 mt-0.5 text-sm">{buyer.name}</div>
              <div className="text-slate-500 text-[11px]">{buyer.country || '-'}</div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contracted Pieces</div>
              <div className="font-bold text-slate-900 mt-0.5 font-mono text-sm">
                {totalContractedPcs.toLocaleString()} pcs
              </div>
              <div className="text-slate-500 text-[11px]">{orders.length} Active Export POs</div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Production Status</div>
              <div className="font-bold text-emerald-800 mt-0.5">
                {activeOrders} In-Progress • {completedOrders} Completed
              </div>
              <div className="text-slate-500 text-[11px]">Milestones Monitored Daily</div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Schedule Confidence</div>
              <div className="font-bold text-[#0C2D48] mt-0.5 font-mono text-sm">
                {confidenceScore}% On-Time
              </div>
              <div className="text-slate-500 text-[11px]">{onTrackPct}% Clean Extra</div>
            </div>
          </div>

          {/* 3. AI Executive Analysis & Trend Intelligence */}
          {aiIntelligence && (
            <div className="bg-gradient-to-r from-sky-50/70 to-indigo-50/70 p-4 rounded-xl border border-sky-200 text-xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-sky-200/80 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-sky-700" />
                  <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                    AI Weekly Operational Trend & Schedule Intelligence
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white border border-sky-300 text-sky-900">
                  Risk Level: {aiIntelligence.riskLevel}
                </span>
              </div>

              <div className="font-bold text-slate-900 text-xs">
                {aiIntelligence.headline}
              </div>

              <p className="text-slate-700 leading-relaxed text-[11px]">
                {aiIntelligence.executiveSummary}
              </p>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200">
                  <div className="font-bold text-emerald-900 flex items-center gap-1 text-[11px] mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Key Factory Strengths
                  </div>
                  <ul className="list-disc list-inside text-[10px] text-slate-700 space-y-0.5">
                    {aiIntelligence.keyStrengths.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200">
                  <div className="font-bold text-amber-900 flex items-center gap-1 text-[11px] mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Operational Recommendations
                  </div>
                  <p className="text-[10px] text-slate-700 leading-relaxed">
                    {aiIntelligence.aiRecommendation}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 4. Graphical Analytics Snapshot: Multi-Bar 7-Stage TNA Trend & Schedule Health */}
          <div className="space-y-3">
            {/* Multi-Bar 7-Stage TNA Progress Trend Chart */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-sky-700" />
                  <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                    7-Stage TNA Pipeline Progress Trends (Past 5 Weeks Multi-Bar Comparison)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-xs bg-slate-400" /> W41
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-xs bg-sky-300" /> W42
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-xs bg-sky-400" /> W43
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-xs bg-sky-600" /> W44
                  </span>
                  <span className="inline-flex items-center gap-1 font-bold text-[#0C2D48]">
                    <span className="w-2 h-2 rounded-xs bg-[#0C2D48]" /> W45 (Now)
                  </span>
                </div>
              </div>

              {/* 7 Columns: 1 for each Stage */}
              <div className="grid grid-cols-7 gap-2">
                {stageTrends.map((stage) => {
                  const barColors = [
                    'bg-slate-400',
                    'bg-sky-300',
                    'bg-sky-400',
                    'bg-sky-600',
                    'bg-[#0C2D48]',
                  ];

                  return (
                    <div
                      key={stage.stage}
                      className="bg-white p-2 rounded-lg border border-slate-200 flex flex-col justify-between"
                    >
                      <div className="text-center mb-1">
                        <div className="text-[10px] font-bold text-slate-800 truncate" title={stage.displayName}>
                          {stage.displayName}
                        </div>
                        <div className="text-[10px] font-black font-mono text-[#0C2D48]">
                          {stage.currentRate}%
                        </div>
                      </div>

                      {/* Multi-Bar Group for 5 Weeks */}
                      <div className="h-20 flex items-end justify-between gap-0.5 px-1 py-0.5 bg-slate-50 border border-slate-200 rounded">
                        {stage.weeklyBars?.map((bar, barIdx) => (
                          <div
                            key={bar.week}
                            className="flex-1 flex flex-col items-center justify-end h-full"
                          >
                            <div
                              className={`w-full rounded-t-xs ${barColors[barIdx] || 'bg-sky-600'}`}
                              style={{ height: `${Math.max(8, bar.rate)}%` }}
                              title={`${bar.week}: ${bar.rate}%`}
                            />
                            <span className="text-[7px] font-mono text-slate-500 mt-0.5 scale-90">
                              {bar.week.replace('CW ', 'W')}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="text-[9px] text-center font-bold font-mono mt-1 text-slate-600">
                        {stage.trend === 'UP' ? '▲ +' : stage.trend === 'DOWN' ? '▼ ' : '— '}{stage.trendDelta}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Delivery Schedule Health & Weekly Factory Throughput Velocity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Throughput Velocity */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center justify-between">
                  <span>Factory Throughput Velocity</span>
                  <span className="font-mono text-[10px] text-sky-700 font-bold">{totalContractedPcs.toLocaleString()} pcs</span>
                </div>
                <div className="space-y-1.5 pt-1">
                  {weeklyThroughput.map((wt) => (
                    <div key={wt.week} className="space-y-0.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-mono font-bold text-slate-700">{wt.week}</span>
                        <span className="font-mono text-slate-600">
                          {wt.actualPcs.toLocaleString()} / {wt.targetPcs.toLocaleString()} ({wt.efficiencyRate}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            wt.efficiencyRate >= 90 ? 'bg-emerald-500' : wt.efficiencyRate >= 70 ? 'bg-sky-600' : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(100, wt.efficiencyRate)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery Schedule Health Breakdown with SVG Donut Chart */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 flex flex-col justify-between">
                <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1">
                  <PieChart className="w-3.5 h-3.5 text-emerald-700" />
                  Delivery Schedule Health Status
                </div>

                <div className="flex items-center justify-around my-auto py-1">
                  {/* Compact SVG Donut Chart */}
                  {(() => {
                    const cx = 50;
                    const cy = 50;
                    const rOuter = 40;
                    const rInner = 24;
                    const total = onTrackPct + minorBufferPct + criticalDeficitPct || 100;
                    const a1 = (onTrackPct / total) * 360;
                    const a2 = a1 + (minorBufferPct / total) * 360;
                    const a3 = 360;

                    const polarToCartesian = (angleDeg: number, r: number) => {
                      const rad = ((angleDeg - 90) * Math.PI) / 180.0;
                      return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
                    };

                    const makeArc = (startDeg: number, endDeg: number) => {
                      const sweep = Math.min(endDeg - startDeg, 359.99);
                      if (sweep <= 0.5) return '';
                      const actualEnd = startDeg + sweep;
                      const p1 = polarToCartesian(startDeg, rOuter);
                      const p2 = polarToCartesian(actualEnd, rOuter);
                      const p3 = polarToCartesian(actualEnd, rInner);
                      const p4 = polarToCartesian(startDeg, rInner);
                      const largeArc = sweep > 180 ? 1 : 0;
                      return `M ${p1.x} ${p1.y} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x} ${p4.y} Z`;
                    };

                    return (
                      <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                          <path d={makeArc(0, a1)} fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />
                          <path d={makeArc(a1, a2)} fill="#F59E0B" stroke="#FFFFFF" strokeWidth="2" />
                          <path d={makeArc(a2, a3)} fill="#F43F5E" stroke="#FFFFFF" strokeWidth="2" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-[11px] font-black font-mono text-slate-900">{onTrackPct}%</span>
                          <span className="text-[7px] text-slate-500 font-bold uppercase">On Track</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Pills */}
                  <div className="space-y-1.5 text-[10px]">
                    <div className="px-2 py-1 rounded-md bg-emerald-100/70 text-emerald-900 font-bold flex items-center justify-between gap-2">
                      <span>On Track:</span>
                      <span className="font-mono">{onTrackPct}%</span>
                    </div>
                    <div className="px-2 py-1 rounded-md bg-amber-100/70 text-amber-900 font-bold flex items-center justify-between gap-2">
                      <span>Minor Extra:</span>
                      <span className="font-mono">{minorBufferPct}%</span>
                    </div>
                    <div className="px-2 py-1 rounded-md bg-rose-100/70 text-rose-900 font-bold flex items-center justify-between gap-2">
                      <span>Critical:</span>
                      <span className="font-mono">{criticalDeficitPct}%</span>
                    </div>
                  </div>
                </div>

                <div className="text-[9px] text-slate-500 text-center border-t border-slate-200 pt-1">
                  Factory Weighted Pace: {confidenceScore}% confidence to hit ship window.
                </div>
              </div>
            </div>
          </div>

          {/* 5. Purchase Orders Status Table */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
              Active Export Purchase Orders & TNA Milestones ({orders.length})
            </h4>

            <div className="border border-slate-300 rounded-xl overflow-hidden">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-[#0C2D48] text-white font-bold uppercase text-[9px] tracking-wider">
                  <tr>
                    <th className="py-2 px-2.5 border-r border-[#143D60]">PO Number</th>
                    <th className="py-2 px-2.5 border-r border-[#143D60]">Style Description</th>
                    <th className="py-2 px-2 text-right border-r border-[#143D60]">Qty (pcs)</th>
                    <th className="py-2 px-2 border-r border-[#143D60]">Ex-Factory</th>
                    <th className="py-2 px-2 border-r border-[#143D60]">Active Stage</th>
                    <th className="py-2 px-2 text-center border-r border-[#143D60]">Progress</th>
                    <th className="py-2 px-3">Confirmed Delivery Directives</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {orders.map((o) => (
                    <tr key={o.id} className="even:bg-slate-50 odd:bg-white">
                      <td className="py-1.5 px-2.5 font-mono font-bold text-slate-900 border-r border-slate-300">
                        {o.poNumber}
                      </td>
                      <td className="py-1.5 px-2.5 font-medium text-slate-800 border-r border-slate-300">
                        {o.style}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900 border-r border-slate-300">
                        {o.totalQuantity.toLocaleString()}
                      </td>
                      <td className="py-1.5 px-2 whitespace-nowrap text-slate-700 border-r border-slate-300">
                        {new Date(o.exFactoryDate).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                        <span className="text-[9px] text-slate-500 block">
                          ({o.daysToExFactory}d left)
                        </span>
                      </td>
                      <td className="py-1.5 px-2 font-semibold text-slate-800 border-r border-slate-300 capitalize">
                        {o.activeStage.replace(/_/g, ' ')}
                      </td>
                      <td className="py-1.5 px-2 text-center font-mono font-bold border-r border-slate-300">
                        {o.progressPercent}%
                      </td>
                      <td className="py-1.5 px-3 text-[10px] text-slate-700 leading-snug">
                        {o.confirmedAlerts.map((a) => a.mitigationPlan).filter(Boolean).join(' • ') ||
                          o.latestDailyLog?.notes ||
                          'Floor schedule on-track for vessel cut-off.'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 6. Executive Sign-Off Block */}
          <div className="pt-4 border-t-2 border-slate-800 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
              Executive Review & Quality Verification Sign-Off
            </div>

            <div className="grid grid-cols-3 gap-6 pt-2 text-xs">
              <div className="space-y-6">
                <div className="border-b border-slate-400 pb-1 text-slate-400 italic text-[10px]">
                  Sign & Date
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-xs">Factory General Manager</div>
                  <div className="text-[10px] text-slate-500">Manufacturing Operations</div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="border-b border-slate-400 pb-1 text-slate-400 italic text-[10px]">
                  Sign & Date
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-xs">Lead Merchandiser</div>
                  <div className="text-[10px] text-slate-500">TNA Planning & Buyer Dispatch</div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="border-b border-slate-400 pb-1 text-slate-400 italic text-[10px]">
                  Sign & Date
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-xs">Quality Assurance Head</div>
                  <div className="text-[10px] text-slate-500">Sedex SMETA Compliance</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
