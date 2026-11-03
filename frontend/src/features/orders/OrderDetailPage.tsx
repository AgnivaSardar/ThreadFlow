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
} from 'lucide-react';
import { OrderDetail, UpdateExFactoryDatePayload, RiskEvaluationResult, RiskAlertItem } from '../../types';
import { apiRequest } from '../../services/api';
import { StatusBadge } from '../../components/StatusBadge';
import { CircularTnaPipeline } from '../tna/CircularTnaPipeline';
import { SizeBreakdownVisualizer } from './SizeBreakdownVisualizer';
import { ShowYourMathCard } from '../risk/ShowYourMathCard';
import { RiskReviewCard } from '../risk/RiskReviewCard';
import { getSafeImageUrl, handleImageError } from '../../utils/imageUtils';

export const OrderDetailPage: React.FC = () => {
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

  const fetchRiskEvaluation = async (orderId: string, milestoneId: string) => {
    try {
      const res = await apiRequest<{ success: boolean; data: RiskEvaluationResult }>(
        `/risk/${orderId}/${milestoneId}`
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
      setOrder(res.data);
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
            <div className="text-[11px] font-semibold text-slate-400">Export Orders / Details</div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{order.style}</h1>
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
            <span>Shift Ex-Factory Date</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Buyer & Destination</div>
          <div className="text-base font-bold text-slate-800 mt-1">{order.buyer.name}</div>
          <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            {order.buyer.code} • {order.buyer.country || 'Europe'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Manufacturing Unit</div>
          <div className="text-base font-bold text-slate-800 mt-1">{order.unit.name}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            <span
              className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
                order.unit.type === 'SUBCONTRACTOR' ? 'bg-purple-500' : 'bg-emerald-500'
              }`}
            ></span>
            {order.unit.type === 'SUBCONTRACTOR' ? 'Subcontract Unit' : 'Primary Factory'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ex-Factory Deadline</div>
          <div className="text-base font-bold text-slate-800 mt-1">{formatDate(order.exFactoryDate)}</div>
          <div className="text-xs text-amber-600 font-semibold flex items-center gap-1 mt-0.5">
            <Clock className="w-3.5 h-3.5" />
            {order.workingDaysLeft} working days left (CW {order.shipWeek})
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Order Value (FOB)</div>
          <div className="text-base font-bold text-slate-800 mt-1 font-mono">
            ₹{(order.totalOrderValue || 0).toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {order.currency} {order.fobPricePerPiece}/pc ({order.totalQuantity.toLocaleString()} pcs)
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
                Floor Rebalance Directive
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
                Directive Dispatched
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                Dispatch Directive to Floor
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
              Critical Path Alert: {order.criticalPathAlert.stageDisplayName} Overrun ({order.criticalPathAlert.bufferCompressionDays} Working Days Buffer Compressed)
            </h4>
          </div>
          <p className="text-xs text-rose-800 ml-7 leading-relaxed">
            {order.criticalPathAlert.message} {order.criticalPathAlert.downstreamRisk}
          </p>
        </div>
      )}

      {/* 7-Stage Circular Radial Donut Pipeline */}
      <CircularTnaPipeline milestones={order.milestones} currentStage={order.activeStage} />

      {/* Feature 10: Human-in-the-Loop Review Gate Section */}
      {orderAlerts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
              Human-in-the-Loop Review Gate ({orderAlerts.length} Alert{orderAlerts.length > 1 ? 's' : ''})
              {orderAlerts.some((a) => a.approvalStatus === 'PENDING_REVIEW') && (
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-900 text-[10px] font-black animate-pulse">
                  Action Required
                </span>
              )}
            </h3>
            <span className="text-xs text-slate-500 font-semibold">
              Merchandiser Triage & Buyer Visibility Gate
            </span>
          </div>

          <div className="space-y-3">
            {orderAlerts.map((alert) => (
              <RiskReviewCard
                key={alert.id}
                alert={alert}
                onAlertUpdated={() => order && fetchOrderAlerts(order.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Feature 5: Transparent Show-Your-Math Run-Rate Engine */}
      {riskEvaluation && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              Active Stage Run-Rate Analysis ({order.activeStage.replace(/_/g, ' ')})
            </h3>
          </div>
          <ShowYourMathCard
            mathBreakdown={riskEvaluation.mathBreakdown}
            riskLevel={riskEvaluation.riskLevel}
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
            stageName={order.activeStage.replace(/_/g, ' ')}
          />
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
                  Buyer Daily Sign-offs & Floor Instructions
                </h3>
                <p className="text-xs text-slate-500">
                  Direct responses received from {order.buyer.name} sourcing team
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-white text-sky-800 border border-sky-200 shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              {order.auditEvents.filter((ev) => ev.action === 'BUYER_DAILY_RESPONSE').length} Verified Response{order.auditEvents.filter((ev) => ev.action === 'BUYER_DAILY_RESPONSE').length > 1 ? 's' : ''}
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
                      {fb.user?.name || 'Buyer Representative'} ({fb.user?.email || 'Official Channel'})
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
                Floor Work Logs & Shift Production Updates
              </h3>
              <p className="text-xs text-slate-500">
                Live chronological updates logged by floor supervisors, bilingual voice notes & defect photos
              </p>
            </div>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
            {order.productionUpdates?.length || 0} Shift Logs
          </span>
        </div>

        {(!order.productionUpdates || order.productionUpdates.length === 0) ? (
          <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No shift updates recorded yet</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Floor supervisors can log completed quantities, defect notes, and Tamil voice remarks from the Supervisor PWA.
            </p>
          </div>
        ) : (
          /* Floor Shift Production Updates Table (High Density, Fixed-Width Responsive - No Horizontal Scroll) */
          <div className="w-full rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
            <table className="w-full table-fixed text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2 px-2 w-[10%]">Date / Time</th>
                  <th className="py-2 px-1.5 w-[7%]">Stage</th>
                  <th className="py-2 px-2 w-[9%]">Shift · Line</th>
                  <th className="py-2 px-1 w-[6%] text-right">Output</th>
                  <th className="py-2 px-2 w-[16%] whitespace-nowrap">Issue Reason</th>
                  <th className="py-2 px-2 w-[9%]">Logged By</th>
                  <th className="py-2 px-1 w-[4%] text-center">Photo</th>
                  <th className="py-2 px-3 w-[39%]">Supervisor Note & AI Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
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

                  const lineName = (update.machineLine || 'Line 1')
                    .replace('UNIT_3 Floor Line', 'U3 Line')
                    .replace('Floor Line', 'Line')
                    .trim();

                  const supervisorName = update.supervisor?.name
                    ? update.supervisor.name
                        .replace(' Floor Supervisor', '')
                        .replace(' Merchandiser', ' (M)')
                    : 'Supervisor';

                  return (
                    <tr
                      key={update.id}
                      className="hover:bg-slate-50/70 transition-colors align-top"
                    >
                      {/* 1. Date & Time (Stacked for maximum horizontal savings) */}
                      <td className="py-2 px-2 font-mono leading-tight">
                        <div className="font-semibold text-slate-800 text-[11px] whitespace-nowrap">
                          {dateStr}
                        </div>
                        <div className="text-[10px] text-slate-400 whitespace-nowrap">
                          {timeStr}
                        </div>
                      </td>

                      {/* 2. Stage */}
                      <td className="py-2 px-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-slate-900 text-white inline-block max-w-full truncate" title={update.stage}>
                          {update.stage.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* 3. Shift & Machine Line */}
                      <td className="py-2 px-2 text-[11px] leading-tight">
                        <span className="text-slate-800 font-bold whitespace-nowrap">
                          {update.shift || 'DAY'}
                        </span>
                        <span className="text-slate-400 mx-0.5">·</span>
                        <span
                          className="text-slate-600 font-medium truncate inline-block max-w-[65px] align-bottom"
                          title={update.machineLine || ''}
                        >
                          {lineName}
                        </span>
                      </td>

                      {/* 4. Output Qty (Narrowed) */}
                      <td className="py-2 px-1 text-right">
                        <span className="inline-flex items-center font-mono font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200 text-[10px] whitespace-nowrap">
                          +{update.goodQuantity.toLocaleString()}
                        </span>
                        {update.rejectedQuantity > 0 && (
                          <div className="text-[9px] text-rose-600 font-semibold leading-none mt-0.5 whitespace-nowrap">
                            {update.rejectedQuantity} rej
                          </div>
                        )}
                      </td>

                      {/* 5. Issue Category (Clean text without yellow capsule or emoji, increased width) */}
                      <td className="py-2 px-2 whitespace-nowrap">
                        {classification ? (
                          <span
                            className="text-[11px] font-semibold text-slate-700 whitespace-nowrap"
                            title={`${classification.category.replace(/_/g, ' ')} (${Math.round(classification.confidenceScore * 100)}%)`}
                          >
                            {classification.category.replace(/_/g, ' ')}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-mono text-[11px]">—</span>
                        )}
                      </td>

                      {/* 6. Supervisor */}
                      <td
                        className="py-2 px-2 text-slate-700 font-semibold text-[11px] truncate whitespace-nowrap"
                        title={update.supervisor?.name || ''}
                      >
                        {supervisorName}
                      </td>

                      {/* 7. Photo Evidence */}
                      <td className="py-2 px-1 text-center whitespace-nowrap">
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
                            className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-[10px] font-bold transition cursor-pointer"
                            title="View photo evidence"
                          >
                            <Camera className="w-2.5 h-2.5 text-sky-600" />
                            <span>{update.photos.length}</span>
                          </button>
                        ) : (
                          <span className="text-slate-300 font-mono text-[11px]">—</span>
                        )}
                      </td>

                      {/* 8. Supervisor Notes (English Translation Only) */}
                      <td className="py-2 px-3">
                        {hasNote || classification?.translatedText ? (
                          <div className="text-[11px] text-slate-900 break-words whitespace-normal font-medium leading-snug">
                            {(() => {
                              // If note has [English: ...], display only the clean English inside
                              if (noteText.includes('[English:')) {
                                const parts = noteText.split('[English:');
                                return parts[1]?.replace(/\]$/, '').trim() || parts[0].trim();
                              }
                              // If AI translated text exists, prefer the English translation
                              if (classification?.translatedText) {
                                return classification.translatedText;
                              }
                              return noteText;
                            })()}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">No notes</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls for Shift Production Updates */}
        {order.productionUpdates && order.productionUpdates.length > logLimit && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-3 border-t border-slate-100 text-xs">
            <span className="text-slate-500 font-medium">
              Showing {(logPage - 1) * logLimit + 1} to{' '}
              {Math.min(logPage * logLimit, order.productionUpdates.length)} of{' '}
              {order.productionUpdates.length} shift logs
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                disabled={logPage <= 1}
                className="p-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition cursor-pointer"
                title="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {Array.from({ length: totalLogPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setLogPage(p)}
                  className={`w-6 h-6 text-xs font-bold rounded-md transition cursor-pointer ${
                    p === logPage
                      ? 'bg-[#0C2D48] text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setLogPage((p) => Math.min(totalLogPages, p + 1))}
                disabled={logPage >= totalLogPages}
                className="p-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition cursor-pointer"
                title="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Order Change History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-600" />
            <h3 className="text-base font-bold text-slate-800">Order Change History</h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {order.auditEvents.length} Recorded Changes
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Date & Time</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Reason</th>
                <th className="py-2.5 px-3">Change Summary</th>
                <th className="py-2.5 px-3">User & Role</th>
                <th className="py-2.5 px-3 text-center">Status</th>
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
                    ? 'Automated Dispatch'
                    : ev.action === 'BUYER_DAILY_RESPONSE'
                    ? 'Shift Floor Sign-off'
                    : ev.reasonCode === 'BUYER_REQUEST'
                    ? 'Buyer Request'
                    : ev.reasonCode === 'FABRIC_DELAY'
                    ? 'Fabric Delay'
                    : ev.reasonCode === 'LABOUR_SHORTAGE'
                    ? 'Labour Shortage'
                    : ev.reasonCode === 'MACHINE_BREAKDOWN'
                    ? 'Machine Breakdown'
                    : ev.reasonCode === 'POWER_OUTAGE'
                    ? 'Power Interruption'
                    : ev.reasonCode === 'QUALITY_HOLD'
                    ? 'Quality Hold'
                    : ev.reasonCode === 'SUBCONTRACTOR_DELAY'
                    ? 'Subcontractor Delay'
                    : ev.reasonCode === 'INITIAL_PO_CREATION'
                    ? 'New Order'
                    : ev.reasonCode || 'Schedule Update';

                const friendlyAction =
                  ev.action === 'UPDATE_EX_FACTORY_DATE'
                    ? 'Ex-Factory Revised'
                    : ev.action === 'BULK_UPDATE_EX_FACTORY_DATE'
                    ? 'Bulk Schedule Shift'
                    : ev.action === 'BUYER_SCHEDULE_NOTIFICATION'
                    ? 'Buyer Notification'
                    : ev.action === 'BUYER_DAILY_RESPONSE'
                    ? 'Buyer Daily Response'
                    : ev.action === 'CREATE_ORDER'
                    ? 'Order Created'
                    : ev.action;

                return (
                  <tr key={ev.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                      {new Date(ev.timestamp).toLocaleString(undefined, {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                      {friendlyAction}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                        ev.action === 'BUYER_DAILY_RESPONSE'
                          ? 'bg-sky-50 text-sky-900 border-sky-200'
                          : 'bg-amber-50 text-amber-900 border-amber-200'
                      }`}>
                        {friendlyReason}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-700 max-w-xs truncate" title={ev.action === 'BUYER_DAILY_RESPONSE' ? ev.notes || '' : undefined}>
                      {ev.action === 'BUYER_DAILY_RESPONSE'
                        ? ev.notes || 'Buyer daily sign-off'
                        : prev !== '-' ? `${prev} → ${next}` : next}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                      {ev.user?.name || 'System'} ({ev.userRole})
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 font-semibold text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        Logged
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls for Order Change History */}
        {order.auditEvents && order.auditEvents.length > auditLimit && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-3 border-t border-slate-100 text-xs">
            <span className="text-slate-500 font-medium">
              Showing {(auditPage - 1) * auditLimit + 1} to{' '}
              {Math.min(auditPage * auditLimit, order.auditEvents.length)} of{' '}
              {order.auditEvents.length} recorded changes
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                disabled={auditPage <= 1}
                className="p-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition cursor-pointer"
                title="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {Array.from({ length: totalAuditPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAuditPage(p)}
                  className={`w-6 h-6 text-xs font-bold rounded-md transition cursor-pointer ${
                    p === auditPage
                      ? 'bg-[#0C2D48] text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setAuditPage((p) => Math.min(totalAuditPages, p + 1))}
                disabled={auditPage >= totalAuditPages}
                className="p-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition cursor-pointer"
                title="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Date Alteration Modal with Reason Code Prompt */}
      {isDateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            style={{ colorScheme: 'light' }}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden text-slate-900"
          >
            <div className="bg-[#0C2D48] px-6 py-4 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Shift Ex-Factory Delivery Date</h3>
                <p className="text-xs text-sky-200/80">
                  Delivery schedule shift and compliance logging
                </p>
              </div>
              <button
                onClick={() => setIsDateModalOpen(false)}
                className="text-sky-200 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDateChangeSubmit} className="p-6 space-y-4 bg-white text-slate-900">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  New Ex-Factory Date <span className="text-rose-500">*</span>
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
                  Reason for Date Change <span className="text-rose-500">*</span>
                </label>
                <select
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-semibold bg-white text-slate-900 shadow-xs"
                  required
                >
                  <option className="bg-white text-slate-900" value="BUYER_REQUEST">Buyer Requested Delivery Postponement</option>
                  <option className="bg-white text-slate-900" value="FABRIC_DELAY">Fabric / Yarn Supply Delay</option>
                  <option className="bg-white text-slate-900" value="LABOUR_SHORTAGE">Labour / Attendance Shortage</option>
                  <option className="bg-white text-slate-900" value="MACHINE_BREAKDOWN">Machine Maintenance / Line Breakdown</option>
                  <option className="bg-white text-slate-900" value="POWER_OUTAGE">Power Outage / Facility Interruption</option>
                  <option className="bg-white text-slate-900" value="QUALITY_HOLD">Quality Inspection / Shade Approval Hold</option>
                  <option className="bg-white text-slate-900" value="SUBCONTRACTOR_DELAY">Subcontractor Processing Delay</option>
                  <option className="bg-white text-slate-900" value="OTHER">Other Reason</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Explanatory Notes & Rationale
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Provide context regarding the schedule shift for buyer and internal records..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 bg-white text-slate-900 placeholder:text-slate-400 shadow-xs"
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Estimated Financial Impact (₹ INR)
                </label>
                <input
                  type="number"
                  min={0}
                  value={financialImpact}
                  onChange={(e) => setFinancialImpact(Number(e.target.value))}
                  placeholder="e.g. 50000 for air-freight or overtime penalty"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-mono bg-white text-slate-900 placeholder:text-slate-400 shadow-xs"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600">
                Recalibrates milestone schedules and records change in audit history.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDateModalOpen(false)}
                  disabled={updatingDate}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingDate || !reasonCode}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-xl shadow-xs transition"
                >
                  {updatingDate && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Date Shift
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
                  Floor Evidence Proof ({selectedImageModal.stage?.replace(/_/g, ' ')})
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
              <span>Logged by: <strong>{selectedImageModal.supervisorName || 'Floor Supervisor'}</strong></span>
              <span>Timestamp: <strong>{selectedImageModal.date}</strong></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
