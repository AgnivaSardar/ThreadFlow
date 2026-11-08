import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../services/api';
import { useAuthStore } from '../auth/authStore';
import { CustomSelect, Option } from '../../components/CustomSelect';
import { getSafeImageUrl, handleImageError, STAGE_INSPECTION_IMAGES } from '../../utils/imageUtils';
import {
  Globe,
  MapPin,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Search,
  Image as ImageIcon,
  Package,
  X,
  RefreshCw,
  Maximize2,
  Filter,
  MessageSquare,
  SendHorizontal,
  Activity,
  Building2,
  Check,
  Sparkles,
  Printer,
  Download,
  ExternalLink,
} from 'lucide-react';
import { exportOrdersToCsv } from '../reports/exportService';
import { WeeklyReportPrintModal } from '../reports/WeeklyReportPrintModal';
import { useLanguage } from '../../hooks/useLanguage';
import { STAGE_TRANSLATIONS } from '../supervisor/supervisorTranslations';

interface BuyerProfile {
  id: string;
  name: string;
  code: string;
  country: string | null;
  contactEmail: string | null;
  activeOrderCount: number;
}

interface MilestoneItem {
  id: string;
  stage: string;
  sequenceOrder: number;
  plannedStart: string;
  plannedEnd: string;
  targetQuantity: number;
  completedQuantity: number;
  isCompleted: boolean;
}

interface ConfirmedAlertItem {
  id: string;
  stage: string;
  riskLevel: 'GREEN' | 'AMBER' | 'RED';
  mitigationPlan: string | null;
  reviewedAt: string;
  daysLate: number;
}

interface ApprovedPhotoItem {
  id: string;
  s3Url: string;
  stage: string;
  timestamp: string;
  shift: string;
  machineLine: string;
}

export interface DailyLogItem {
  id: string;
  stage: string;
  shift: string;
  machineLine: string;
  goodQuantity: number;
  rejectedQuantity: number;
  notes: string;
  timestamp: string;
  supervisorName: string;
  photosCount: number;
}

export interface BuyerResponseItem {
  id: string;
  message: string;
  timestamp: string;
  userName: string;
  userEmail: string;
  entityId?: string;
}

interface BuyerOrderItem {
  id: string;
  poNumber: string;
  style: string;
  description: string | null;
  totalQuantity: number;
  currency: string;
  exchangeRate: number;
  fobPricePerPiece: number | null;
  totalOrderValue: number | null;
  orderDate: string;
  exFactoryDate: string;
  daysToExFactory: number;
  activeStage: string;
  progressPercent: number;
  completedStages: number;
  totalStages: number;
  unit: {
    id: string;
    name: string;
    code: string;
    location: string | null;
  };
  milestones: MilestoneItem[];
  confirmedAlerts: ConfirmedAlertItem[];
  approvedPhotos: ApprovedPhotoItem[];
  latestDailyLog: DailyLogItem | null;
  buyerResponses: BuyerResponseItem[];
}

const QUICK_FEEDBACK_PILLS = [
  'Output approved — proceed with next scheduled milestone',
  'Quality inspection verified — proceed to packaging',
  'Note: Verify seam tension and collar balance on next shift',
  'Vessel shipping window and booking confirmed',
];

