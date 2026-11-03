import React, { useState, useEffect, useMemo } from 'react';
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
  RiskAlertItem,
  RiskAlertSummary,
  RiskAlertsResponse,
} from '../../types';
import { ShowYourMathCard } from './ShowYourMathCard';
import { RiskReviewCard } from './RiskReviewCard';
import { CustomSelect, Option } from '../../components/CustomSelect';
import {
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ArrowRight,
  Filter,
  ChevronDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Plane,
  ShieldAlert,
  Eye,
  EyeOff,
  Clock,
  TrendingUp,
  Sparkles,
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
    completedCount: 0,
    totalExposureRupees: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Feature 10: Human-in-the-Loop Review Gate state
  const [activeTab, setActiveTab] = useState<'REVIEW_GATE' | 'RUN_RATE'>('REVIEW_GATE');
  const [alerts, setAlerts] = useState<RiskAlertItem[]>([]);
  const [alertSummary, setAlertSummary] = useState<RiskAlertSummary | null>(null);
  const [alertStatusFilter, setAlertStatusFilter] = useState<'PENDING_REVIEW' | 'CONFIRMED' | 'OVERRIDDEN' | 'ALL'>('PENDING_REVIEW');
  const [alertsLoading, setAlertsLoading] = useState(false);

  const fetchAlerts = async () => {
    try {
      setAlertsLoading(true);
      const params = new URLSearchParams();
      if (alertStatusFilter !== 'ALL') {
        params.append('status', alertStatusFilter);
      }
      const res = await apiRequest<{ success: boolean; data: RiskAlertsResponse }>(
        `/risk/alerts?${params.toString()}`
      );
      if (res.data) {
        setAlerts(res.data.alerts || []);
        setAlertSummary(res.data.summary);
      }
    } catch (err: any) {
      console.warn('Failed to fetch risk alerts:', err);
    } finally {
      setAlertsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [alertStatusFilter]);

  const handleAlertUpdated = (updatedAlert: RiskAlertItem) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === updatedAlert.id ? updatedAlert : a))
    );
    fetchAlerts();
    fetchRisks();
  };

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

  // Active monitored orders only - completed orders removed from Risk & Delays
  const sortedRisks = useMemo(() => {
    return risks
      .filter((r) => {
        const isDone = Boolean(
          r.isCompleted ||
          r.mathBreakdown?.remainingPieces === 0 ||
          r.requiredDailyRate === 0
        );
        return !isDone;
      })
      .sort((a, b) => {
        if (a.varianceQtyPerDay !== b.varianceQtyPerDay) {
          return a.varianceQtyPerDay - b.varianceQtyPerDay;
        }
        return b.financialExposureRupees - a.financialExposureRupees;
      });
  }, [risks]);

  // Client-side pagination for Monitored Orders
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 5;

  useEffect(() => {
    setCurrentPage(1);
  }, [riskLevelFilter, buyerFilter, unitFilter, stageFilter, searchTerm]);

  const totalPages = Math.ceil(sortedRisks.length / pageSize) || 1;
  const paginatedRisks = sortedRisks.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

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
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Risk & Delays Intelligence
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Human-in-the-loop review gate, throughput monitoring, and financial delay exposure
          </p>
        </div>

        <button
          onClick={() => {
            fetchAlerts();
            fetchRisks();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs transition cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          <span>Refresh All</span>
        </button>
      </div>

      {/* Feature 10: Executive Financial Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-black uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
            Executive Financial Exposure
          </div>
          <div className="text-2xl sm:text-4xl font-black font-mono tracking-tight text-white flex items-baseline gap-2.5">
            <span>₹{(alertSummary?.totalAtRiskRupees || summary.totalExposureRupees || 0).toLocaleString()}</span>
            <span className="text-xs sm:text-sm font-bold text-rose-300/80 uppercase tracking-wider">
              At Risk Across Factory
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Total financial exposure across {alertSummary?.ordersAtRiskCount || summary.redCount + summary.amberCount} orders with active rate deficits. The Human-in-the-Loop gate ensures raw floor panic and colloquial Tamil notes never reach international buyers without merchandiser review.
          </p>
        </div>

        {/* Quick Triage Counters */}
        <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('REVIEW_GATE');
              setAlertStatusFilter('PENDING_REVIEW');
            }}
            className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-between gap-3 cursor-pointer ${
              activeTab === 'REVIEW_GATE' && alertStatusFilter === 'PENDING_REVIEW'
                ? 'bg-amber-500 text-slate-900 border-amber-400 shadow-md font-black'
                : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-200'
            }`}
          >
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Pending Review</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-900 text-xs font-black font-mono">
              {alertSummary?.totalPendingReview || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('REVIEW_GATE');
              setAlertStatusFilter('CONFIRMED');
            }}
            className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-between gap-3 cursor-pointer ${
              activeTab === 'REVIEW_GATE' && alertStatusFilter === 'CONFIRMED'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-md font-black'
                : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40 text-emerald-200'
            }`}
          >
            <span className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-400" />
              <span>Buyer Confirmed</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-xs font-black font-mono">
              {alertSummary?.totalConfirmed || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('REVIEW_GATE');
              setAlertStatusFilter('OVERRIDDEN');
            }}
            className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-between gap-3 cursor-pointer ${
              activeTab === 'REVIEW_GATE' && alertStatusFilter === 'OVERRIDDEN'
                ? 'bg-slate-700 text-white border-slate-600 shadow-md font-black'
                : 'bg-slate-800 hover:bg-slate-700/80 border-slate-700 text-slate-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-slate-400" />
              <span>Internal Overrides</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-200 text-xs font-black font-mono">
              {alertSummary?.totalOverridden || 0}
            </span>
          </button>
        </div>
      </div>

      {/* Tab Switcher: Human-in-the-Loop Review Gate vs Run-Rate Engine */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('REVIEW_GATE')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'REVIEW_GATE'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Human-in-the-Loop Review Gate</span>
          {(alertSummary?.totalPendingReview || 0) > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-900 text-[10px] font-black animate-pulse">
              {alertSummary?.totalPendingReview}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('RUN_RATE')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'RUN_RATE'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Run-Rate Throughput Engine</span>
          <span className="text-[11px] opacity-75">({sortedRisks.length})</span>
        </button>
      </div>

      {/* TAB 1: HUMAN-IN-THE-LOOP REVIEW GATE */}
      {activeTab === 'REVIEW_GATE' && (
        <div className="space-y-4">
          {/* Status Sub-Filters for Review Gate */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
            <div className="inline-flex p-1 bg-slate-100 rounded-xl gap-1">
              {(
                [
                  { id: 'PENDING_REVIEW', label: 'Pending Review', count: alertSummary?.totalPendingReview },
                  { id: 'CONFIRMED', label: 'Confirmed (Buyer Visible)', count: alertSummary?.totalConfirmed },
                  { id: 'OVERRIDDEN', label: 'Internally Overridden', count: alertSummary?.totalOverridden },
                  { id: 'ALL', label: 'All Alerts', count: undefined },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAlertStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    alertStatusFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        alertStatusFilter === tab.id
                          ? 'bg-slate-100 text-slate-800'
                          : 'bg-slate-200/80 text-slate-600'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <span className="text-xs text-slate-500 font-semibold">
              Showing <strong>{alerts.length}</strong> alerts requiring triage
            </span>
          </div>

          {/* Alert Cards List */}
          {alertsLoading ? (
            <div className="p-10 text-center bg-white rounded-2xl border border-slate-200">
              <div className="w-7 h-7 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-semibold">Loading alert triage cards...</p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">No Alerts in this Category</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                All production alerts in this review status have been handled. Switch filter tabs or refresh to view other items.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {alerts.map((alert) => (
                <RiskReviewCard
                  key={alert.id}
                  alert={alert}
                  onAlertUpdated={handleAlertUpdated}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RUN-RATE THROUGHPUT ENGINE */}
      {activeTab === 'RUN_RATE' && (
        <div className="space-y-4">
          {/* KPI Metric Cards (Compact 5-Card Grid) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Monitored Orders
              </div>
              <div className="text-lg font-bold text-slate-800 mt-0.5 font-mono">
                {summary.totalMonitoredOrders}
              </div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-rose-200 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                Critical Deficit
              </div>
              <div className="text-lg font-bold text-rose-700 mt-0.5 font-mono">{summary.redCount}</div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Buffer Caution
              </div>
              <div className="text-lg font-bold text-amber-700 mt-0.5 font-mono">{summary.amberCount}</div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                On-Track
              </div>
              <div className="text-lg font-bold text-emerald-700 mt-0.5 font-mono">{summary.greenCount}</div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs col-span-2 sm:col-span-1 lg:col-span-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Financial Exposure
              </div>
              <div className="text-lg font-bold text-slate-900 mt-0.5 font-mono truncate">
                ₹{summary.totalExposureRupees.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Filter Toolbar (Relative on mobile so it never covers content when scrolling; Sticky on sm+) */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs space-y-2.5 relative sm:sticky sm:top-0 z-30">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
              {/* Status Segmented Buttons & Mobile Filter Toggle */}
              <div className="flex items-center justify-between gap-1.5">
                <div className="inline-flex p-1 bg-slate-100 rounded-xl gap-1 overflow-x-auto no-scrollbar">
                  {(['ALL', 'RED', 'AMBER', 'GREEN'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setRiskLevelFilter(lvl)}
                      className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
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
                      ) : lvl === 'RED' ? (
                        'Critical Deficit'
                      ) : lvl === 'AMBER' ? (
                        'Buffer Caution'
                      ) : lvl === 'GREEN' ? (
                        'On Track'
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
            <div className={`grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 text-xs ${isMobileFilterExpanded ? 'block' : 'hidden sm:grid'}`}>
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

      {/* Main Content: List of Orders with Compact Cards */}
      {loading ? (
        <div className="p-10 text-center bg-white rounded-2xl border border-slate-200">
          <div className="w-7 h-7 border-3 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-semibold">Evaluating production run-rates...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : sortedRisks.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
            <Filter className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-slate-800">No Orders Match Current Filters</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Try adjusting your search criteria or resetting filters.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedRisks.map((item) => {
            const isCompleted = Boolean(
              item.isCompleted ||
              item.requiredDailyRate === 0 ||
              item.mathBreakdown?.remainingPieces === 0
            );

            return (
              <div
                key={item.orderId}
                className={`bg-white rounded-xl border shadow-xs overflow-hidden transition ${
                  isCompleted
                    ? 'border-emerald-200/90 bg-emerald-50/10'
                    : item.riskLevel === 'RED'
                    ? 'border-rose-200 hover:border-rose-300'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Order Header Summary (Compact) */}
                <div className="px-3.5 sm:px-4 py-2 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 bg-slate-50/70">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to={`/orders/${item.orderId}`}
                      className="font-mono text-sm font-extrabold text-[#0C2D48] hover:text-sky-600 transition flex items-center gap-1"
                    >
                      <span>{item.poNumber}</span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </Link>
                    <span className="text-slate-300 font-light">•</span>
                    <span className="text-sm font-bold text-slate-900">{item.style}</span>
                    <span className="text-slate-300 font-light">•</span>
                    <span className="text-xs text-slate-500 font-medium">
                      {item.buyer?.name} ({item.unit?.name})
                    </span>
                    <span className="text-slate-300 font-light">•</span>
                    <span className="text-[11px] font-semibold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                      Stage: {STAGE_LABELS[item.activeStage] || item.activeStage}
                    </span>

                    {/* Status Badge Tag */}
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                        Completed
                      </span>
                    ) : item.riskLevel === 'RED' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                        Critical Deficit ({item.varianceQtyPerDay} pcs/d)
                      </span>
                    ) : item.riskLevel === 'AMBER' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                        Buffer Caution
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        On-Track (+{item.varianceQtyPerDay} pcs/d)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 self-end sm:self-auto">
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
                      className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition"
                      title="View order"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Embedded Compact Show-Your-Math Formula Card */}
                <div className="p-3">
                  <ShowYourMathCard
                    mathBreakdown={item.mathBreakdown}
                    riskLevel={item.riskLevel}
                    isCompleted={isCompleted}
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
            );
          })}

          {/* Pagination Controls for Monitored Orders */}
          {sortedRisks.length > pageSize && (
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-slate-500 font-medium">
                Showing {(currentPage - 1) * pageSize + 1} to{' '}
                {Math.min(currentPage * pageSize, sortedRisks.length)} of{' '}
                {sortedRisks.length} monitored orders
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition cursor-pointer"
                  title="Previous page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCurrentPage(p)}
                    className={`w-7 h-7 text-xs font-bold rounded-lg transition cursor-pointer ${
                      p === currentPage
                        ? 'bg-[#0C2D48] text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition cursor-pointer"
                  title="Next page"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
        </div>
      )}
    </div>
  );
};
