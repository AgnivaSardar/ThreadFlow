import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Building2,
  Clock,
  Layers,
  ShieldCheck,
  AlertTriangle,
  History,
  CheckCircle,
  Hash,
  Loader2,
  DollarSign,
  X,
  Send,
  Zap,
  Mail,
  Camera,
  MessageSquare,
  Sparkles,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  FastForward,
} from 'lucide-react';
import { OrderDetail, UpdateExFactoryDatePayload, RiskEvaluationResult, RiskAlertItem } from '../../types';
import { apiRequest, getAuthoritativeServerDate } from '../../services/api';
import { StatusBadge } from '../../components/StatusBadge';
import { CircularTnaPipeline } from '../tna/CircularTnaPipeline';
import { SizeBreakdownVisualizer } from './SizeBreakdownVisualizer';
import { ShowYourMathCard } from '../risk/ShowYourMathCard';
import { RiskReviewCard } from '../risk/RiskReviewCard';
import { getSafeImageUrl, handleImageError } from '../../utils/imageUtils';
import { useLanguage } from '../../hooks/useLanguage';
import { calculateWorkingDaysLeft } from '../../utils/dateUtils';
import { enforceStagePredecessorCeilings } from '../../utils/milestones';
import {
  translateStage,
  translateUnit,
  translateBuyer,
  translateStyle,
  translateReason,
  translateAction,
  translateRole,
  formatDateLocalized,
} from '../supervisor/supervisorTranslations';