export const BuyerPortalPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasRole } = useAuthStore();
  const { isTa, t } = useLanguage();

  const [profile, setProfile] = useState<BuyerProfile | null>(null);
  const [orders, setOrders] = useState<BuyerOrderItem[]>([]);
  const [availableBuyers, setAvailableBuyers] = useState<{ id: string; name: string; code: string; country?: string | null }[]>([]);
  const [selectedBuyerId, setSelectedBuyerId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'ORDERS' | 'GALLERY'>('ORDERS');

  // Interactive Buyer Daily Response State
  const [feedbackInputs, setFeedbackInputs] = useState<Record<string, string>>({});
  const [submittingOrderId, setSubmittingOrderId] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<Record<string, boolean>>({});

  // Lightbox modal for approved photos
  const [lightboxPhoto, setLightboxPhoto] = useState<ApprovedPhotoItem | null>(null);

  // Feature 14: Weekly Report Print / PDF Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxPhoto) setLightboxPhoto(null);
        if (isPrintModalOpen) setIsPrintModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxPhoto, isPrintModalOpen]);

  const isMerchandiserOrAdmin = hasRole('MERCHANDISER', 'ADMIN');

  // Fetch available buyers for merchandiser dropdown
  useEffect(() => {
    if (isMerchandiserOrAdmin) {
      apiRequest<{ success: boolean; data: { buyers: any[] } }>('/orders/master-data')
        .then((res) => {
          if (res.data?.buyers) {
            setAvailableBuyers(res.data.buyers);
          }
        })
        .catch(() => {});
    }
  }, [isMerchandiserOrAdmin]);

  // Fetch profile and orders
  const fetchData = async (overrideBuyerId?: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const buyerParam = overrideBuyerId || selectedBuyerId;
      const queryStr = buyerParam ? `?buyerId=${encodeURIComponent(buyerParam)}` : '';

      const [profileRes, ordersRes] = await Promise.all([
        apiRequest<{ success: boolean; data: BuyerProfile }>(`/buyer-portal/profile${queryStr}`),
        apiRequest<{ success: boolean; data: BuyerOrderItem[] }>(`/buyer-portal/orders${queryStr}`),
      ]);

      setProfile(profileRes.data);
      if (!selectedBuyerId && profileRes.data?.id) {
        setSelectedBuyerId(profileRes.data.id);
      }
      setOrders(ordersRes.data || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load buyer portal data. Please sign in.');
      if (err.status === 401) {
        navigate('/login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handler when merchandiser selects another buyer in custom dropdown
  const handleBuyerChange = (newBuyerId: string) => {
    setSelectedBuyerId(newBuyerId);
    fetchData(newBuyerId);
  };

  // Submit Buyer Daily Response
  const handlePostFeedback = async (orderId: string, customMessage?: string) => {
    const textToSubmit = (customMessage || feedbackInputs[orderId] || '').trim();
    if (!textToSubmit) return;

    setSubmittingOrderId(orderId);
    try {
      const res = await apiRequest<{ success: boolean; data: BuyerResponseItem }>(
        `/buyer-portal/orders/${orderId}/feedback`,
        {
          method: 'POST',
          body: JSON.stringify({ message: textToSubmit }),
        }
      );

      if (res.data) {
        // Update local state so the response immediately renders in the audit trail
        setOrders((prev) =>
          prev.map((o) => {
            if (o.id !== orderId) return o;
            return {
              ...o,
              buyerResponses: [res.data, ...(o.buyerResponses || [])],
            };
          })
        );
        setFeedbackInputs((prev) => ({ ...prev, [orderId]: '' }));
        setFeedbackSuccess((prev) => ({ ...prev, [orderId]: true }));
        setTimeout(() => {
          setFeedbackSuccess((prev) => ({ ...prev, [orderId]: false }));
        }, 3000);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to submit response');
    } finally {
      setSubmittingOrderId(null);
    }
  };

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesSearch =
        order.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.style.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (order.description && order.description.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (statusFilter === 'IN_PRODUCTION' && order.progressPercent >= 100) {
        return false;
      }
      if (statusFilter === 'COMPLETED' && order.progressPercent < 100) {
        return false;
      }

      if (stageFilter !== 'ALL' && order.activeStage !== stageFilter) {
        return false;
      }

      return true;
    });
  }, [orders, searchQuery, statusFilter, stageFilter]);

  // Aggregate all approved inspection photos across all buyer orders
  const allApprovedPhotos = useMemo(() => {
    return orders.flatMap((o) =>
      o.approvedPhotos.map((p) => ({
        ...p,
        poNumber: o.poNumber,
        style: o.style,
      }))
    );
  }, [orders]);

  // Total Contracted Pieces
  const totalContractedPcs = useMemo(() => {
    return orders.reduce((sum, o) => sum + o.totalQuantity, 0);
  }, [orders]);

  // Helper date formatter
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Dropdown Options
  const statusOptions: Option[] = [
    { value: 'ALL', label: isTa ? 'அனைத்து நிலைகளும்' : 'All Statuses' },
    { value: 'IN_PRODUCTION', label: isTa ? 'உற்பத்தியில் உள்ளது' : 'In Production', badge: isTa ? 'செயலில்' : 'Active' },
    { value: 'COMPLETED', label: isTa ? 'முடிந்தது' : 'Completed', badge: isTa ? 'முடிந்தது' : 'Done' },
  ];

  const stageOptions: Option[] = [
    { value: 'ALL', label: isTa ? 'அனைத்து 7 TNA நிலைகளும்' : 'All 7 TNA Stages' },
    { value: 'KNITTING', label: isTa ? 'பின்னல்' : 'Knitting' },
    { value: 'DYEING_WASHING', label: isTa ? 'சலவை / சாயம்' : 'Dyeing & Washing' },
    { value: 'PRINTING', label: isTa ? 'அச்சிடுதல்' : 'Printing & Embroidery' },
    { value: 'CUTTING', label: isTa ? 'வெட்டுதல்' : 'Fabric Cutting' },
    { value: 'STITCHING', label: isTa ? 'தையல்' : 'Assembly & Stitching' },
    { value: 'CHECKING', label: isTa ? 'சரிபார்த்தல்' : 'Quality Checking' },
    { value: 'FINISHING', label: isTa ? 'முடித்தல் & பேக்கிங்' : 'Finishing & Packing' },
  ];

  const buyerOptions: Option[] = availableBuyers.map((b) => ({
    value: b.id,
    label: b.name,
    badge: b.country || b.code,
  }));

  if (isLoading && !profile) {
    return (
      <div className="space-y-4 pb-12 animate-pulse">
        <div className="h-14 bg-slate-200 rounded-xl w-1/3" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="h-20 bg-slate-200 rounded-xl" />
          <div className="h-20 bg-slate-200 rounded-xl" />
          <div className="h-20 bg-slate-200 rounded-xl" />
          <div className="h-20 bg-slate-200 rounded-xl" />
        </div>
        <div className="h-64 bg-slate-200 rounded-2xl" />
      </div>
    );
  }

  if (errorMessage && !profile) {
    return (
      <div className="p-8 max-w-md mx-auto my-12 text-center bg-white rounded-2xl border border-rose-200 shadow-xs space-y-4">
        <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center mx-auto">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Portal Access Restricted</h3>
        <p className="text-xs text-slate-600 leading-relaxed">{errorMessage}</p>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="px-4 py-2 bg-[#0C2D48] text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition cursor-pointer"
        >
          Return to Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* ======================================================== */}
      {/* 1. TOP HEADER: Matching OrdersPage & RiskPage Layout     */}
      {/* Prominently features Company Name and Location           */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {profile?.name || 'Buyer Portal'}
            </h1>
          </div>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap text-sm font-semibold text-slate-600">
            <span className="flex items-center gap-1.5 text-sky-800 bg-sky-50 px-2.5 py-0.5 rounded-lg border border-sky-100">
              <MapPin className="w-4 h-4 text-sky-600" />
              <span className="font-bold">{profile?.country || '-'}</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-medium text-slate-500">
              {t.buyer.directTransparency}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          {/* Merchandiser/Admin Buyer Selector Dropdown */}
          {isMerchandiserOrAdmin && buyerOptions.length > 0 && (
            <div className="w-56">
              <CustomSelect
                value={selectedBuyerId || profile?.id || ''}
                options={buyerOptions}
                onChange={handleBuyerChange}
                placeholder={isTa ? 'வாங்குபவர் பார்வையை மாற்றவும்...' : 'Switch Buyer View...'}
              />
            </div>
          )}

          {/* Feature 14: One-Click Weekly Status Export Button */}
          <button
            type="button"
            onClick={() => {
              if (profile) exportOrdersToCsv(profile, orders as any);
            }}
            disabled={orders.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-xl text-xs shadow-2xs transition cursor-pointer disabled:opacity-50"
            title="Download RFC 4180 CSV spreadsheet"
          >
            <Download className="w-3.5 h-3.5 text-sky-700" />
            <span className="hidden sm:inline">{t.common.exportCsv}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPrintModalOpen(true)}
            disabled={orders.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-xl text-xs shadow-2xs transition cursor-pointer disabled:opacity-50"
            title="View and print official weekly PDF status report"
          >
            <Printer className="w-3.5 h-3.5 text-emerald-700" />
            <span>{t.buyer.weeklyPdf}</span>
          </button>

          <button
            type="button"
            onClick={() => fetchData()}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs transition cursor-pointer"
            title="Refresh order statuses"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{t.buyer.refreshPortal}</span>
          </button>
        </div>
      </div>

      {/* 2. FILTER BAR WITH CUSTOM DROPDOWNS & SEARCH */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={t.buyer.searchPo}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40 transition"
            />
          </div>

          {/* Custom Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:flex items-center gap-2.5 w-full md:w-auto">
            <div className="w-full sm:w-44">
              <CustomSelect
                value={statusFilter}
                options={statusOptions}
                onChange={setStatusFilter}
                placeholder={t.buyer.filterStatus}
              />
            </div>

            <div className="w-full sm:w-52">
              <CustomSelect
                value={stageFilter}
                options={stageOptions}
                onChange={setStageFilter}
                placeholder={t.buyer.filterStage}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. ORDERS LIST VIEW (7-Stage TNA Progress) */}
      <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-2">
                <Package className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">{t.buyer.noOrdersFound}</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {t.buyer.adjustFilters}
              </p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const isFinished = order.progressPercent >= 100;
              return (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all overflow-hidden"
                >
                  {/* Order Header Bar Styled with Dark Navy */}
                  <div className="px-4 py-3 bg-[#0C2D48] text-white border-b border-[#143D60] flex flex-wrap items-center justify-between gap-2.5 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-extrabold text-sky-400 inline-flex items-center gap-1 cursor-default">
                        <span>{order.poNumber}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                      </span>
                      <span className="text-white/40">•</span>
                      <span className="font-bold text-white">{order.style.split(' (')[0].split(' - ')[0]}</span>
                      <span className="text-white/40">•</span>
                      <span className="font-medium text-sky-100">
                        {order.totalQuantity.toLocaleString()} {t.common.pieces}
                      </span>
                      <span className="text-white/40">•</span>
                      <span className="font-semibold text-sky-200">
                        {t.buyer.productionHub} {order.unit?.name || '-'}
                      </span>
                      {order.currency && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-white/15 text-sky-200 border border-white/20">
                          {order.currency}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div className="text-xs text-slate-300 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-sky-300" />
                        <span>{t.common.exFactory}: <strong className="text-white font-semibold">{formatDate(order.exFactoryDate)}</strong></span>
                      </div>

                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border shadow-2xs ${
                          order.daysToExFactory <= 5
                            ? 'bg-rose-500 text-white border-rose-400'
                            : order.daysToExFactory <= 14
                            ? 'bg-amber-400 text-amber-950 border-amber-300'
                            : 'bg-emerald-400 text-emerald-950 border-emerald-300'
                        }`}
                      >
                        {order.daysToExFactory > 0
                          ? `${order.daysToExFactory}${t.buyer.daysLeft}`
                          : t.buyer.shipmentWindow}
                      </span>
                    </div>
                  </div>

                  {/* Order Body */}
                  <div className="p-4 space-y-4">
                    {/* Overall Progress Bar */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-bold text-slate-700 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-sky-600" />
                          <span>{t.buyer.milestoneCompletion}</span>
                          <strong className="text-slate-900 font-black">
                            {order.progressPercent}%
                          </strong>
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          {t.buyer.activeStageLabel}{' '}
                          <strong className="text-sky-800 font-bold uppercase tracking-wide">
                            {isTa ? STAGE_TRANSLATIONS[order.activeStage]?.ta || order.activeStage : order.activeStage.replace(/_/g, ' ')}
                          </strong>
                        </span>
                      </div>

                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${
                            isFinished
                              ? 'bg-emerald-500'
                              : 'bg-gradient-to-r from-sky-600 to-[#0C2D48]'
                          }`}
                          style={{ width: `${order.progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* 7-Stage TNA Pipeline Track */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-1">
                      {order.milestones.map((m) => {
                        const stageLabel = m.stage.replace(/_/g, ' ');
                        return (
                          <div
                            key={m.id}
                            className={`p-2 rounded-xl border text-[11px] space-y-1 transition ${
                              m.isCompleted
                                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                                : m.stage === order.activeStage
                                ? 'bg-sky-50 border-sky-300 text-sky-950 shadow-2xs ring-1 ring-sky-300'
                                : 'bg-slate-50/60 border-slate-200 text-slate-500'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-[10px] text-slate-400">
                                #{m.sequenceOrder}
                              </span>
                              {m.isCompleted ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              ) : m.stage === order.activeStage ? (
                                <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                              ) : (
                                <Clock className="w-3 h-3 text-slate-300 shrink-0" />
                              )}
                            </div>

                            <div className="font-bold capitalize truncate" title={stageLabel}>
                              {stageLabel}
                            </div>

                            <div className="text-[10px] text-slate-500 font-mono">
                              {m.completedQuantity.toLocaleString()} / {m.targetQuantity.toLocaleString()}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Vetted Delivery Mitigation Bulletins (Only Confirmed Alerts) */}
                    {order.confirmedAlerts.length > 0 && (
                      <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-amber-950 font-bold">
                          <span className="flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                            Confirmed Operational Mitigation Directive
                          </span>
                          <span className="text-[10px] text-amber-700 font-medium">
                            Verified by Merchandiser
                          </span>
                        </div>

                        {order.confirmedAlerts.map((alert) => (
                          <div
                            key={alert.id}
                            className="text-xs text-slate-800 bg-white p-2.5 rounded-lg border border-amber-200/70 shadow-2xs"
                          >
                            <p className="leading-relaxed">
                              {alert.mitigationPlan ||
                                'Floor schedule balanced to ensure on-time ex-factory departure.'}
                            </p>
                            <div className="mt-1 text-[10px] text-slate-400 font-medium">
                              Stage: {alert.stage.replace(/_/g, ' ')} • Logged on{' '}
                              {formatDate(alert.reviewedAt)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ======================================================== */}
                    {/* NEW: LATEST DAILY PRODUCTION LOG OF THE DAY              */}
                    {/* ======================================================== */}
                    <div className="bg-slate-50/80 rounded-xl border border-slate-200 p-3.5 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                            <Activity className="w-3.5 h-3.5" />
                          </div>
                          <span className="font-bold text-xs text-slate-800">
                            Latest Floor Work Log (Today / Recent Shift)
                          </span>
                          {order.latestDailyLog && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                              {order.latestDailyLog.shift} SHIFT
                            </span>
                          )}
                        </div>

                        {order.latestDailyLog && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-2">
                            <span>Supervisor: <strong className="text-slate-700 font-semibold">{order.latestDailyLog.supervisorName}</strong></span>
                            <span className="text-slate-300">•</span>
                            <span>{new Date(order.latestDailyLog.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          </div>
                        )}
                      </div>

                      {order.latestDailyLog ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div className="bg-white p-2 rounded-lg border border-slate-200">
                              <div className="text-[10px] font-semibold text-slate-400 uppercase">Stage</div>
                              <div className="font-bold text-slate-800 font-mono mt-0.5">
                                {order.latestDailyLog.stage.replace(/_/g, ' ')}
                              </div>
                            </div>
                            <div className="bg-white p-2 rounded-lg border border-slate-200">
                              <div className="text-[10px] font-semibold text-slate-400 uppercase">Machine Line</div>
                              <div className="font-bold text-slate-800 font-mono mt-0.5">
                                {order.latestDailyLog.machineLine}
                              </div>
                            </div>
                            <div className="bg-white p-2 rounded-lg border border-emerald-200">
                              <div className="text-[10px] font-semibold text-emerald-600 uppercase">Good Output</div>
                              <div className="font-bold text-emerald-800 font-mono mt-0.5">
                                +{order.latestDailyLog.goodQuantity.toLocaleString()} pcs
                              </div>
                            </div>
                            <div className="bg-white p-2 rounded-lg border border-slate-200">
                              <div className="text-[10px] font-semibold text-slate-400 uppercase">Defect / Rejection</div>
                              <div className={`font-bold font-mono mt-0.5 ${order.latestDailyLog.rejectedQuantity > 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                                {order.latestDailyLog.rejectedQuantity} pcs
                              </div>
                            </div>
                          </div>

                          {/* Supervisor Note strictly in English */}
                          <div className="text-xs bg-white p-2.5 rounded-lg border border-slate-200 text-slate-700 flex items-start gap-2">
                            <span className="font-semibold text-slate-900 shrink-0">Supervisor Note:</span>
                            <p className="text-slate-600 italic leading-relaxed">
                              {order.latestDailyLog.notes || 'Floor operations running as scheduled.'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="py-2.5 text-center text-xs text-slate-500 italic bg-white rounded-lg border border-dashed border-slate-200">
                          No shift updates filed today yet for this PO — awaiting supervisor synchronization.
                        </div>
                      )}
                    </div>

                    {/* ======================================================== */}
                    {/* NEW: BUYER INTERACTIVE DAILY RESPONSE & SIGN-OFF         */}
                    {/* ======================================================== */}
                    <div className="bg-gradient-to-r from-sky-50/50 to-indigo-50/30 rounded-xl border border-sky-100 p-3.5 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-sky-600 text-white flex items-center justify-center shadow-xs">
                          <MessageSquare className="w-3.5 h-3.5" />
                        </div>
                        <h5 className="text-xs font-bold text-slate-900">
                          {t.buyer.buyerFeedbackTitle}
                        </h5>
                      </div>

                      {/* Previous Responses */}
                      {order.buyerResponses && order.buyerResponses.length > 0 && (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {order.buyerResponses.map((resp) => (
                            <div
                              key={resp.id}
                              className="bg-white p-2.5 rounded-lg border border-sky-100 shadow-2xs space-y-1 text-xs"
                            >
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  {resp.userName} ({resp.userEmail || (isTa ? 'வாங்குபவர் பிரதிநிதி' : 'Buyer Representative')})
                                </span>
                                <span className="text-slate-400 font-mono">
                                  {new Date(resp.timestamp).toLocaleString(undefined, {
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              <p className="text-slate-700 text-xs pl-3 border-l-2 border-sky-400 leading-relaxed">
                                {resp.message}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Only Foreign BUYER and ADMIN are authorized to submit buyer daily feedback responses */}
                      {hasRole('BUYER', 'ADMIN') ? (
                        <>
                      {/* Quick Response Preset Pills in ONE LINE */}
                      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
                          {isTa ? 'விரைவு பதில்கள்:' : 'Quick Presets:'}
                        </span>
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                          {QUICK_FEEDBACK_PILLS.map((pill, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() =>
                                setFeedbackInputs((prev) => ({
                                  ...prev,
                                  [order.id]: pill,
                                }))
                              }
                              className="text-[11px] px-2.5 py-1 bg-white hover:bg-sky-50 border border-slate-200 hover:border-sky-300 rounded-lg text-slate-700 transition cursor-pointer font-medium whitespace-nowrap shrink-0 shadow-3xs"
                            >
                              {pill}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Response Input Bar */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="text"
                          placeholder={t.buyer.feedbackPlaceholder}
                          value={feedbackInputs[order.id] || ''}
                          onChange={(e) =>
                            setFeedbackInputs((prev) => ({
                              ...prev,
                              [order.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handlePostFeedback(order.id);
                            }
                          }}
                          className="flex-1 min-w-0 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40 transition"
                        />

                        <button
                          type="button"
                          onClick={() => handlePostFeedback(order.id)}
                          disabled={
                            submittingOrderId === order.id ||
                            !(feedbackInputs[order.id] && feedbackInputs[order.id].trim())
                          }
                          className="w-full sm:w-auto justify-center inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0C2D48] hover:bg-[#143D60] text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
                        >
                          {submittingOrderId === order.id ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>{t.buyer.saving}</span>
                            </>
                          ) : feedbackSuccess[order.id] ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span>{t.buyer.recorded}</span>
                            </>
                          ) : (
                            <>
                              <SendHorizontal className="w-3.5 h-3.5" />
                              <span>{t.buyer.postResponse}</span>
                            </>
                          )}
                        </button>
                      </div>
                        </>
                      ) : (
                        <div className="p-3 bg-white/70 rounded-xl border border-sky-100 text-[11px] text-slate-500 italic flex items-center justify-between">
                          <span>Buyer Daily Response input is authenticated for foreign buyers only. Merchandisers have oversight audit access.</span>
                          <span className="text-[10px] font-mono font-bold text-sky-700 uppercase bg-sky-50 px-2 py-0.5 rounded border border-sky-200">READ ONLY</span>
                        </div>
                      )}
                    </div>

                    {/* Order Visual Proof Thumbnails */}
                    {order.approvedPhotos.length > 0 && (
                      <div className="pt-2 border-t border-slate-100">
                        <div className="text-[11px] font-bold text-slate-600 mb-2 flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span>Approved Quality & Inspection Evidence ({order.approvedPhotos.length})</span>
                        </div>

                        <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                          {order.approvedPhotos.map((photo) => (
                            <button
                              key={photo.id}
                              type="button"
                              onClick={() => setLightboxPhoto(photo)}
                              className="group relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0 cursor-pointer hover:border-sky-500 transition shadow-2xs"
                              title={`View ${photo.stage} inspection photo`}
                            >
                              <img
                                src={getSafeImageUrl(photo.s3Url, photo.stage)}
                                onError={(e) => handleImageError(e, photo.stage)}
                                alt="Inspection evidence"
                                className="w-full h-full object-cover group-hover:scale-105 transition"
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                <Maximize2 className="w-3.5 h-3.5 text-white" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

      {/* ======================================================== */}
      {/* 6. LIGHTBOX MODAL FOR INSPECTION EVIDENCE                */}
      {/* ======================================================== */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-sm">
                  {lightboxPhoto.stage.replace(/_/g, ' ')} — Inspection Evidence
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-slate-950 flex items-center justify-center max-h-[60vh] overflow-hidden">
              <img
                src={getSafeImageUrl(lightboxPhoto.s3Url, lightboxPhoto.stage)}
                onError={(e) => handleImageError(e, lightboxPhoto.stage)}
                alt="Full inspection proof"
                className="max-h-[58vh] max-w-full object-contain rounded-lg"
              />
            </div>

            <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <div className="space-y-0.5">
                <div className="font-bold text-slate-900">
                  Machine Line: {lightboxPhoto.machineLine} • {lightboxPhoto.shift} Shift
                </div>
                <div className="text-[11px] text-slate-400">
                  Recorded: {new Date(lightboxPhoto.timestamp).toLocaleString()}
                </div>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 rounded-xl font-bold border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Verified by Quality Merchandiser</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feature 14: Printable PDF / Executive Print Modal */}
      {profile && (
        <WeeklyReportPrintModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          buyer={profile}
          orders={orders as any}
        />
      )}
    </div>
  );
};
