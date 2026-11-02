import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../services/api';
import {
  RiskListResponse,
  RiskItem,
  RiskSummary,
  RiskLevel,
  Stage,
  Buyer,
  Unit,
} from '../../types';
import { ShowYourMathCard } from './ShowYourMathCard';
import { CustomSelect, Option } from '../../components/CustomSelect';
import {
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ArrowRight,
  Filter,
  ChevronDown,
} from 'lucide-react';

const STAGE_LABELS: Record<Stage, string> = {
  KNITTING: 'Knitting',
  DYEING_WASHING: 'Dyeing & Washing',
  PRINTING: 'Printing & Embroidery',
  CUTTING: 'Fabric Cutting',
  STITCHING: 'Assembly & Stitching',
  CHECKING: 'Quality Checking',
  FINISHING: 'Finishing & Packing',
};

export const RiskPage: React.FC = () => {
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [summary, setSummary] = useState<RiskSummary>({
    totalMonitoredOrders: 0,
    redCount: 0,
    amberCount: 0,
    greenCount: 0,
    totalExposureRupees: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [riskLevelFilter, setRiskLevelFilter] = useState<'ALL' | RiskLevel>('ALL');
  const [buyerFilter, setBuyerFilter] = useState<string>('ALL');
  const [unitFilter, setUnitFilter] = useState<string>('ALL');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isMobileFilterExpanded, setIsMobileFilterExpanded] = useState<boolean>(false);

  // Master Data
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const fetchMasterData = async () => {
    try {
      const res = await apiRequest<{
        success: boolean;
        data: { buyers: Buyer[]; units: Unit[] };
      }>('/orders/master-data');
      if (res.data) {
        setBuyers(res.data.buyers || []);
        setUnits(res.data.units || []);
      }
    } catch {
      // master data fallback
    }
  };

  const fetchRisks = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (riskLevelFilter !== 'ALL') params.append('riskLevel', riskLevelFilter);
      if (buyerFilter !== 'ALL') params.append('buyerId', buyerFilter);
      if (unitFilter !== 'ALL') params.append('unitId', unitFilter);
      if (stageFilter !== 'ALL') params.append('stage', stageFilter);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());

      const res = await apiRequest<{ success: boolean; data: RiskListResponse }>(
        `/risk?${params.toString()}`
      );

      if (res.data) {
        setRisks(res.data.risks || []);
        setSummary(res.data.summary);
      }
    } catch (err: any) {
      if (err.status === 401) {
        window.location.replace('/login');
        return;
      }
      setError(err.message || 'Failed to load run-rate risk evaluations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, []);

  useEffect(() => {
    fetchRisks();
  }, [riskLevelFilter, buyerFilter, unitFilter, stageFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRisks();
  };

  const buyerOptions: Option[] = [
    { value: 'ALL', label: 'All Foreign Buyers' },
    ...buyers.map((b) => ({
      value: b.id,
      label: b.name,
      sublabel: b.code,
    })),
  ];

  const unitOptions: Option[] = [
    { value: 'ALL', label: 'All Production Units' },
    ...units.map((u) => ({
      value: u.id,
      label: u.name,
      badge: u.type === 'SUBCONTRACTOR' ? 'Subcontract' : 'In-House',
    })),
  ];

  const stageOptions: Option[] = [
    { value: 'ALL', label: 'All 7 TNA Stages' },
    ...Object.entries(STAGE_LABELS).map(([key, label]) => ({
      value: key,
      label,
    })),
  ];

  return (
    <div className="space-y-5 pb-12 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Production Run-Rate Analysis
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Throughput monitoring, 3-day weighted pace, and downstream buffers
          </p>
        </div>

        <button
          onClick={fetchRisks}
          className="inline-flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs transition cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4 text-slate-500" />
          <span>Refresh Analysis</span>
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Monitored Orders
          </div>
          <div className="text-xl font-bold text-slate-800 mt-1 font-mono">
            {summary.totalMonitoredOrders}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            Critical Deficit
          </div>
          <div className="text-xl font-bold text-rose-700 mt-1 font-mono">{summary.redCount}</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Buffer Caution
          </div>
          <div className="text-xl font-bold text-amber-700 mt-1 font-mono">{summary.amberCount}</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            On-Track
          </div>
          <div className="text-xl font-bold text-emerald-700 mt-1 font-mono">{summary.greenCount}</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs col-span-2 md:col-span-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Financial Exposure
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1 font-mono">
            ₹{summary.totalExposureRupees.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Filter Toolbar (Relative on mobile so it never covers content when scrolling; Sticky on sm+) */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3 relative sm:sticky sm:top-0 z-30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3">
          {/* Status Segmented Buttons & Mobile Filter Toggle */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="inline-flex p-1 bg-slate-100 rounded-xl gap-1 overflow-x-auto no-scrollbar">
              {(['ALL', 'RED', 'AMBER', 'GREEN'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setRiskLevelFilter(lvl)}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    riskLevelFilter === lvl
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lvl === 'ALL' ? (
                    <>
                      <span className="sm:hidden">All</span>
                      <span className="hidden sm:inline">All Risks</span>
                    </>
                  ) : (
                    lvl
                  )}
                </button>
              ))}
            </div>

            {/* Mobile Filter Toggle Button */}
            <button
              type="button"
              onClick={() => setIsMobileFilterExpanded(!isMobileFilterExpanded)}
              className="sm:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
              title="Toggle dropdown filters"
            >
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span>Filters</span>
              {(buyerFilter !== 'ALL' || unitFilter !== 'ALL' || stageFilter !== 'ALL') && (
                <span className="w-4 h-4 rounded-full bg-sky-600 text-white text-[10px] flex items-center justify-center font-bold">
                  {(buyerFilter !== 'ALL' ? 1 : 0) + (unitFilter !== 'ALL' ? 1 : 0) + (stageFilter !== 'ALL' ? 1 : 0)}
                </span>
              )}
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isMobileFilterExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Quick Search */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search PO number or garment style..."
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </form>
        </div>

        {/* Custom Select Filters (Collapsible on mobile to maximize viewport, visible on sm+) */}
        <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs ${isMobileFilterExpanded ? 'block' : 'hidden sm:grid'}`}>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Foreign Buyer
            </label>
            <CustomSelect
              value={buyerFilter}
              options={buyerOptions}
              onChange={(v) => setBuyerFilter(v)}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Production Unit
            </label>
            <CustomSelect
              value={unitFilter}
              options={unitOptions}
              onChange={(v) => setUnitFilter(v)}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Production Stage
            </label>
            <CustomSelect
              value={stageFilter}
              options={stageOptions}
              onChange={(v) => setStageFilter(v)}
            />
          </div>
        </div>
      </div>

      {/* Main Content: List of Orders with Cleaned Show-Your-Math Cards */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <div className="w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-semibold">Evaluating production run-rates...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : risks.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
            <Filter className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-800">No Orders Match Current Filters</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Try adjusting your search criteria or resetting filters.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {risks.map((item) => (
            <div
              key={item.orderId}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition hover:border-slate-300"
            >
              {/* Order Header Summary */}
              <div className="px-3.5 sm:px-5 py-3 sm:py-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/60">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <Link
                    to={`/orders/${item.orderId}`}
                    className="font-mono text-base font-extrabold text-[#0C2D48] hover:text-sky-600 transition flex items-center gap-1.5"
                  >
                    <span>{item.poNumber}</span>
                    <ExternalLink className="w-4 h-4 text-slate-400" />
                  </Link>
                  <span className="text-slate-300 text-lg font-light">•</span>
                  <span className="text-base sm:text-lg font-bold text-slate-900">{item.style}</span>
                  <span className="text-slate-300 text-lg font-light">•</span>
                  <span className="text-xs text-slate-500 font-medium">
                    {item.buyer?.name} ({item.unit?.name})
                  </span>
                  <span className="text-slate-300 text-lg font-light">•</span>
                  <span className="text-xs font-semibold text-slate-700 bg-white px-2.5 py-1 rounded-md border border-slate-200">
                    Stage: {STAGE_LABELS[item.activeStage] || item.activeStage}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-xs text-slate-500">
                    Ex-Factory:{' '}
                    <strong className="text-slate-800 font-semibold">
                      {new Date(item.exFactoryDate).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </strong>{' '}
                    <span className="text-amber-700 font-bold">({item.workingDaysLeft}d left)</span>
                  </div>

                  <Link
                    to={`/orders/${item.orderId}`}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                    title="View order"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* Embedded Show-Your-Math Formula Card (Clean & Concise) */}
              <div className="p-4">
                <ShowYourMathCard
                  mathBreakdown={item.mathBreakdown}
                  riskLevel={item.riskLevel}
                  differencePill={item.differencePill}
                  requiredDailyRate={item.requiredDailyRate}
                  actualRollingRate={item.actualRollingRate}
                  varianceQtyPerDay={item.varianceQtyPerDay}
                  daysLate={item.daysLate}
                  projectedCompletionDate={item.projectedCompletionDate}
                  financialExposureRupees={item.financialExposureRupees}
                  poNumber={item.poNumber}
                  styleName={item.style}
                  stageName={STAGE_LABELS[item.activeStage] || item.activeStage}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