export const OrderDetailPage: React.FC = () => {
  const { lang, isTa, t } = useLanguage();
  const od = t.orderDetails;
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [riskEvaluation, setRiskEvaluation] = useState<RiskEvaluationResult | null>(null);
  const [orderAlerts, setOrderAlerts] = useState<RiskAlertItem[]>([]);

  // Ex-Factory Date Change Modal state
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [reasonCode, setReasonCode] = useState('BUYER_REQUEST');
  const [notes, setNotes] = useState('');
  const [financialImpact, setFinancialImpact] = useState<number>(0);
  const [updatingDate, setUpdatingDate] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [directiveSent, setDirectiveSent] = useState(false);
  const [currentAlertIndex, setCurrentAlertIndex] = useState(0);

  // Manual Stage Advance Modal state
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [advanceFromStage, setAdvanceFromStage] = useState<string>('');
  const [advanceCompletedQty, setAdvanceCompletedQty] = useState<number>(0);
  const [advanceAdjustDownstream, setAdvanceAdjustDownstream] = useState<boolean>(true);
  const [advanceReasonCode, setAdvanceReasonCode] = useState<string>('BUYER_SHORT_SHIP_APPROVAL');
  const [advanceOverrideNotes, setAdvanceOverrideNotes] = useState<string>('');
  const [advancingStage, setAdvancingStage] = useState(false);
  const [advanceModalError, setAdvanceModalError] = useState<string | null>(null);
  const [advanceSuccessMessage, setAdvanceSuccessMessage] = useState<string | null>(null);

  // Lightbox Image Modal state
  const [selectedImageModal, setSelectedImageModal] = useState<{
    url: string;
    stage?: string;
    supervisorName?: string;
    date?: string;
  } | null>(null);

  // Pagination states for Floor Updates Log table and Order Audit History
  const [logPage, setLogPage] = useState(1);
  const logLimit = 5;
  const [auditPage, setAuditPage] = useState(1);
  const auditLimit = 5;

  const totalLogPages = Math.ceil((order?.productionUpdates?.length || 0) / logLimit) || 1;
  const paginatedLogs = (order?.productionUpdates || []).slice(
    (logPage - 1) * logLimit,
    logPage * logLimit
  );

  const totalAuditPages = Math.ceil((order?.auditEvents?.length || 0) / auditLimit) || 1;
  const paginatedAuditEvents = (order?.auditEvents || []).slice(
    (auditPage - 1) * auditLimit,
    auditPage * auditLimit
  );

  const renderPaginationButtons = (
    currentPage: number,
    totalPages: number,
    onSelectPage: (p: number) => void
  ) => {
    if (totalPages <= 1) return null;
    const buttons = [];

    if (totalPages <= 5) {
      for (let p = 1; p <= totalPages; p++) {
        buttons.push(
          <button
            key={p}
            type="button"
            onClick={() => onSelectPage(p)}
            className={`w-7 h-7 rounded-lg text-xs font-bold cursor-pointer transition flex items-center justify-center ${
              currentPage === p
                ? 'bg-[#0C2D48] text-white shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            {p}
          </button>
        );
      }
      return buttons;
    }

    // Fixed first three pages: 1, 2, 3
    [1, 2, 3].forEach((p) => {
      buttons.push(
        <button
          key={p}
          type="button"
          onClick={() => onSelectPage(p)}
          className={`w-7 h-7 rounded-lg text-xs font-bold cursor-pointer transition flex items-center justify-center ${
            currentPage === p
              ? 'bg-[#0C2D48] text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          {p}
        </button>
      );
    });

    if (currentPage > 3 && currentPage < totalPages) {
      if (currentPage > 4) {
        buttons.push(<span key="ellip-mid-start" className="text-slate-500 text-xs font-bold px-1">...</span>);
      }
      buttons.push(
        <button
          key={currentPage}
          type="button"
          onClick={() => onSelectPage(currentPage)}
          className="w-7 h-7 rounded-lg text-xs font-bold cursor-pointer transition flex items-center justify-center bg-[#0C2D48] text-white shadow-xs"
        >
          {currentPage}
        </button>
      );
      if (currentPage < totalPages - 1) {
        buttons.push(<span key="ellip-mid-end" className="text-slate-500 text-xs font-bold px-1">...</span>);
      }
    } else {
      buttons.push(<span key="ellip-end" className="text-slate-500 text-xs font-bold px-1">...</span>);
    }

    // Last page
    buttons.push(
      <button
        key={totalPages}
        type="button"
        onClick={() => onSelectPage(totalPages)}
        className={`w-7 h-7 rounded-lg text-xs font-bold cursor-pointer transition flex items-center justify-center ${
          currentPage === totalPages
            ? 'bg-[#0C2D48] text-white shadow-xs'
            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
        }`}
      >
        {totalPages}
      </button>
    );

    return buttons;
  };

  const fetchRiskEvaluation = async (orderId: string, milestoneId: string) => {
    try {
      const authoritativeDate = getAuthoritativeServerDate().toISOString().split('T')[0];
      const res = await apiRequest<{ success: boolean; data: RiskEvaluationResult }>(
        `/risk/${orderId}/${milestoneId}?asOfDate=${authoritativeDate}`
      );
      if (res.data) {
        setRiskEvaluation(res.data);
      }
    } catch {
      // Non-blocking fallback
    }
  };

  const fetchOrderAlerts = async (orderId: string) => {
    try {
      const res = await apiRequest<{ success: boolean; data: { alerts: RiskAlertItem[] } }>(
        `/risk/alerts?orderId=${orderId}&status=ALL`
      );
      if (res.data?.alerts) {
        setOrderAlerts(res.data.alerts);
      }
    } catch {
      // Non-blocking fallback
    }
  };

  const fetchOrderDetail = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<{ success: boolean; data: OrderDetail }>(`/orders/${id}`);
      if (res.data?.milestones) {
        res.data.milestones = enforceStagePredecessorCeilings(res.data.milestones, res.data.totalQuantity);
      }
      setOrder(res.data);
      if (res.data?.riskEvaluation) {
        setRiskEvaluation(res.data.riskEvaluation);
      }
      if (res.data?.exFactoryDate) {
        setNewDate(new Date(res.data.exFactoryDate).toISOString().split('T')[0]);
      }

      if (res.data?.id && res.data.milestones?.length > 0) {
        const activeMilestone =
          res.data.milestones.find((m) => m.stage === res.data.activeStage) ||
          res.data.milestones.find((m) => m.completedQuantity < m.targetQuantity) ||
          res.data.milestones[0];
        if (activeMilestone) {
          fetchRiskEvaluation(res.data.id, activeMilestone.id);
        }
        fetchOrderAlerts(res.data.id);
      }
    } catch (err: any) {
      if (err.status === 401) {
        window.location.replace('/login');
        return;
      }
      setError(err.message || 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetail();
  }, [id]);

  // Handle Escape key to close open modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedImageModal) setSelectedImageModal(null);
        if (isDateModalOpen) setIsDateModalOpen(false);
        if (isAdvanceModalOpen) setIsAdvanceModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImageModal, isDateModalOpen, isAdvanceModalOpen]);

  const openAdvanceModal = () => {
    if (!order) return;
    setAdvanceModalError(null);
    setAdvanceSuccessMessage(null);
    const activeMilestone =
      order.milestones?.find((m) => m.stage === order.activeStage) ||
      order.milestones?.find((m) => m.completedQuantity < m.targetQuantity) ||
      order.milestones?.[0];

    const currentStage = activeMilestone?.stage || 'KNITTING';
    setAdvanceFromStage(currentStage);
    setAdvanceCompletedQty(activeMilestone ? activeMilestone.completedQuantity : 0);
    setAdvanceAdjustDownstream(true);
    setAdvanceReasonCode('BUYER_SHORT_SHIP_APPROVAL');
    setAdvanceOverrideNotes('');
    setIsAdvanceModalOpen(true);
  };

  const handleStageSelectChange = (stageName: string) => {
    setAdvanceFromStage(stageName);
    const m = order?.milestones?.find((item) => item.stage === stageName);
    if (m) {
      setAdvanceCompletedQty(m.completedQuantity);
    }
  };

  const handleAdvanceStageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !advanceFromStage) return;
    setAdvanceModalError(null);
    setAdvanceSuccessMessage(null);

    if (!advanceOverrideNotes.trim()) {
      setAdvanceModalError('Audit override notes are mandatory when manually advancing or short-closing a stage.');
      return;
    }

    try {
      setAdvancingStage(true);
      const res = await apiRequest<{ success: boolean; message: string }>(`/orders/${id}/advance-stage`, {
        method: 'POST',
        body: JSON.stringify({
          fromStage: advanceFromStage,
          actualCompletedQuantity: Number(advanceCompletedQty) || 0,
          adjustDownstreamTargets: advanceAdjustDownstream,
          reasonCode: advanceReasonCode,
          overrideNotes: advanceOverrideNotes.trim(),
        }),
      });

      setAdvanceSuccessMessage(res.message || 'Stage advanced successfully.');
      setTimeout(async () => {
        setIsAdvanceModalOpen(false);
        setAdvanceSuccessMessage(null);
        setAdvanceOverrideNotes('');
        await fetchOrderDetail();
      }, 1200);
    } catch (err: any) {
      setAdvanceModalError(err.message || 'Failed to advance stage');
    } finally {
      setAdvancingStage(false);
    }
  };

  const handleDateChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setModalError(null);

    if (!reasonCode) {
      setModalError('Reason code is mandatory for all ex-factory date revisions');
      return;
    }

    try {
      setUpdatingDate(true);
      const payload: UpdateExFactoryDatePayload = {
        newExFactoryDate: new Date(newDate).toISOString(),
        reasonCode,
        notes: notes.trim() || undefined,
        financialImpactRupees: Number(financialImpact) || 0,
      };

      await apiRequest(`/orders/${id}/ex-factory-date`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      setIsDateModalOpen(false);
      setNotes('');
      await fetchOrderDetail();
    } catch (err: any) {
      setModalError(err.message || 'Failed to update ex-factory date');
    } finally {
      setUpdatingDate(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
        <span className="text-sm text-slate-500 font-medium">Loading export order details & TNA timeline...</span>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Order Not Found</h2>
        <p className="text-sm text-slate-500">{error || 'Could not retrieve order information.'}</p>
        <Link
          to="/orders"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Orders
        </Link>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/orders"
            className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition shadow-2xs"
            title="Back to Orders"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="text-[11px] font-semibold text-slate-400">{od.breadcrumb}</div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{translateStyle(order.style, lang)}</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* PO Number & Status Badge neatly positioned in the header metadata bar */}
          <div className="flex items-center gap-2 bg-white px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400">PO</span>
            <span className="font-mono text-xs font-bold text-slate-800">
              {order.poNumber}
            </span>
            <div className="h-3 w-px bg-slate-200 mx-0.5" />
            <StatusBadge status={order.healthStatus} size="sm" />
          </div>

          <button
            onClick={() => setIsDateModalOpen(true)}
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs shadow-xs transition cursor-pointer"
          >
            <Calendar className="w-4 h-4" />
            <span>{od.shiftExFactoryDate}</span>
          </button>

          <button
            onClick={openAdvanceModal}
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-[#0C2D48] hover:bg-[#143D60] text-white font-bold rounded-xl text-xs shadow-xs transition cursor-pointer"
            title="Manually advance stage or short-close production"
          >
            <FastForward className="w-4 h-4 text-sky-400" />
            <span>{od.advanceStageManually}</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{od.buyerAndDestination}</div>
          <div className="text-base font-bold text-slate-800 mt-1">
            {translateBuyer(order.buyer.name.replace(/\s*\([^)]*\)$/, ''), lang)}
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            {order.buyer.country || '-'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{od.manufacturingUnit}</div>
          <div className="text-base font-bold text-slate-800 mt-1">{translateUnit(order.unit.name, lang)}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            <span
              className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
                order.unit.type === 'SUBCONTRACTOR' ? 'bg-purple-500' : 'bg-emerald-500'
              }`}
            ></span>
            {order.unit.type === 'SUBCONTRACTOR' ? od.subcontractUnit : od.primaryFactory}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{od.exFactoryDeadline}</div>
          <div className="text-base font-bold text-slate-800 mt-1">{formatDateLocalized(order.exFactoryDate, lang)}</div>
          <div className="text-xs text-amber-600 font-semibold flex items-center gap-1 mt-0.5">
            <Clock className="w-3.5 h-3.5" />
            {calculateWorkingDaysLeft(order.exFactoryDate)} {od.workingDaysLeft} ({t.common.cw} {order.shipWeek})
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{od.orderValueFob}</div>
          <div className="text-base font-bold text-slate-800 mt-1 font-mono">
            ₹{(order.totalOrderValue || 0).toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {order.currency} {order.fobPricePerPiece}/{isTa ? 'துண்டு' : 'pc'} ({order.totalQuantity.toLocaleString()} {od.pcs})
          </div>
        </div>
      </div>

      {/* Size Ratio & Breakdown Graph Visualizer */}
      <SizeBreakdownVisualizer
        sizeProgress={order.sizeProgress}
        hasSkewWarning={order.hasSkewWarning}
        totalPlanned={order.totalPlanned}
        totalCompleted={order.totalCompleted}
        overallCompletionPct={order.overallCompletionPct}
      />

      {/* Size Ratio Floor Rebalancing Directive Card */}
      {order.sizeSkewRecommendation && (
        <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                {od.floorRebalanceDirective}
              </span>
            </div>
            <p className="text-xs text-amber-900 font-medium leading-relaxed">
              {order.sizeSkewRecommendation.directive}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setDirectiveSent(true);
              setTimeout(() => setDirectiveSent(false), 3000);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 shadow-xs cursor-pointer ${
              directiveSent
                ? 'bg-emerald-600 text-white'
                : 'bg-[#0C2D48] hover:bg-[#143D60] text-white'
            }`}
          >
            {directiveSent ? (
              <>
                <CheckCircle className="w-4 h-4" />
                {od.directiveDispatched}
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                {od.dispatchDirectiveToFloor}
              </>
            )}
          </button>
        </div>
      )}

      {/* Critical Path & Buffer Compression Alert Banner */}
      {order.criticalPathAlert && (
        <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-xl shadow-xs space-y-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <h4 className="text-sm font-bold text-rose-900">
              {od.criticalPathAlert}: {translateStage(order.criticalPathAlert.stage, lang)} Overrun ({order.criticalPathAlert.bufferCompressionDays} {od.bufferCompressed})
            </h4>
          </div>
          <p className="text-xs text-rose-800 ml-7 leading-relaxed">
            {order.criticalPathAlert.message} {order.criticalPathAlert.downstreamRisk}
          </p>
        </div>
      )}

      {/* 7-Stage Circular Radial Donut Pipeline */}
      <CircularTnaPipeline
        milestones={order.milestones}
        currentStage={order.activeStage}
        totalOrderQuantity={order.totalQuantity}
      />

      {/* Feature 10: Human-in-the-Loop Review Gate Section (Single Card Pagination) */}
      {orderAlerts.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
              {od.humanReviewGate} ({orderAlerts.length} {od.alert}{orderAlerts.length > 1 ? (isTa ? 'கள்' : 's') : ''})
              {orderAlerts.some((a) => a.approvalStatus === 'PENDING_REVIEW') && (
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-900 text-[10px] font-black animate-pulse">
                  {od.actionRequired}
                </span>
              )}
            </h3>

            {/* Pagination Controls when multiple review cards exist */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs text-slate-500 font-semibold">
                {od.alert} {Math.min(currentAlertIndex + 1, orderAlerts.length)} {od.of} {orderAlerts.length}
              </span>
              {orderAlerts.length > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentAlertIndex((i) => Math.max(0, i - 1))}
                    disabled={currentAlertIndex === 0}
                    className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 shadow-2xs transition cursor-pointer"
                    title={od.previousAlert}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentAlertIndex((i) => Math.min(orderAlerts.length - 1, i + 1))}
                    disabled={currentAlertIndex >= orderAlerts.length - 1}
                    className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 shadow-2xs transition cursor-pointer"
                    title={od.nextAlert}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            {orderAlerts[currentAlertIndex] && (
              <RiskReviewCard
                key={orderAlerts[currentAlertIndex].id}
                alert={orderAlerts[currentAlertIndex]}
                onAlertUpdated={() => order && fetchOrderAlerts(order.id)}
                lang={lang}
              />
            )}
          </div>
        </div>
      )}

      {/* Feature 5: Transparent Show-Your-Math Run-Rate Engine (Synchronized with Risk & Delays) */}
      {riskEvaluation && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          {/* Header Bar Synchronized with Risk & Delays Run-Rate Pace */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3.5 py-2.5 bg-slate-900 border-b border-slate-800 gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-sky-400">
                {order.poNumber}
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-xs font-bold text-white">
                {translateStyle(order.style, lang)}
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-xs text-slate-300">
                {translateBuyer(order.buyer.name.replace(/\s*\([^)]*\)$/, ''), lang)} ({translateUnit(order.unit.name, lang)})
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-[11px] font-semibold text-slate-200 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                {isTa ? 'நிலை' : 'Stage'}: {translateStage(order.activeStage, lang)}
              </span>

              {/* Dynamic Risk Level Badge */}
              {Boolean(
                order.status === 'COMPLETED' ||
                order.healthStatus === 'COMPLETED' ||
                riskEvaluation.isCompleted ||
                (order.activeStage === 'FINISHING' && order.activeStageProgressPct >= 100)
              ) ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-950 bg-emerald-400 px-2 py-0.5 rounded-full border border-emerald-300 shadow-2xs">
                  {isTa ? 'நிறைவடைந்தது' : 'Completed'}
                </span>
              ) : riskEvaluation.riskLevel === 'RED' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-950 bg-rose-400 px-2 py-0.5 rounded-full border border-rose-300 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-900 animate-pulse" />
                  {riskEvaluation.varianceQtyPerDay < 0
                    ? `${isTa ? 'கடுமையான பற்றாக்குறை' : 'Critical Deficit'} (${riskEvaluation.varianceQtyPerDay} pcs/d)`
                    : `${isTa ? 'கூடுதல் பற்றாக்குறை' : 'Extra Deficit'} (+${riskEvaluation.varianceQtyPerDay} pcs/d)`}
                </span>
              ) : riskEvaluation.riskLevel === 'AMBER' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-950 bg-amber-400 px-2 py-0.5 rounded-full border border-amber-300 shadow-2xs">
                  {isTa ? 'கூடுதல் எச்சரிக்கை' : 'Extra Caution'} ({riskEvaluation.varianceQtyPerDay >= 0 ? `+${riskEvaluation.varianceQtyPerDay}` : riskEvaluation.varianceQtyPerDay} pcs/d)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-950 bg-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 shadow-2xs">
                  {isTa ? 'சரியான பாதையில்' : 'On Track'} (+{riskEvaluation.varianceQtyPerDay} pcs/d)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 self-end sm:self-auto text-xs text-slate-300">
              <div>
                {isTa ? 'தொழிற்சாலை வெளியேறும் தேதி' : 'Ex-Factory'}:{' '}
                <strong className="text-white font-semibold">
                  {new Date(order.exFactoryDate).toLocaleDateString(
                    lang === 'ta' ? 'ta-IN' : 'en-GB',
                    {
                      day: '2-digit',
                      month: 'short',
                    }
                  )}
                </strong>{' '}
                <span className="text-amber-300 font-bold">({calculateWorkingDaysLeft(order.exFactoryDate)} {isTa ? 'நாட்கள் எஞ்சியுள்ளன' : 'd left'})</span>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                {t.common.cw} {order.shipWeek}
              </span>
            </div>
          </div>

          {/* Embedded Show-Your-Math Formula Card */}
          <div className="p-3 bg-white">
            <ShowYourMathCard
              mathBreakdown={riskEvaluation.mathBreakdown}
              riskLevel={riskEvaluation.riskLevel}
              isCompleted={Boolean(
                order.status === 'COMPLETED' ||
                order.healthStatus === 'COMPLETED' ||
                riskEvaluation.isCompleted ||
                (order.activeStage === 'FINISHING' && order.activeStageProgressPct >= 100)
              )}
              differencePill={riskEvaluation.differencePill}
              requiredDailyRate={riskEvaluation.requiredDailyRate}
              actualRollingRate={riskEvaluation.actualRollingRate}
              varianceQtyPerDay={riskEvaluation.varianceQtyPerDay}
              daysLate={riskEvaluation.daysLate}
              projectedCompletionDate={new Date(riskEvaluation.projectedCompletionDate).toISOString()}
              financialExposureRupees={riskEvaluation.financialExposureRupees}
              rulesTriggered={riskEvaluation.rulesTriggered}
              plannedStageEnd={
                order.milestones.find((m) => m.stage === order.activeStage)?.plannedEnd
              }
              poNumber={order.poNumber}
              styleName={order.style}
              stageName={translateStage(order.activeStage, lang)}
              exFactoryDate={order.exFactoryDate}
            />
          </div>
        </div>
      )}

      {/* Buyer Daily Feedback & Direct Directives Section */}
      {order.auditEvents && order.auditEvents.filter((ev) => ev.action === 'BUYER_DAILY_RESPONSE').length > 0 && (
        <div className="bg-gradient-to-r from-sky-50/60 to-indigo-50/40 rounded-2xl border border-sky-200/80 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-sky-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-600 text-white flex items-center justify-center shadow-xs">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {od.buyerDailySignoffs}
                </h3>
                <p className="text-xs text-slate-500">
                  {od.directResponsesFrom} {translateBuyer(order.buyer.name, lang)}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-white text-sky-800 border border-sky-200 shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              {order.auditEvents.filter((ev) => ev.action === 'BUYER_DAILY_RESPONSE').length} {od.verifiedResponses}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {order.auditEvents
              .filter((ev) => ev.action === 'BUYER_DAILY_RESPONSE')
              .map((fb) => (
                <div
                  key={fb.id}
                  className="bg-white rounded-xl border border-sky-100 p-3 shadow-2xs space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between text-[11px] pb-1.5 border-b border-slate-100">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      {fb.user?.name || translateBuyer(order.buyer.name.replace(/\s*\([^)]*\)$/, ''), lang)} {fb.user?.email ? `(${fb.user.email})` : ''}
                    </span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {new Date(fb.timestamp).toLocaleString(undefined, {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-slate-700 italic pl-2.5 border-l-2 border-sky-500 font-medium leading-relaxed">
                    "{fb.notes}"
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                    <span className="font-mono">Role: {fb.userRole}</span>
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      Hash: {fb.auditHash ? `${fb.auditHash.substring(0, 10)}...` : 'Verified'}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Floor Work Logs & Production Updates Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-600" />
            <div>
              <h3 className="text-base font-bold text-slate-800">
                {od.floorWorkLogsTitle}
              </h3>
              <p className="text-xs text-slate-500">
                {od.floorWorkLogsSubtitle}
              </p>
            </div>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
            {order.productionUpdates?.length || 0} {od.shiftLogs}
          </span>
        </div>

        {(!order.productionUpdates || order.productionUpdates.length === 0) ? (
          <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">{od.noShiftUpdates}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {od.noShiftUpdatesSubtext}
            </p>
          </div>
        ) : (
          <div className="w-full space-y-3">
            {/* Mobile View: High-Readability Native Cards (Hidden on md+) */}
            <div className="md:hidden space-y-2.5">
              {paginatedLogs.map((update) => {
                const classification = update.issueClassification;
                const hasPhotos = update.photos && update.photos.length > 0;
                const noteText = update.notes || '';
                const hasNote = Boolean(noteText.trim());

                const eventDate = new Date(update.clientEventAt);
                const dateStr = eventDate.toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                });
                const timeStr = eventDate.toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                });

                const lineName = update.machineLine
                  ? update.machineLine
                      .replace('UNIT_3 Floor Line', 'U3 Line')
                      .replace('Floor Line', 'Line')
                      .trim()
                  : '-';

                const supervisorName = update.supervisor?.name
                  ? update.supervisor.name
                      .replace(' Floor Supervisor', '')
                      .replace(' Merchandiser', ' (M)')
                  : (isTa ? 'மேற்பார்வையாளர்' : 'Supervisor');

                const cleanNote = (() => {
                  if (noteText.includes('[English:')) {
                    const parts = noteText.split('[English:');
                    return parts[1]?.replace(/\]$/, '').trim() || parts[0].trim();
                  }
                  if (classification?.translatedText) {
                    return classification.translatedText;
                  }
                  return noteText;
                })();

                return (
                  <div
                    key={update.id}
                    className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2 text-xs"
                  >
                    {/* Header Row: Date/Time + Stage */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-700 font-semibold">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{dateStr}, {timeStr}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-[#0C2D48] text-white">
                        {translateStage(update.stage, lang)}
                      </span>
                    </div>

                    {/* Output & Line Row */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                      <div className="text-slate-600 font-medium text-[11px]">
                        <span className="font-bold text-slate-800">{update.shift || '-'}</span> · {lineName}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-xs">
                          +{update.goodQuantity.toLocaleString()} {od.pcs}
                        </span>
                        {update.rejectedQuantity > 0 && (
                          <span className="inline-flex items-center font-mono font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 text-[10px]">
                            {update.rejectedQuantity} {isTa ? 'நிராகரிப்பு' : 'rej'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metadata: Category & Supervisor */}
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      {classification ? (
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] uppercase bg-amber-50 text-amber-800 border border-amber-200 truncate max-w-[170px]">
                          {translateReason(classification.category, lang)}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">{od.normalShiftOutput}</span>
                      )}

                      <div className="flex items-center gap-2">
                        {hasPhotos && (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedImageModal({
                                url: update.photos[0].s3Url,
                                stage: update.stage,
                                supervisorName: update.supervisor?.name,
                                date: new Date(update.clientEventAt).toLocaleString(),
                              })
                            }
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-bold"
                          >
                            <Camera className="w-3 h-3 text-sky-600" />
                            <span>{update.photos.length} {update.photos.length > 1 ? t.common.photos : t.common.photo}</span>
                          </button>
                        )}
                        <span className="text-slate-500 font-medium text-[10px]">{t.common.by} {supervisorName}</span>
                      </div>
                    </div>

                    {/* Note Box */}
                    {(hasNote || classification?.translatedText) && (
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-200/80 text-[11px] text-slate-800 leading-snug">
                        "{cleanNote}"
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Clean, Fixed-Layout Desktop Table View */}
            <div className="hidden md:block w-full rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs">
              <table className="w-full text-left text-xs table-fixed border-collapse">
                <colgroup>
                  <col className="w-[12%]" />
                  <col className="w-[11%]" />
                  <col className="w-[13%]" />
                  <col className="w-[10%]" />
                  <col className="w-[15%]" />
                  <col className="w-[11%]" />
                  <col className="w-[6%]" />
                  <col className="w-[22%]" />
                </colgroup>
                <thead className="bg-[#0C2D48] text-white font-bold uppercase text-[10px] tracking-wider border-b border-[#143D60]">
                  <tr>
                    <th className="py-3 px-3 text-slate-100">{od.dateTime}</th>
                    <th className="py-3 px-2 text-slate-100">{od.stage}</th>
                    <th className="py-3 px-2 text-slate-100">{od.shiftLine}</th>
                    <th className="py-3 px-2 text-right text-slate-100">{od.output}</th>
                    <th className="py-3 px-3 text-slate-100">{od.issueReason}</th>
                    <th className="py-3 px-2 text-slate-100">{od.loggedBy}</th>
                    <th className="py-3 px-2 text-center text-slate-100">{od.proof}</th>
                    <th className="py-3 px-3 text-slate-100">{od.supervisorNoteSummary}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedLogs.map((update) => {
                    const classification = update.issueClassification;
                    const hasPhotos = update.photos && update.photos.length > 0;
                    const noteText = update.notes || '';
                    const hasNote = Boolean(noteText.trim());

                    const eventDate = new Date(update.clientEventAt);
                    const dateStr = eventDate.toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                    });
                    const timeStr = eventDate.toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    });

                    const lineName = update.machineLine
                      ? update.machineLine
                          .replace('UNIT_3 Floor Line', 'U3 Line')
                          .replace('Floor Line', 'Line')
                          .trim()
                      : '-';

                    const supervisorName = update.supervisor?.name
                      ? update.supervisor.name
                          .replace(' Floor Supervisor', '')
                          .replace(' Merchandiser', ' (M)')
                      : (isTa ? 'மேற்பார்வையாளர்' : 'Supervisor');

                    const cleanNote = (() => {
                      if (noteText.includes('[English:')) {
                        const parts = noteText.split('[English:');
                        return parts[1]?.replace(/\]$/, '').trim() || parts[0].trim();
                      }
                      if (classification?.translatedText) {
                        return classification.translatedText;
                      }
                      return noteText;
                    })();

                    return (
                      <tr
                        key={update.id}
                        className="even:bg-slate-50/70 odd:bg-white hover:bg-sky-50/50 transition-colors"
                      >
                        {/* 1. Date & Time */}
                        <td className="py-3 px-3 font-mono leading-tight whitespace-nowrap">
                          <div className="font-bold text-slate-800 text-[11px]">
                            {dateStr}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {timeStr}
                          </div>
                        </td>

                        {/* 2. Stage */}
                        <td className="py-3 px-2 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-slate-900 text-white inline-block shadow-3xs" title={update.stage}>
                            {translateStage(update.stage, lang)}
                          </span>
                        </td>

                        {/* 3. Shift & Machine Line */}
                        <td className="py-3 px-2 text-[11px] leading-tight whitespace-nowrap">
                          <span className="text-slate-800 font-bold">
                            {update.shift || '-'}
                          </span>
                          <span className="text-slate-300 mx-1">·</span>
                          <span className="text-slate-600 font-medium" title={update.machineLine || ''}>
                            {lineName}
                          </span>
                        </td>

                        {/* 4. Output Qty */}
                        <td className="py-3 px-2 text-right whitespace-nowrap">
                          <div className="inline-flex items-center font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80 text-[11px]">
                            +{update.goodQuantity.toLocaleString()}
                          </div>
                          {update.rejectedQuantity > 0 && (
                            <div className="text-[10px] text-rose-600 font-bold font-mono mt-0.5">
                              {update.rejectedQuantity} {isTa ? 'நிராகரிப்பு' : 'rej'}
                            </div>
                          )}
                        </td>

                        {/* 5. Issue Category */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {classification ? (
                            <span
                              className="inline-block max-w-full truncate px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-900 border border-amber-200/80"
                              title={`${translateReason(classification.category, lang)} (${Math.round(classification.confidenceScore * 100)}%)`}
                            >
                              {translateReason(classification.category, lang)}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-mono text-[11px] pl-2">—</span>
                          )}
                        </td>

                        {/* 6. Supervisor */}
                        <td className="py-3 px-2 text-slate-700 font-medium text-[11px] whitespace-nowrap">
                          <span className="block truncate font-semibold text-slate-800" title={supervisorName}>
                            {supervisorName}
                          </span>
                        </td>

                        {/* 7. Photo Evidence */}
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          {hasPhotos ? (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedImageModal({
                                  url: update.photos[0].s3Url,
                                  stage: update.stage,
                                  supervisorName: update.supervisor?.name,
                                  date: new Date(update.clientEventAt).toLocaleString(),
                                })
                              }
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-[10px] font-bold transition cursor-pointer shadow-3xs"
                              title={t.common.viewProof}
                            >
                              <Camera className="w-3 h-3 text-sky-600" />
                              <span>{update.photos.length}</span>
                            </button>
                          ) : (
                            <span className="text-slate-300 font-mono text-[11px]">—</span>
                          )}
                        </td>

                        {/* 8. Supervisor Notes */}
                        <td className="py-3 px-3 max-w-0 truncate" title={cleanNote}>
                          {hasNote || classification?.translatedText ? (
                            <span className="block truncate text-[11px] text-slate-800 font-medium leading-snug">
                              {cleanNote}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">{od.noNotes}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination Controls for Shift Production Updates */}
        {order.productionUpdates && order.productionUpdates.length > logLimit && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-3 border-t border-slate-100 text-xs">
            <span className="text-slate-500 font-medium">
              {od.showingLogs} {(logPage - 1) * logLimit + 1} -{' '}
              {Math.min(logPage * logLimit, order.productionUpdates.length)} /{' '}
              {order.productionUpdates.length}
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                disabled={logPage <= 1}
                className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-white text-slate-700 shadow-2xs cursor-pointer transition flex items-center justify-center"
                title={od.previousAlert}
              >
                <ChevronLeft className="w-4 h-4 stroke-[2.5] text-slate-800" />
              </button>

              {renderPaginationButtons(logPage, totalLogPages, setLogPage)}

              <button
                type="button"
                onClick={() => setLogPage((p) => Math.min(totalLogPages, p + 1))}
                disabled={logPage >= totalLogPages}
                className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-white text-slate-700 shadow-2xs cursor-pointer transition flex items-center justify-center"
                title={od.nextAlert}
              >
                <ChevronRight className="w-4 h-4 stroke-[2.5] text-slate-800" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Order Change History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-sky-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">{od.orderChangeHistoryTitle}</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {od.orderChangeHistorySubtitle}
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full border border-slate-200">
            {order.auditEvents.length} {od.recordedChanges}
          </span>
        </div>

        {/* Unified Table Container */}
        <div className="w-full rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs table-fixed">
              <colgroup>
                <col className="w-[18%]" />
                <col className="w-[18%]" />
                <col className="w-[16%]" />
                <col className="w-[20%]" />
                <col className="w-[18%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead className="bg-[#0C2D48] text-white font-bold uppercase text-[10px] tracking-wider border-b border-[#143D60]">
                <tr>
                  <th className="py-3 px-3 text-slate-100">{od.dateTime}</th>
                  <th className="py-3 px-3 text-slate-100">{od.action}</th>
                  <th className="py-3 px-3 text-slate-100">{od.reason}</th>
                  <th className="py-3 px-3 text-slate-100">{od.changeSummary}</th>
                  <th className="py-3 px-3 text-slate-100">{od.userAndRole}</th>
                  <th className="py-3 px-3 text-center text-slate-100">{od.status}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {paginatedAuditEvents.map((ev) => {
                  let prev = '-';
                  let next = '-';
                  try {
                    if (ev.previousValue) prev = JSON.parse(ev.previousValue).exFactoryDate?.split('T')[0] || '-';
                    if (ev.newValue) next = JSON.parse(ev.newValue).exFactoryDate?.split('T')[0] || '-';
                  } catch {
                    // fallback
                  }

                  const friendlyReason =
                    ev.action === 'BUYER_SCHEDULE_NOTIFICATION'
                      ? (isTa ? 'தானியங்கி அறிவிப்பு' : 'Automated Dispatch')
                      : ev.action === 'BUYER_DAILY_RESPONSE'
                      ? (isTa ? 'ஷிப்ட் தள ஒப்புதல்' : 'Shift Floor Sign-off')
                      : translateReason(ev.reasonCode, lang);

                  const friendlyAction = translateAction(ev.action, lang);

                  return (
                    <tr key={ev.id} className="even:bg-slate-50/70 odd:bg-white hover:bg-sky-50/50 transition-colors">
                      <td className="py-3 px-3 text-slate-600 font-medium whitespace-nowrap">
                        {new Date(ev.timestamp).toLocaleString(undefined, {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-800 whitespace-nowrap">
                        {friendlyAction}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          ev.action === 'BUYER_DAILY_RESPONSE'
                            ? 'bg-sky-50 text-sky-900 border-sky-200/80'
                            : 'bg-amber-50 text-amber-900 border-amber-200/80'
                        }`}>
                          {friendlyReason}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-700 max-w-0 truncate" title={ev.action === 'BUYER_DAILY_RESPONSE' ? ev.notes || '' : (prev !== '-' ? `${prev} → ${next}` : next)}>
                        {ev.action === 'BUYER_DAILY_RESPONSE'
                          ? ev.notes || (isTa ? 'வாங்குபவர் தினசரி ஒப்புதல்' : 'Buyer daily sign-off')
                          : prev !== '-' ? `${prev} → ${next}` : next}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-slate-600 text-[11px] truncate" title={`${ev.user?.name || (isTa ? 'கணினி' : 'System')} (${translateRole(ev.userRole, lang)})`}>
                        {ev.user?.name || (isTa ? 'கணினி' : 'System')} ({translateRole(ev.userRole, lang)})
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-semibold text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          {od.logged}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Controls for Order Change History */}
        {order.auditEvents && order.auditEvents.length > auditLimit && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-3 border-t border-slate-100 text-xs">
            <span className="text-slate-500 font-medium">
              {od.showingChanges} {(auditPage - 1) * auditLimit + 1} -{' '}
              {Math.min(auditPage * auditLimit, order.auditEvents.length)} /{' '}
              {order.auditEvents.length}
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                disabled={auditPage <= 1}
                className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-white text-slate-700 shadow-2xs cursor-pointer transition flex items-center justify-center"
                title={od.previousAlert}
              >
                <ChevronLeft className="w-4 h-4 stroke-[2.5] text-slate-800" />
              </button>

              {renderPaginationButtons(auditPage, totalAuditPages, setAuditPage)}

              <button
                type="button"
                onClick={() => setAuditPage((p) => Math.min(totalAuditPages, p + 1))}
                disabled={auditPage >= totalAuditPages}
                className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-white text-slate-700 shadow-2xs cursor-pointer transition flex items-center justify-center"
                title={od.nextAlert}
              >
                <ChevronRight className="w-4 h-4 stroke-[2.5] text-slate-800" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Date Alteration Modal with Reason Code Prompt */}
      {isDateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            style={{ colorScheme: 'light' }}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[92vh] overflow-hidden text-slate-900 flex flex-col"
          >
            <div className="bg-[#0C2D48] px-5 sm:px-6 py-3.5 sm:py-4 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white">{od.shiftDateModalTitle}</h3>
                <p className="text-[11px] sm:text-xs text-sky-200/80">
                  {od.shiftDateModalSubtitle}
                </p>
              </div>
              <button
                onClick={() => setIsDateModalOpen(false)}
                className="text-sky-200 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDateChangeSubmit} className="p-4 sm:p-6 space-y-4 bg-white text-slate-900 overflow-y-auto flex-1">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  {od.selectRevisedDate} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-medium bg-white text-slate-900 shadow-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  {od.primaryRootCause} <span className="text-rose-500">*</span>
                </label>
                <select
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-semibold bg-white text-slate-900 shadow-xs"
                  required
                >
                  <option className="bg-white text-slate-900" value="BUYER_REQUEST">{translateReason('BUYER_REQUEST', lang)}</option>
                  <option className="bg-white text-slate-900" value="FABRIC_DELAY">{translateReason('FABRIC_DELAY', lang)}</option>
                  <option className="bg-white text-slate-900" value="LABOUR_SHORTAGE">{translateReason('LABOUR_SHORTAGE', lang)}</option>
                  <option className="bg-white text-slate-900" value="MACHINE_BREAKDOWN">{translateReason('MACHINE_BREAKDOWN', lang)}</option>
                  <option className="bg-white text-slate-900" value="POWER_OUTAGE">{translateReason('POWER_OUTAGE', lang)}</option>
                  <option className="bg-white text-slate-900" value="QUALITY_HOLD">{translateReason('QUALITY_HOLD', lang)}</option>
                  <option className="bg-white text-slate-900" value="SUBCONTRACTOR_DELAY">{translateReason('SUBCONTRACTOR_DELAY', lang)}</option>
                  <option className="bg-white text-slate-900" value="OTHER">{isTa ? 'பிற செயல்பாட்டுக் காரணங்கள்' : 'Other Reason'}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  {od.mandatoryExplanation}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder={od.provideContextPlaceholder}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 bg-white text-slate-900 placeholder:text-slate-400 shadow-xs"
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  {isTa ? 'மதிப்பிடப்பட்ட நிதி தாக்கம் (₹ INR)' : 'Estimated Financial Impact (₹ INR)'}
                </label>
                <input
                  type="number"
                  min={0}
                  value={financialImpact}
                  onChange={(e) => setFinancialImpact(Number(e.target.value))}
                  placeholder="e.g. 50000"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-mono bg-white text-slate-900 placeholder:text-slate-400 shadow-xs"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600">
                {isTa
                  ? 'மைல்கல் அட்டவணைகளை மறுசீரமைத்து, தணிக்கை வரலாற்றில் மாற்றத்தைப் பதிவு செய்கிறது.'
                  : 'Recalibrates milestone schedules and records change in audit history.'}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDateModalOpen(false)}
                  disabled={updatingDate}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={updatingDate || !reasonCode}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-xl shadow-xs transition"
                >
                  {updatingDate && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {updatingDate ? od.savingShift : od.confirmShiftButton}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Stage Advance & Target Adjustment Modal */}
      {isAdvanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 my-auto flex flex-col max-h-[92vh]">
            <div className="p-4 sm:p-5 bg-[#0C2D48] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300">
                  <FastForward className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-tight">{od.advanceStageTitle}</h3>
                  <p className="text-[11px] text-sky-200">{od.advanceStageSubtitle}</p>
                </div>
              </div>
              <button
                onClick={() => setIsAdvanceModalOpen(false)}
                className="text-sky-200 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdvanceStageSubmit} className="p-4 sm:p-6 space-y-4 bg-white text-slate-900 overflow-y-auto flex-1">
              {advanceModalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{advanceModalError}</span>
                </div>
              )}

              {advanceSuccessMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{advanceSuccessMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  {od.targetMilestoneStage} <span className="text-rose-500">*</span>
                </label>
                <select
                  value={advanceFromStage}
                  onChange={(e) => handleStageSelectChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-semibold bg-white text-slate-900 shadow-xs"
                  required
                >
                  {(order.milestones || []).map((m) => (
                    <option key={m.id} value={m.stage}>
                      {isTa ? `நிலை #${m.sequenceOrder}` : `Stage #${m.sequenceOrder}`} - {translateStage(m.stage, lang)} ({m.completedQuantity.toLocaleString()} / {m.targetQuantity.toLocaleString()} {od.pcs}) {m.completedQuantity >= m.targetQuantity ? (isTa ? '✓ முடிந்தது' : '✓ Completed') : (isTa ? '• செயலில்' : '• In Progress')}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  {isTa
                    ? 'இந்த மைல்கல்லை முடிந்ததாகக் குறிக்கிறது மற்றும் ஆர்டரை அடுத்த கட்டத்திற்கு முன்னேற்றுகிறது.'
                    : 'Marks this milestone as finished and advances the order pipeline to the subsequent stage.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  {isTa ? 'உண்மையான முடிந்த வெளியீடு அளவு (துண்டுகள்)' : 'Actual Completed Output Quantity (Pieces)'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={advanceCompletedQty}
                  onChange={(e) => setAdvanceCompletedQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  placeholder="e.g. 4080"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-mono font-bold bg-white text-slate-900 shadow-xs"
                  required
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  {isTa ? 'இந்த கட்டத்தின் இறுதி சரிபார்க்கப்பட்ட வெளியீடாகப் பதிவு செய்யப்படுகிறது.' : 'Recorded as the final verified output of this stage.'}
                </p>
              </div>

              <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={advanceAdjustDownstream}
                    onChange={(e) => setAdvanceAdjustDownstream(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-sky-950 block">
                      {isTa ? 'அடுத்தடுத்த நிலைகளின் இலக்குகளை மறுசீரமைக்கவும்' : 'Recalibrate Downstream Milestone Targets'}
                    </span>
                    <span className="text-[11px] text-sky-800 leading-relaxed block mt-0.5">
                      {isTa
                        ? `அடுத்தடுத்த இலக்குகள் முந்தைய முடிந்த வெளியீட்டை விட அதிகமாகாமல் பார்த்துக் கொள்கிறது. தேர்ந்தெடுக்கப்பட்டால் அனைத்து அடுத்தடுத்த கட்டங்களும் ${advanceCompletedQty.toLocaleString()} துண்டுகளாக மாறும்.`
                        : `Ensures downstream targets never exceed upstream completed output. If checked, all subsequent stages and the total order quantity will adjust to ${advanceCompletedQty.toLocaleString()} pcs.`}
                    </span>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  {isTa ? 'கைமுறை நிலை முன்னேற்றத்திற்கான காரணம்' : 'Reason for Manual Advance / Short-Close'} <span className="text-rose-500">*</span>
                </label>
                <select
                  value={advanceReasonCode}
                  onChange={(e) => setAdvanceReasonCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-semibold bg-white text-slate-900 shadow-xs"
                  required
                >
                  <option value="BUYER_SHORT_SHIP_APPROVAL">{isTa ? 'வாங்குபவர் அங்கீகரித்த குறைந்த ஏற்றுமதி' : 'Buyer Approved Short Shipment'}</option>
                  <option value="FABRIC_DEFECT_SHORTAGE">{isTa ? 'துணி / மூலப்பொருள் பற்றாக்குறை' : 'Fabric / Raw Material Shortage'}</option>
                  <option value="LINE_BREAKDOWN">{isTa ? 'இயந்திர பழுது / திட்டமிடப்படாத பராமரிப்பு' : 'Mechanical Breakdown / Unscheduled Maintenance'}</option>
                  <option value="QUALITY_REJECTION">{isTa ? 'அதிக தர நிராகரிப்பு / மறுவேலை நிறுத்தம்' : 'High Quality Rejection / Rework Cutoff'}</option>
                  <option value="UNFORESEEN_CIRCUMSTANCE">{isTa ? 'எதிர்பாராத செயல்பாட்டு சூழ்நிலை' : 'Unforeseen Operational Circumstance'}</option>
                  <option value="MANAGEMENT_OVERRIDE">{isTa ? 'நிர்வாக / வணிகப் பொறுப்பாளர் அனுமதி' : 'Executive / Merchandiser Override'}</option>
                  <option value="OTHER">{isTa ? 'பிற செயல்பாட்டுக் காரணம்' : 'Other Operational Justification'}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  {od.mandatoryExplanation} <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={advanceOverrideNotes}
                  onChange={(e) => setAdvanceOverrideNotes(e.target.value)}
                  rows={3}
                  required
                  placeholder={od.mandatoryExplanationAdvance}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 bg-white text-slate-900 placeholder:text-slate-400 shadow-xs"
                ></textarea>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  {isTa
                    ? 'இந்த மாற்றம் தணிக்கைப் பதிவில் SHA-256 மூலம் பாதுகாக்கப்பட்ட மாற்ற முடியாத STAGE_OUTPUT பதிவை உருவாக்குகிறது.'
                    : 'This override generates an immutable STAGE_OUTPUT record cryptographically chained via SHA-256 in the audit trail.'}
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAdvanceModalOpen(false)}
                  disabled={advancingStage}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={advancingStage || !advanceOverrideNotes.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#0C2D48] hover:bg-[#143D60] rounded-xl shadow-xs transition"
                >
                  {advancingStage && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {advancingStage ? od.progressingStage : od.confirmAdvanceButton}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Full-Screen Image Lightbox Modal */}
      {selectedImageModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in"
          onClick={() => setSelectedImageModal(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-sky-400" />
                <span className="text-sm font-bold">
                  {od.photoModalTitle} ({translateStage(selectedImageModal.stage || '', lang)})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedImageModal(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-slate-950 flex items-center justify-center min-h-[300px] max-h-[70vh] overflow-hidden">
              <img
                src={getSafeImageUrl(selectedImageModal.url, selectedImageModal.stage)}
                onError={(e) => handleImageError(e, selectedImageModal.stage)}
                alt="Defect Full View"
                className="max-h-[65vh] w-auto object-contain rounded-lg shadow-lg"
              />
            </div>
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <span>{od.capturedBy} <strong>{selectedImageModal.supervisorName || (isTa ? 'தள மேற்பார்வையாளர்' : 'Floor Supervisor')}</strong></span>
              <span>{isTa ? 'நேரம்:' : 'Timestamp:'} <strong>{selectedImageModal.date}</strong></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
