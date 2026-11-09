import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest, getAuthoritativeServerDate } from '../../services/api';
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
import { Language } from '../supervisor/supervisorTranslations';
import { calculateWorkingDaysLeft } from '../../utils/dateUtils';
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
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';

const STAGE_LABELS_BILINGUAL: Record<Stage, { en: string; ta: string }> = {
  KNITTING: { en: 'Knitting', ta: 'பின்னல் (Knitting)' },
  DYEING_WASHING: { en: 'Dyeing & Washing', ta: 'சாயமிடுதல் & சலவை (Dyeing & Washing)' },
  PRINTING: { en: 'Printing & Embroidery', ta: 'அச்சிடுதல் & எம்பிராய்டரி (Printing & Embroidery)' },
  CUTTING: { en: 'Fabric Cutting', ta: 'துணி வெட்டுதல் (Fabric Cutting)' },
  STITCHING: { en: 'Assembly & Stitching', ta: 'தையல் & இணைத்தல் (Assembly & Stitching)' },
  CHECKING: { en: 'Quality Checking', ta: 'தர பரிசோதனை (Quality Checking)' },
  FINISHING: { en: 'Finishing & Packing', ta: 'இறுதி முடித்தல் & பேக்கிங் (Finishing & Packing)' },
};

const RISK_PAGE_I18N = {
  en: {
    pageTitle: 'Risk & Delays Intelligence',
    pageSubtitle: 'Human-in-the-loop review gate, operational problem triage, and throughput monitoring',
    factoryAtRisk: 'Factory At-Risk',
    refreshAll: 'Refresh All',
    tabIssueReview: 'Issue Review',
    tabRunRatePace: 'Run-Rate Pace',
    // Sub-filters for Review Gate
    filterPendingReview: 'Pending Review',
    filterInformedToBuyer: 'Informed to Buyer',
    filterHandledInternally: 'Handled Internally',
    filterAllOperationalAlerts: 'All Operational Alerts',
    showingAlerts: (count: number) => `Showing ${count} operational alerts`,
    loadingAlerts: 'Loading alert triage cards...',
    noAlertsTitle: 'No Alerts in this Category',
    noAlertsSubtitle: 'All production alerts in this review status have been handled. Switch filter tabs or refresh to view other items.',
    // Run-rate KPIs
    kpiMonitoredOrders: 'Monitored Orders',
    kpiCriticalDeficit: 'Critical Deficit',
    kpiBufferCaution: 'Extra Caution',
    kpiOnTrack: 'On-Track',
    // Run-rate filters
    filterAll: 'All',
    filterAllRisks: 'All Risks',
    filterCriticalDeficit: 'Critical Deficit',
    filterBufferCaution: 'Extra Caution',
    filterOnTrack: 'On Track',
    filterToggle: 'Filters',
    searchPlaceholder: 'Search PO number or garment style...',
    labelBuyer: 'Foreign Buyer',
    labelUnit: 'Production Unit',
    labelStage: 'Production Stage',
    allBuyers: 'All Foreign Buyers',
    allUnits: 'All Production Units',
    allStages: 'All 7 TNA Stages',
    subcontract: 'Subcontract',
    inHouse: 'In-House',
    evaluatingRunRates: 'Evaluating production run-rates...',
    noOrdersMatch: 'No Orders Match Current Filters',
    noOrdersMatchSub: 'Try adjusting your search criteria or resetting filters.',
    stagePrefix: 'Stage',
    completedBadge: 'Completed',
    exFactoryLabel: 'Ex-Factory',
    daysLeft: (d: number) => `${d}d left`,
    showingOrdersPagination: (from: number, to: number, total: number) => `Showing ${from} to ${to} of ${total} monitored orders`,
  },
  ta: {
    pageTitle: 'ஆபத்து & தாமத நுண்ணறிவு',
    pageSubtitle: 'மனித மதிப்பாய்வு வாயில், செயல்பாட்டு பிரச்சனை வகைப்பாடு மற்றும் உற்பத்தி வேகக் கண்காணிப்பு',
    factoryAtRisk: 'தொழிற்சாலை நிதி ஆபத்து',
    refreshAll: 'அனைத்தும் புதுப்பி',
    tabIssueReview: 'பிரச்சனை மதிப்பாய்வு',
    tabRunRatePace: 'உற்பத்தி வேகம்',
    // Sub-filters for Review Gate
    filterPendingReview: 'மதிப்பாய்வு நிலுவை',
    filterInformedToBuyer: 'வாங்குபவருக்கு தெரிவிக்கப்பட்டது',
    filterHandledInternally: 'உள்ளகமாக கையாளப்பட்டது',
    filterAllOperationalAlerts: 'அனைத்து செயல்பாட்டு எச்சரிக்கைகள்',
    showingAlerts: (count: number) => `${count} செயல்பாட்டு எச்சரிக்கைகள் காட்டப்படுகின்றன`,
    loadingAlerts: 'எச்சரிக்கை அட்டைகள் ஏற்றப்படுகின்றன...',
    noAlertsTitle: 'இந்த வகையில் எச்சரிக்கைகள் இல்லை',
    noAlertsSubtitle: 'இந்த மதிப்பாய்வு நிலையில் உள்ள அனைத்து உற்பத்தி எச்சரிக்கைகளும் கையாளப்பட்டுவிட்டன. பிறவற்றைக் காண வடிகட்டியை மாற்றவும்.',
    // Run-rate KPIs
    kpiMonitoredOrders: 'கண்காணிக்கப்படும் ஆர்டர்கள்',
    kpiCriticalDeficit: 'கடுமையான பற்றாக்குறை',
    kpiBufferCaution: 'கூடுதல் எச்சரிக்கை',
    kpiOnTrack: 'சரியான பாதையில்',
    // Run-rate filters
    filterAll: 'அனைத்தும்',
    filterAllRisks: 'அனைத்து ஆபத்துகள்',
    filterCriticalDeficit: 'கடுமையான பற்றாக்குறை',
    filterBufferCaution: 'கூடுதல் எச்சரிக்கை',
    filterOnTrack: 'சரியான பாதை',
    filterToggle: 'வடிகட்டிகள்',
    searchPlaceholder: 'PO எண் அல்லது ஆடை ஸ்டைலைத் தேடவும்...',
    labelBuyer: 'வெளிநாட்டு வாங்குபவர்',
    labelUnit: 'உற்பத்தி பிரிவு',
    labelStage: 'உற்பத்தி நிலை',
    allBuyers: 'அனைத்து வெளிநாட்டு வாங்குபவர்கள்',
    allUnits: 'அனைத்து உற்பத்தி பிரிவுகள்',
    allStages: 'அனைத்து 7 TNA நிலைகள்',
    subcontract: 'துணை ஒப்பந்தம்',
    inHouse: 'சொந்த ஆலை',
    evaluatingRunRates: 'உற்பத்தி ஓட்ட விகிதங்கள் கணக்கிடப்படுகின்றன...',
    noOrdersMatch: 'பொருந்தும் ஆர்டர்கள் எதுவும் இல்லை',
    noOrdersMatchSub: 'தேடல் அளவுகோல்களை மாற்றவும் அல்லது வடிகட்டிகளை மீட்டமைக்கவும்.',
    stagePrefix: 'நிலை',
    completedBadge: 'முடிந்தது',
    exFactoryLabel: 'தொழிற்சாலை வெளியேறும் தேதி',
    daysLeft: (d: number) => `${d} நாட்கள் மீதம்`,
    showingOrdersPagination: (from: number, to: number, total: number) => `${total} ஆர்டர்களில் ${from} முதல் ${to} வரை காட்டப்படுகின்றன`,
  },
};

