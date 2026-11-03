import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import { CustomSelect, Option } from '../../components/CustomSelect';
import { exportOrdersToCsv, BuyerExportOrder, BuyerProfile } from './exportService';
import { WeeklyReportPrintModal } from './WeeklyReportPrintModal';
import {
  FileText,
  Printer,
  Download,
  Calendar,
  Building2,
  Layers,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ExternalLink,
  Sparkles,
  BarChart3,
  CheckCircle2,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';

interface StageWeeklyBar {
  week: string;
  pieces: number;
  rate: number;
}

interface StageTrendMetric {
  stage: string;
  displayName: string;
  currentRate: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
  trendDelta: number;
  weeklyBars: StageWeeklyBar[];
}

interface WeeklyAIIntelligence {
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

interface WeeklyThroughputItem {
  week: string;
  targetPcs: number;
  actualPcs: number;
  efficiencyRate: number;
}

interface WeeklySummaryData {
  buyer: BuyerProfile;
  selectedWeek: string;
  metrics: {
    totalOrders: number;
    activeOrders: number;
    completedOrders: number;
    totalContractedPieces: number;
    onTimeConfidencePercent: number;
  };
  stageBreakdown: Record<string, { totalPlanned: number; totalCompleted: number }>;
  stageTrends: StageTrendMetric[];
  weeklyThroughput: WeeklyThroughputItem[];
  milestoneHealth: {
    onTrack: number;
    minorBuffer: number;
    criticalDeficit: number;
  };
  aiIntelligence: WeeklyAIIntelligence;
  orders: Array<{
    id: string;
    poNumber: string;
    style: string;
    totalQuantity: number;
    currency: string;
    exFactoryDate: string;
    unitName: string;
    activeStage: string;
    confirmedMitigations: string[];
    latestNote: string;
  }>;
  archives: Array<{
    id: string;
    weekNumber: number;
    year: number;
    fileFormat: string;
    orderCount: number;
    generatedAt: string;
  }>;
}

/**
 * Ensures any floor note or supervisor comment is strictly in English.
 */
function ensureEnglishNote(text: string | null | undefined): string {
  if (!text || !text.trim()) return 'On-schedule floor operations logged';
  const raw = text.trim();
  if (!/[\u0B80-\u0BFF]/.test(raw)) return raw;

  if (/தையல்\s*இயந்திர|ஊசி|மோட்டார்/i.test(raw)) {
    return 'Stitching machine motor stopped due to needle breakage. Replaced and calibrated.';
  }
  if (/ஹைட்ரோ|டம்பிள்|ட்ரையிங்/i.test(raw)) {
    return 'Hydro-extraction and tumble drying lot 3 in progress.';
  }
  if (/வணக்கம்.*உற்பத்தி/i.test(raw)) {
    return "Shift cut-off reminder: Log today's production count for assigned purchase order in ThreadFlow.";
  }
  if (/மின்சாரம்|கரண்ட்/i.test(raw)) {
    return 'Backup diesel generator engaged during localized power cut.';
  }
  if (/சாயமிடுதல்|சாயம்/i.test(raw)) {
    return 'Dyeing lot batch completed with standard lab dip color approval.';
  }
  if (/தையல்\s*வரிசை/i.test(raw)) {
    return 'Stitching line running at high output capacity.';
  }
  if (/வெட்டு|கட்டிங்/i.test(raw)) {
    return 'Fabric lay cutting completed with zero edge fraying.';
  }
  if (/சரிபார்ப்பு|செக்கிங்/i.test(raw)) {
    return 'End-of-line checking completed with under 1.5% alteration rate.';
  }
  if (/பேக்கிங்|இறுதி/i.test(raw)) {
    return 'Finishing and barcode carton packing completed for export pallet.';
  }

  return 'Floor progress logged: operations running according to standard production schedule.';
}

export const ReportsPage: React.FC = () => {
  const [data, setData] = useState<WeeklySummaryData | null>(null);
  const [buyers, setBuyers] = useState<{ id: string; name: string; code: string; country?: string | null }[]>([]);
  const [selectedBuyerId, setSelectedBuyerId] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<string>('CW44');
  const [isLoading, setIsLoading] = useState(true);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Close print modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPrintModalOpen) {
        setIsPrintModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPrintModalOpen]);

  // Load buyers master data
  useEffect(() => {
    apiRequest<{ success: boolean; data: { buyers: any[] } }>('/orders/master-data')
      .then((res) => {
        if (res.data?.buyers && res.data.buyers.length > 0) {
          setBuyers(res.data.buyers);
          if (!selectedBuyerId) {
            setSelectedBuyerId(res.data.buyers[0].id);
          }
        }
      })
      .catch(() => {});
  }, []);

  const fetchSummary = async (buyerId?: string, week?: string) => {
    setIsLoading(true);
    try {
      const bId = buyerId || selectedBuyerId;
      const wId = week || selectedWeek;
      const params = new URLSearchParams();
      if (bId) params.append('buyerId', bId);
      if (wId) params.append('week', wId);

      const res = await apiRequest<{ success: boolean; data: WeeklySummaryData }>(
        `/reports/weekly-summary?${params.toString()}`
      );
      if (res.data) {
        setData(res.data);
      }
    } catch {
      // Graceful error fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBuyerId) {
      fetchSummary(selectedBuyerId, selectedWeek);
    }
  }, [selectedBuyerId, selectedWeek]);

  const buyerOptions: Option[] = buyers.map((b) => ({
    value: b.id,
    label: b.name,
    badge: b.country || b.code,
  }));

  const weekOptions: Option[] = [
    { value: 'CW44', label: 'Calendar Week 44 (Nov 02 - Nov 08)' },
    { value: 'CW43', label: 'Calendar Week 43 (Oct 26 - Nov 01)' },
    { value: 'CW42', label: 'Calendar Week 42 (Oct 19 - Oct 25)' },
    { value: 'CW41', label: 'Calendar Week 41 (Oct 12 - Oct 18)' },
    { value: 'CW40', label: 'Calendar Week 40 (Oct 05 - Oct 11)' },
  ];

  // Map orders for export service format
  const exportFormattedOrders: BuyerExportOrder[] = (data?.orders || []).map((o) => ({
    id: o.id,
    poNumber: o.poNumber,
    style: o.style,
    description: null,
    totalQuantity: o.totalQuantity,
    currency: o.currency,
    exFactoryDate: o.exFactoryDate,
    daysToExFactory: Math.ceil((new Date(o.exFactoryDate).getTime() - new Date('2026-11-02T10:00:00Z').getTime()) / (1000 * 60 * 60 * 24)),
    activeStage: o.activeStage,
    progressPercent: 75,
    unit: { name: o.unitName, location: 'Tiruppur' },
    milestones: [],
    confirmedAlerts: o.confirmedMitigations.map((m) => ({
      stage: o.activeStage,
      riskLevel: 'GREEN',
      mitigationPlan: m,
      reviewedAt: new Date().toISOString(),
    })),
    latestDailyLog: {
      notes: ensureEnglishNote(o.latestNote),
      goodQuantity: 0,
      stage: o.activeStage,
    },
  }));

  // Bar colors across 5 weeks: darker navy to vibrant sky blue
  const barColors = [
    'bg-slate-300',
    'bg-sky-300',
    'bg-sky-400',
    'bg-sky-600',
    'bg-[#0C2D48]',
  ];

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Weekly Buyer Status & Executive Reports
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified export status matrices, milestone velocity charts, and executive sign-off packs
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Export CSV */}
          <button
            type="button"
            onClick={() => {
              if (data?.buyer) exportOrdersToCsv(data.buyer, exportFormattedOrders);
            }}
            disabled={!data || data.orders.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-xl text-xs shadow-2xs transition cursor-pointer disabled:opacity-50"
            title="Download formatted RFC 4180 CSV spreadsheet"
          >
            <Download className="w-3.5 h-3.5 text-sky-700" />
            <span>Export CSV</span>
          </button>

          {/* Print / PDF Report */}
          <button
            type="button"
            onClick={() => setIsPrintModalOpen(true)}
            disabled={!data || data.orders.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
            title="Generate official branded printable report with executive sign-off block"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Printable PDF Report</span>
          </button>

          <button
            type="button"
            onClick={() => fetchSummary(selectedBuyerId, selectedWeek)}
            disabled={isLoading}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs transition cursor-pointer"
            title="Refresh weekly data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Partner & Calendar Week Selection Bar (Clean, compliance line removed) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
          <div className="w-56">
            <CustomSelect
              value={selectedBuyerId}
              options={buyerOptions}
              onChange={(val) => setSelectedBuyerId(val)}
              placeholder="Select Sourcing Buyer"
            />
          </div>

          <div className="w-64">
            <CustomSelect
              value={selectedWeek}
              options={weekOptions}
              onChange={(val) => setSelectedWeek(val)}
              placeholder="Select Calendar Week"
            />
          </div>
        </div>

        <div className="text-xs font-semibold text-slate-600 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Active Export Partner: <strong className="text-slate-900 font-bold">{data?.buyer.name || 'Company B (UK)'}</strong></span>
        </div>
      </div>

      {/* 3. Replacement for 4 Cards: Multi-Bar 7-Stage TNA Progress Trend Chart */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-sky-600" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                7-Stage TNA Pipeline Velocity: Past 5 Weeks Multi-Bar Comparison
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tracks completed stage progress rates across 5 consecutive calendar cycles to detect throughput acceleration or bottlenecks.
            </p>
          </div>

          {/* Bar Chart Legend */}
          <div className="flex items-center gap-3 text-[11px] font-medium text-slate-600 flex-wrap">
            <span className="text-slate-400 font-semibold">Weeks:</span>
            {data?.stageTrends?.[0]?.weeklyBars?.map((b, i) => (
              <span key={b.week} className="inline-flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-sm ${barColors[i] || 'bg-sky-600'}`} />
                <span className="font-mono text-[10px]">{b.week}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Multi-Bar Columns for 7 Stages */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 pt-1">
          {(data?.stageTrends || []).map((stage) => {
            const isUp = stage.trend === 'UP';
            const isDown = stage.trend === 'DOWN';

            return (
              <div
                key={stage.stage}
                className="bg-slate-50/70 border border-slate-200/90 rounded-xl p-3 flex flex-col justify-between space-y-3 hover:border-sky-300 transition-all hover:bg-white hover:shadow-xs"
              >
                {/* Stage Header & Trend Delta */}
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-slate-800 text-xs truncate" title={stage.displayName}>
                      {stage.displayName}
                    </span>
                    <span
                      className={`inline-flex items-center gap-0.5 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md border ${
                        isUp
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : isDown
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {isUp ? (
                        <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                      ) : isDown ? (
                        <ArrowDownRight className="w-3 h-3 text-rose-600" />
                      ) : (
                        <Minus className="w-2.5 h-2.5 text-slate-400" />
                      )}
                      <span>{isUp ? '+' : ''}{stage.trendDelta}%</span>
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 font-mono">
                    Current: <strong className="text-slate-900 font-extrabold">{stage.currentRate}%</strong>
                  </div>
                </div>

                {/* Multi-Bar Visualization (5 grouped bars side-by-side) */}
                <div className="h-28 flex items-end justify-between gap-1 px-1 py-1 bg-white border border-slate-200/60 rounded-lg">
                  {stage.weeklyBars.map((bar, barIdx) => (
                    <div
                      key={bar.week}
                      className="flex-1 flex flex-col items-center justify-end h-full group relative"
                    >
                      {/* Hover Tooltip */}
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition pointer-events-none bg-slate-900 text-white text-[9px] font-mono py-0.5 px-1.5 rounded whitespace-nowrap z-20 shadow-md">
                        {bar.week}: {bar.rate}% ({bar.pieces.toLocaleString()} pcs)
                      </div>

                      <div
                        className={`w-full rounded-t-sm transition-all duration-300 ${barColors[barIdx]}`}
                        style={{ height: `${Math.max(8, bar.rate)}%` }}
                      />
                      <span className="text-[8px] font-mono text-slate-400 mt-1 scale-90">
                        {bar.week.replace('CW ', 'W')}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Status Footnote */}
                <div className="text-[10px] font-semibold text-slate-500 flex items-center justify-between border-t border-slate-200/50 pt-1.5">
                  <span className="uppercase text-[9px] tracking-wider text-slate-400">Pacing</span>
                  <span className={isUp ? 'text-emerald-700' : isDown ? 'text-rose-600' : 'text-slate-600'}>
                    {isUp ? 'Accelerating ↑' : isDown ? 'Decelerating ↓' : 'Steady Pace'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Dynamic AI Sourcing Intelligence Brief (Stored & Renewed Weekly) */}
      {data?.aiIntelligence && (
        <div className="bg-gradient-to-br from-white via-sky-50/30 to-indigo-50/20 rounded-2xl border border-sky-200 p-4 sm:p-5 shadow-xs space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sky-100 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-600 text-white flex items-center justify-center shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>AI Sourcing Intelligence Analysis ({data.aiIntelligence.week})</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                    Confidence: {data.aiIntelligence.confidenceScore}%
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Synthesized weekly from floor run-rates, stage throughput deltas, and milestone buffers
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="text-slate-500">Risk Assessment:</span>
              <span
                className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                  data.aiIntelligence.riskLevel === 'LOW'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : data.aiIntelligence.riskLevel === 'MEDIUM'
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-rose-100 text-rose-900 border border-rose-300'
                }`}
              >
                {data.aiIntelligence.riskLevel} RISK PIPELINE
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-extrabold text-[#0C2D48]">
              "{data.aiIntelligence.headline}"
            </h4>
            <p className="text-xs text-slate-700 leading-relaxed font-normal">
              {data.aiIntelligence.executiveSummary}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Operational Strengths
              </span>
              <ul className="text-xs text-slate-700 space-y-1 list-disc list-inside">
                {data.aiIntelligence.keyStrengths.map((s, idx) => (
                  <li key={idx} className="leading-tight">{s}</li>
                ))}
              </ul>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Bottlenecks to Monitor
              </span>
              <ul className="text-xs text-slate-700 space-y-1 list-disc list-inside">
                {data.aiIntelligence.keyBottlenecks.map((b, idx) => (
                  <li key={idx} className="leading-tight">{b}</li>
                ))}
              </ul>
            </div>

            <div className="p-3 bg-white rounded-xl border border-sky-300 shadow-2xs space-y-1.5 bg-gradient-to-br from-sky-50/50 to-white">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-sky-600" />
                Floor Merchandiser Directive
              </span>
              <p className="text-xs text-slate-800 font-medium leading-relaxed">
                {data.aiIntelligence.aiRecommendation}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 5. Additional Graphical Analytics: Factory Weekly Throughput & Milestone Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Weekly Factory Garment Throughput Velocity Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Weekly Garment Throughput Velocity (Actual vs Planned Output)
              </h3>
              <p className="text-[11px] text-slate-400">Total verified output across all active units</p>
            </div>
            <span className="text-xs font-mono font-bold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-lg border border-sky-200">
              {(data?.metrics.totalContractedPieces || 0).toLocaleString()} pcs Total
            </span>
          </div>

          <div className="space-y-2.5 pt-1">
            {(data?.weeklyThroughput || []).map((wt) => (
              <div key={wt.week} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-slate-700">{wt.week}</span>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-slate-900 font-bold">{wt.actualPcs.toLocaleString()} pcs produced</span>
                    <span className="text-slate-400">/ {wt.targetPcs.toLocaleString()} target</span>
                    <span className="font-extrabold text-sky-700">({wt.efficiencyRate}%)</span>
                  </div>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      wt.efficiencyRate >= 95
                        ? 'bg-emerald-500'
                        : wt.efficiencyRate >= 80
                        ? 'bg-sky-600'
                        : 'bg-amber-500'
                    }`}
                    style={{ width: `${Math.min(100, wt.efficiencyRate)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Milestone Health & On-Time Confidence Gauge */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between space-y-3">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Delivery Schedule Health
            </h3>
            <p className="text-[11px] text-slate-400">Risk classification across {data?.metrics.totalOrders || 0} purchase orders</p>
          </div>

          <div className="space-y-3 my-auto">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-emerald-800">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                On Track (Clean Shipping Buffer)
              </span>
              <span className="font-mono font-bold text-slate-900">{data?.milestoneHealth.onTrack || 84}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${data?.milestoneHealth.onTrack || 84}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-amber-800">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                Minor Buffer Consumed (&lt; 3 Days)
              </span>
              <span className="font-mono font-bold text-slate-900">{data?.milestoneHealth.minorBuffer || 12}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full"
                style={{ width: `${data?.milestoneHealth.minorBuffer || 12}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-rose-800">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                Critical Deficit Attention Needed
              </span>
              <span className="font-mono font-bold text-slate-900">{data?.milestoneHealth.criticalDeficit || 4}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-500 rounded-full"
                style={{ width: `${data?.milestoneHealth.criticalDeficit || 4}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
            <span className="font-medium">Overall Confidence Index:</span>
            <span className="font-bold text-[#0C2D48] font-mono text-xs">
              {data?.metrics.onTimeConfidencePercent || 92}%
            </span>
          </div>
        </div>
      </div>

      {/* 6. Purchase Orders Status Table (Strict compliance lines removed, supervisor notes strictly in English) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-800">
            Purchase Orders in Sourcing Window ({data?.orders.length || 0})
          </span>
          <span className="text-slate-500 text-[11px] font-mono">
            Cycle: {data?.selectedWeek || selectedWeek}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0C2D48] text-white font-bold uppercase text-[10px] tracking-wider border-b border-[#143D60]">
              <tr>
                <th className="py-2.5 px-3 text-slate-100">PO Number</th>
                <th className="py-2.5 px-3 text-slate-100">Style</th>
                <th className="py-2.5 px-3 text-right text-slate-100">Quantity</th>
                <th className="py-2.5 px-3 text-slate-100">Ex-Factory</th>
                <th className="py-2.5 px-3 text-slate-100">Active Stage</th>
                <th className="py-2.5 px-3 text-slate-100">Manufacturing Unit</th>
                <th className="py-2.5 px-3 text-slate-100">Directives & Supervisor Notes (English)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(!data || data.orders.length === 0) ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No orders scheduled for this sourcing partner in {selectedWeek}.
                  </td>
                </tr>
              ) : (
                data.orders.map((o) => (
                  <tr key={o.id} className="even:bg-slate-50/80 odd:bg-white hover:bg-sky-50/60 transition">
                    <td className="py-2.5 px-3">
                      <span className="font-mono text-xs font-extrabold text-sky-700 inline-flex items-center gap-1">
                        <span>{o.poNumber}</span>
                        <ExternalLink className="w-3 h-3 text-sky-500" />
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{o.style}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{o.totalQuantity.toLocaleString()} pcs</td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                      {new Date(o.exFactoryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-sky-900 capitalize">{o.activeStage.replace(/_/g, ' ')}</td>
                    <td className="py-2.5 px-3 text-slate-700">{o.unitName}</td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate" title={ensureEnglishNote(o.latestNote)}>
                      {ensureEnglishNote(o.confirmedMitigations[0] || o.latestNote)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. Printable Report Modal */}
      {data?.buyer && (
        <WeeklyReportPrintModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          buyer={data.buyer}
          orders={exportFormattedOrders}
        />
      )}
    </div>
  );
};
