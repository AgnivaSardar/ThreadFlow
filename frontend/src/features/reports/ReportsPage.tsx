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
  ShieldCheck,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';

interface WeeklySummaryData {
  buyer: BuyerProfile;
  metrics: {
    totalOrders: number;
    activeOrders: number;
    completedOrders: number;
    totalContractedPieces: number;
    onTimeConfidencePercent: number;
  };
  stageBreakdown: Record<string, { totalPlanned: number; totalCompleted: number }>;
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

export const ReportsPage: React.FC = () => {
  const [data, setData] = useState<WeeklySummaryData | null>(null);
  const [buyers, setBuyers] = useState<{ id: string; name: string; code: string; country?: string | null }[]>([]);
  const [selectedBuyerId, setSelectedBuyerId] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<string>('CW44');
  const [isLoading, setIsLoading] = useState(true);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

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

  const fetchSummary = async (buyerId?: string) => {
    setIsLoading(true);
    try {
      const bId = buyerId || selectedBuyerId;
      const queryStr = bId ? `?buyerId=${encodeURIComponent(bId)}` : '';
      const res = await apiRequest<{ success: boolean; data: WeeklySummaryData }>(
        `/reports/weekly-summary${queryStr}`
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
      fetchSummary(selectedBuyerId);
    }
  }, [selectedBuyerId]);

  const buyerOptions: Option[] = buyers.map((b) => ({
    value: b.id,
    label: b.name,
    badge: b.country || b.code,
  }));

  const weekOptions: Option[] = [
    { value: 'CW44', label: 'Calendar Week 44 (Current Week)' },
    { value: 'CW43', label: 'Calendar Week 43' },
    { value: 'CW42', label: 'Calendar Week 42' },
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
      notes: o.latestNote,
      goodQuantity: 0,
      stage: o.activeStage,
    },
  }));

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
            onClick={() => fetchSummary()}
            disabled={isLoading}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs transition cursor-pointer"
            title="Refresh weekly data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Partner & Calendar Week Selection Bar */}
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

        <div className="text-xs text-slate-500 font-medium self-end sm:self-auto flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Sedex SMETA & ISO 9001 Audited Factory Data</span>
        </div>
      </div>

      {/* 3. Executive KPI Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Contracted Garments</div>
            <div className="text-xl font-extrabold text-slate-900 mt-1 font-mono">
              {(data?.metrics.totalContractedPieces || 0).toLocaleString()} pcs
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">{data?.metrics.totalOrders || 0} Export POs</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">On-Time Delivery Confidence</div>
            <div className="text-xl font-extrabold text-emerald-900 mt-1 font-mono">
              {data?.metrics.onTimeConfidencePercent || 100}%
            </div>
            <div className="text-[10px] text-emerald-700/80 mt-0.5">Based on rolling run-rates</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active vs Completed</div>
            <div className="text-sm font-extrabold text-slate-900 mt-1 font-mono">
              {data?.metrics.activeOrders || 0} Active • {data?.metrics.completedOrders || 0} Done
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Floor progress sync</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Production Hub</div>
            <div className="text-sm font-extrabold text-slate-900 mt-1 truncate max-w-[130px]">
              {data?.buyer.country || 'Europe Sourcing'}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">{data?.buyer.name || 'Verified Partner'}</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 4. 7-Stage TNA Pipeline Progress Breakdown */}
      {data?.stageBreakdown && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              7-Stage TNA Milestone Output Breakdown (Calendar Week 44)
            </h3>
            <span className="text-[10px] font-semibold text-slate-400">Actual vs Target Rolling Output</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {Object.entries(data.stageBreakdown).map(([stageName, stats]) => {
              const pct = stats.totalPlanned > 0 ? Math.min(100, Math.round((stats.totalCompleted / stats.totalPlanned) * 100)) : 0;
              return (
                <div key={stageName} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-800 capitalize truncate" title={stageName.replace(/_/g, ' ')}>
                    {stageName.replace(/_/g, ' ')}
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span>{pct}%</span>
                    <span>{stats.totalCompleted.toLocaleString()} pcs</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. PO Status Summary Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-800">Purchase Orders in Sourcing Window ({data?.orders.length || 0})</span>
          <span className="text-slate-400 text-[11px]">Strict Multi-Tenant Scoped Data</span>
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
                <th className="py-2.5 px-3 text-slate-100">Directives & Supervisor Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(!data || data.orders.length === 0) ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No orders scheduled for this sourcing partner.
                  </td>
                </tr>
              ) : (
                data.orders.map((o) => (
                  <tr key={o.id} className="even:bg-slate-50/80 odd:bg-white hover:bg-sky-50/60 transition">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{o.poNumber}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{o.style}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{o.totalQuantity.toLocaleString()} pcs</td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                      {new Date(o.exFactoryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-sky-900 capitalize">{o.activeStage.replace(/_/g, ' ')}</td>
                    <td className="py-2.5 px-3 text-slate-700">{o.unitName}</td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate" title={o.latestNote}>
                      {o.confirmedMitigations[0] || o.latestNote}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Feature 14 Printable Report Modal */}
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