export const RiskPage: React.FC = () => {
  // Bilingual Language State
  const [lang, setLang] = useState<Language>(
    (localStorage.getItem('threadflow_lang') as Language) || 'en'
  );

  useEffect(() => {
    const handleLangChange = (e: any) => {
      if (e.detail?.lang) {
        setLang(e.detail.lang);
      }
    };
    window.addEventListener('threadflow-lang-change', handleLangChange);
    return () => window.removeEventListener('threadflow-lang-change', handleLangChange);
  }, []);

  const t = RISK_PAGE_I18N[lang] || RISK_PAGE_I18N.en;
  const isTa = lang === 'ta';

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

  // Tab State: Issue Review vs Run-Rate Pace
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

  // Filters for Run-rate Tab
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
      const authoritativeDate = getAuthoritativeServerDate().toISOString().split('T')[0];
      params.append('asOfDate', authoritativeDate);
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
  const [pageSize, setPageSize] = useState<number>(10);

  const limitOptions: Option[] = useMemo(() => [
    { value: '5', label: isTa ? '5 / பக்கம்' : '5 per page' },
    { value: '10', label: isTa ? '10 / பக்கம்' : '10 per page' },
    { value: '20', label: isTa ? '20 / பக்கம்' : '20 per page' },
    { value: '50', label: isTa ? '50 / பக்கம்' : '50 per page' },
  ], [isTa]);

  useEffect(() => {
    setCurrentPage(1);
  }, [riskLevelFilter, buyerFilter, unitFilter, stageFilter, searchTerm, pageSize]);

  const totalPages = Math.ceil(sortedRisks.length / pageSize) || 1;
  const paginatedRisks = sortedRisks.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const buyerOptions: Option[] = [
    { value: 'ALL', label: t.allBuyers },
    ...buyers.map((b) => ({
      value: b.id,
      label: b.name,
      sublabel: b.code,
    })),
  ];

  const unitOptions: Option[] = [
    { value: 'ALL', label: t.allUnits },
    ...units.map((u) => ({
      value: u.id,
      label: u.name,
      badge: u.type === 'SUBCONTRACTOR' ? t.subcontract : t.inHouse,
    })),
  ];

  const stageOptions: Option[] = [
    { value: 'ALL', label: t.allStages },
    ...Object.entries(STAGE_LABELS_BILINGUAL).map(([key, item]) => ({
      value: key,
      label: item[lang] || item.en,
    })),
  ];

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* Top Header Bar: Title on Left, Refresh All on Right */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {t.pageTitle}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t.pageSubtitle}
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
          <span>{t.refreshAll}</span>
        </button>
      </div>

      {/* Single Horizontal Toolbar: Short Buttons on Left, Factory At-Risk on Right */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        {/* Short Professional Tab Buttons (Light Theme Active State, No Numbers) */}
        <div className="inline-flex items-center gap-2 max-w-full overflow-x-auto no-scrollbar pb-0.5">
          <button
            type="button"
            onClick={() => setActiveTab('REVIEW_GATE')}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'REVIEW_GATE'
                ? 'bg-sky-100 text-sky-900 border-2 border-sky-600 shadow-xs'
                : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs'
            }`}
          >
            <ShieldAlert className={`w-4 h-4 ${activeTab === 'REVIEW_GATE' ? 'text-sky-700' : 'text-slate-500'}`} />
            <span>{t.tabIssueReview}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('RUN_RATE')}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'RUN_RATE'
                ? 'bg-sky-100 text-sky-900 border-2 border-sky-600 shadow-xs'
                : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs'
            }`}
          >
            <TrendingUp className={`w-4 h-4 ${activeTab === 'RUN_RATE' ? 'text-sky-700' : 'text-slate-500'}`} />
            <span>{t.tabRunRatePace}</span>
          </button>
        </div>

        {/* Unified Factory At-Risk Badge (Horizontal Right) */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-black shadow-3xs self-start sm:self-auto shrink-0">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-slate-600 font-bold uppercase text-[10px] tracking-wide">{t.factoryAtRisk}:</span>
          <span className="font-mono text-sm font-black text-rose-700">
            ₹{(summary.totalExposureRupees || alertSummary?.totalAtRiskRupees || 0).toLocaleString()}
          </span>
        </div>
      </div>

      {/* TAB 1: ISSUE REVIEW (Review Gate) */}
      {activeTab === 'REVIEW_GATE' && (
        <div className="space-y-4 min-w-0">
          {/* Status Sub-Filters for Review Gate */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200 shadow-xs min-w-0">
            <div className="flex items-center p-1 bg-slate-100 rounded-xl gap-1 overflow-x-auto no-scrollbar max-w-full">
              {(
                [
                  { id: 'PENDING_REVIEW', label: t.filterPendingReview, count: alertSummary?.totalPendingReview },
                  { id: 'CONFIRMED', label: t.filterInformedToBuyer, count: alertSummary?.totalConfirmed },
                  { id: 'OVERRIDDEN', label: t.filterHandledInternally, count: alertSummary?.totalOverridden },
                  { id: 'ALL', label: t.filterAllOperationalAlerts, count: undefined },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAlertStatusFilter(tab.id)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
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

            <span className="text-xs text-slate-500 font-semibold shrink-0">
              {t.showingAlerts(alerts.length)}
            </span>
          </div>

          {/* Alert Cards List */}
          {alertsLoading ? (
            <div className="p-10 text-center bg-white rounded-2xl border border-slate-200">
              <div className="w-7 h-7 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-semibold">{t.loadingAlerts}</p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">{t.noAlertsTitle}</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {t.noAlertsSubtitle}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {alerts.map((alert) => (
                <RiskReviewCard
                  key={alert.id}
                  alert={alert}
                  onAlertUpdated={handleAlertUpdated}
                  lang={lang}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RUN-RATE PACE (Run-Rate Throughput Engine) */}
      {activeTab === 'RUN_RATE' && (
        <div className="space-y-4">
          {/* KPI Metric Cards (Clean 4-Card Grid - Financial Exposure Removed) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {t.kpiMonitoredOrders}
              </div>
              <div className="text-lg font-bold text-slate-800 mt-0.5 font-mono">
                {summary.totalMonitoredOrders}
              </div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-rose-200 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                {t.kpiCriticalDeficit}
              </div>
              <div className="text-lg font-bold text-rose-700 mt-0.5 font-mono">{summary.redCount}</div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                {t.kpiBufferCaution}
              </div>
              <div className="text-lg font-bold text-amber-700 mt-0.5 font-mono">{summary.amberCount}</div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                {t.kpiOnTrack}
              </div>
              <div className="text-lg font-bold text-emerald-700 mt-0.5 font-mono">{summary.greenCount}</div>
            </div>
          </div>

          {/* Filter Toolbar */}
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
                          <span className="sm:hidden">{t.filterAll}</span>
                          <span className="hidden sm:inline">{t.filterAllRisks}</span>
                        </>
                      ) : lvl === 'RED' ? (
                        t.filterCriticalDeficit
                      ) : lvl === 'AMBER' ? (
                        t.filterBufferCaution
                      ) : lvl === 'GREEN' ? (
                        t.filterOnTrack
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
                  <span>{t.filterToggle}</span>
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
                  placeholder={t.searchPlaceholder}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </form>
            </div>

            {/* Custom Select Filters */}
            <div className={`grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 text-xs ${isMobileFilterExpanded ? 'block' : 'hidden sm:grid'}`}>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  {t.labelBuyer}
                </label>
                <CustomSelect
                  value={buyerFilter}
                  options={buyerOptions}
                  onChange={(v) => setBuyerFilter(v)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  {t.labelUnit}
                </label>
                <CustomSelect
                  value={unitFilter}
                  options={unitOptions}
                  onChange={(v) => setUnitFilter(v)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  {t.labelStage}
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
              <p className="text-xs text-slate-500 font-semibold">{t.evaluatingRunRates}</p>
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
              <h4 className="text-sm font-bold text-slate-800">{t.noOrdersMatch}</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {t.noOrdersMatchSub}
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

                const stageNameLocalized =
                  STAGE_LABELS_BILINGUAL[item.activeStage]?.[lang] ||
                  STAGE_LABELS_BILINGUAL[item.activeStage]?.en ||
                  item.activeStage;

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
                    {/* Order Header Summary Styled with Dark Navy */}
                    <div className="px-3.5 sm:px-4 py-2.5 border-b border-[#143D60] flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 bg-[#0C2D48] text-white">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          to={`/orders/${item.orderId}`}
                          className="font-mono text-sm font-extrabold text-sky-400 hover:text-sky-200 transition inline-flex items-center gap-1"
                        >
                          <span>{item.poNumber}</span>
                          <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                        </Link>
                        <span className="text-white/40 font-light">•</span>
                        <span className="text-sm font-bold text-white">{item.style.split(' (')[0].split(' - ')[0]}</span>
                        <span className="text-white/40 font-light">•</span>
                        <span className="text-xs text-slate-300 font-medium">
                          {item.buyer?.name} ({item.unit?.name})
                        </span>
                        <span className="text-white/40 font-light">•</span>
                        <span className="text-[11px] font-semibold text-sky-200 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-700">
                          {t.stagePrefix}: {stageNameLocalized}
                        </span>

                        {/* Status Badge Tag */}
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-950 bg-emerald-400 px-2 py-0.5 rounded-full border border-emerald-300 shadow-2xs">
                            <CheckCircle2 className="w-3 h-3 text-emerald-900" />
                            {t.completedBadge}
                          </span>
                        ) : item.riskLevel === 'RED' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-950 bg-rose-400 px-2 py-0.5 rounded-full border border-rose-300 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-900 animate-pulse" />
                            {item.varianceQtyPerDay < 0
                              ? `${t.kpiCriticalDeficit} (${item.varianceQtyPerDay} pcs/d)`
                              : `${lang === 'ta' ? 'கூடுதல் பற்றாக்குறை' : 'Extra Deficit'} (+${item.varianceQtyPerDay} pcs/d)`}
                          </span>
                        ) : item.riskLevel === 'AMBER' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-950 bg-amber-400 px-2 py-0.5 rounded-full border border-amber-300 shadow-2xs">
                            {t.kpiBufferCaution} ({item.varianceQtyPerDay >= 0 ? `+${item.varianceQtyPerDay}` : item.varianceQtyPerDay} pcs/d)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-950 bg-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 shadow-2xs">
                            {t.kpiOnTrack} (+{item.varianceQtyPerDay} pcs/d)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 self-end sm:self-auto text-xs text-slate-300">
                        <div>
                          {t.exFactoryLabel}:{' '}
                          <strong className="text-white font-semibold">
                            {new Date(item.exFactoryDate).toLocaleDateString(
                              lang === 'ta' ? 'ta-IN' : 'en-GB',
                              {
                                day: '2-digit',
                                month: 'short',
                              }
                            )}
                          </strong>{' '}
                          <span className="text-amber-300 font-bold">({t.daysLeft(calculateWorkingDaysLeft(item.exFactoryDate))})</span>
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
                        stageName={stageNameLocalized}
                        exFactoryDate={item.exFactoryDate}
                      />
                    </div>
                  </div>
                );
              })}

              {/* Pagination Controls for Monitored Orders */}
              {sortedRisks.length > 0 && (
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <span className="text-slate-500 font-medium">
                    {t.showingOrdersPagination(
                      (currentPage - 1) * pageSize + 1,
                      Math.min(currentPage * pageSize, sortedRisks.length),
                      sortedRisks.length
                    )}
                  </span>

                  <div className="flex items-center gap-4 flex-wrap">
                    {/* Rows per page selector with CustomSelect */}
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <span className="text-slate-400">{isTa ? 'வரிசைகள்:' : 'Rows:'}</span>
                      <CustomSelect
                        value={pageSize.toString()}
                        options={limitOptions}
                        onChange={(val) => {
                          setPageSize(Number(val));
                          setCurrentPage(1);
                        }}
                        className="w-28"
                        buttonClassName="py-1 px-2.5"
                        menuPlacement="top"
                      />
                    </div>

                    {/* Prev / Page / Next Buttons */}
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
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
