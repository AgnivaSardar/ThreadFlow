import React from 'react';
import { BuyerProfile, BuyerExportOrder } from './exportService';
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
  const confidenceScore =
    aiIntelligence?.confidenceScore ?? metrics?.onTimeConfidencePercent ?? 67;

  const onTrackPct = milestoneHealth?.onTrack ?? 84;
  const minorBufferPct = milestoneHealth?.minorBuffer ?? 12;
  const criticalDeficitPct = milestoneHealth?.criticalDeficit ?? 4;

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
              <span>Print / Save Full PDF</span>
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
                Company A Manufacturing Units
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
              <div className="text-slate-500 text-[11px]">{buyer.country || 'Europe'}</div>
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
              <div className="text-slate-500 text-[11px]">{onTrackPct}% Clean Buffer</div>
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

          {/* 4. Graphical Analytics Snapshot: 7-Stage TNA Progress & Health */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* 7-Stage TNA Milestone Rates */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
              <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1">
                <BarChart2 className="w-3.5 h-3.5 text-sky-700" />
                7-Stage TNA Milestone Rates
              </div>
              <div className="space-y-1.5 pt-1">
                {stageTrends.slice(0, 5).map((st) => (
                  <div key={st.stage} className="space-y-0.5">
                    <div className="flex justify-between text-[10px] font-semibold text-slate-700">
                      <span>{st.displayName}</span>
                      <span className="font-mono">{st.currentRate}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sky-600 rounded-full"
                        style={{ width: `${Math.min(100, st.currentRate)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery Schedule Health Breakdown */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 flex flex-col justify-between">
              <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1">
                <PieChart className="w-3.5 h-3.5 text-emerald-700" />
                Delivery Schedule Health Status
              </div>

              <div className="grid grid-cols-3 gap-2 text-center my-auto">
                <div className="p-2 rounded-lg bg-emerald-100/60 border border-emerald-200">
                  <div className="text-[10px] font-bold text-emerald-900">On Track</div>
                  <div className="text-base font-black font-mono text-emerald-800">{onTrackPct}%</div>
                  <div className="text-[9px] text-emerald-700">Clean Buffer</div>
                </div>

                <div className="p-2 rounded-lg bg-amber-100/60 border border-amber-200">
                  <div className="text-[10px] font-bold text-amber-900">Minor Buffer</div>
                  <div className="text-base font-black font-mono text-amber-800">{minorBufferPct}%</div>
                  <div className="text-[9px] text-amber-700">&lt; 3d Buffer</div>
                </div>

                <div className="p-2 rounded-lg bg-rose-100/60 border border-rose-200">
                  <div className="text-[10px] font-bold text-rose-900">Critical</div>
                  <div className="text-base font-black font-mono text-rose-800">{criticalDeficitPct}%</div>
                  <div className="text-[9px] text-rose-700">Intervention</div>
                </div>
              </div>

              <div className="text-[10px] text-slate-500 text-center border-t border-slate-200 pt-1">
                Factory Weighted Pace: {confidenceScore}% confidence to hit ship window.
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
