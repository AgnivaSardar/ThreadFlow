import React, { useState } from 'react';
import {
  Mic,
  Volume2,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ArrowRight,
  TrendingDown,
  Layers,
  Building,
  User,
  Calendar,
  DollarSign,
  Loader2,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { RiskAlertItem } from '../../types';
import { apiRequest } from '../../services/api';

interface RiskReviewCardProps {
  alert: RiskAlertItem;
  onAlertUpdated?: (updated: RiskAlertItem) => void;
  compact?: boolean;
}

export const RiskReviewCard: React.FC<RiskReviewCardProps> = ({
  alert,
  onAlertUpdated,
  compact = false,
}) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isOverriding, setIsOverriding] = useState(false);
  const [mitigationPlan, setMitigationPlan] = useState(alert.mitigationPlan || '');
  const [resolutionReason, setResolutionReason] = useState('');
  const [actionType, setActionType] = useState('AUTHORIZE_OVERTIME');
  const [estimatedCost, setEstimatedCost] = useState<number>(18000);
  const [addedDailyCapacity, setAddedDailyCapacity] = useState<number>(150);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isPending = alert.approvalStatus === 'PENDING_REVIEW';
  const isConfirmed = alert.approvalStatus === 'CONFIRMED';
  const isOverridden = alert.approvalStatus === 'OVERRIDDEN';

  // AI draft generator for buyer note
  const handleGenerateAiDraft = async () => {
    setIsGeneratingAi(true);
    setErrorMessage(null);
    try {
      const res = await apiRequest<{ success: boolean; data: { draftText: string } }>(
        `/risk/alerts/${alert.id}/generate-mitigation`,
        { method: 'POST' }
      );
      if (res.data?.draftText) {
        setMitigationPlan(res.data.draftText);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to generate AI buyer draft');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Submit confirmation
  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mitigationPlan.trim()) {
      setErrorMessage('Please enter an external mitigation note for international buyer view.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await apiRequest<{ success: boolean; data: any }>(
        `/risk/alerts/${alert.id}/confirm`,
        {
          method: 'POST',
          body: JSON.stringify({
            mitigationPlan: mitigationPlan.trim(),
            actionType,
            addedDailyCapacity: Number(addedDailyCapacity),
            estimatedCostRupees: Number(estimatedCost),
          }),
        }
      );
      setIsConfirming(false);
      if (onAlertUpdated) {
        onAlertUpdated({
          ...alert,
          approvalStatus: 'CONFIRMED',
          isBuyerVisible: true,
          mitigationPlan: mitigationPlan.trim(),
          reviewedAt: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to confirm alert for buyer');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit internal override
  const handleOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolutionReason.trim()) {
      setErrorMessage('Please enter an internal resolution reason.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await apiRequest<{ success: boolean; data: any }>(
        `/risk/alerts/${alert.id}/override`,
        {
          method: 'POST',
          body: JSON.stringify({
            resolutionReason: resolutionReason.trim(),
          }),
        }
      );
      setIsOverriding(false);
      if (onAlertUpdated) {
        onAlertUpdated({
          ...alert,
          approvalStatus: 'OVERRIDDEN',
          isBuyerVisible: false,
          mitigationPlan: resolutionReason.trim(),
          reviewedAt: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to override alert');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`bg-white rounded-2xl border transition-all shadow-xs overflow-hidden ${
        isPending
          ? 'border-amber-200/90 hover:border-amber-300'
          : isConfirmed
          ? 'border-emerald-200/80 bg-emerald-50/10'
          : 'border-slate-200 bg-slate-50/40'
      }`}
    >
      {/* Top Banner / Order Context Row */}
      <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-black text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 shadow-3xs">
            {alert.poNumber}
          </span>
          <span className="text-xs font-bold text-slate-900">{alert.style}</span>
          <span className="text-xs text-slate-400">•</span>
          <span className="text-xs font-semibold text-slate-600">{alert.buyer.name}</span>
          <span className="text-xs px-2 py-0.5 rounded-md font-extrabold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200/70 text-[10px]">
            {alert.stage}
          </span>
        </div>

        {/* Status / Visibility Badges */}
        <div className="flex items-center gap-2">
          {isPending && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
              <Clock className="w-3.5 h-3.5 text-amber-700" />
              Pending Merchandiser Review
            </span>
          )}
          {isConfirmed && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
              <Eye className="w-3.5 h-3.5 text-emerald-700" />
              Buyer Visible (Mitigated)
            </span>
          )}
          {isOverridden && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-slate-200 text-slate-800 border border-slate-300">
              <EyeOff className="w-3.5 h-3.5 text-slate-600" />
              Internal Only (Overridden)
            </span>
          )}

          <span
            className={`text-xs font-mono font-black px-2 py-0.5 rounded-md border ${
              alert.riskLevel === 'RED'
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : alert.riskLevel === 'AMBER'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            {alert.riskLevel === 'RED' ? 'DEFICIT' : alert.riskLevel === 'AMBER' ? 'BUFFER RISK' : 'ON-TRACK'}
          </span>
        </div>
      </div>

      {/* 3-Column Side-by-Side Review Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
        {/* COLUMN 1 (Left): Raw Floor Voice / Tamil Transcript */}
        <div className="lg:col-span-4 p-4 space-y-3 bg-slate-50/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5 text-rose-500" />
              Floor Audio & Raw Note
            </span>
            <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">
              {alert.floorIssue?.shift || 'DAY'} • {alert.floorIssue?.machineLine || 'Line 1'}
            </span>
          </div>

          <div className="p-3 bg-white rounded-xl border border-rose-100 shadow-3xs space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span className="flex items-center gap-1 text-slate-700 font-bold">
                <User className="w-3 h-3 text-slate-400" />
                {alert.floorIssue?.supervisorName || 'Floor Supervisor'}
              </span>
              <span>{alert.floorIssue ? new Date(alert.floorIssue.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Logged'}</span>
            </div>

            <p className="text-xs text-rose-950 font-semibold leading-relaxed bg-rose-50/50 p-2.5 rounded-lg border border-rose-200/60 font-sans">
              "{alert.floorIssue?.rawTamilText || 'வழக்கமான உற்பத்தி பதிவு செய்யப்பட்டது'}"
            </p>
          </div>

          <div className="text-[11px] text-slate-500 space-y-1">
            <div className="flex items-center justify-between">
              <span>Required Pace:</span>
              <span className="font-mono font-bold text-slate-800">{alert.requiredDailyRate.toLocaleString()} pcs/day</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Actual 3-Day Rolling:</span>
              <span className="font-mono font-bold text-slate-800">{alert.actualRollingRate.toLocaleString()} pcs/day</span>
            </div>
          </div>
        </div>

        {/* COLUMN 2 (Center): AI Classification & Clean Translation */}
        <div className="lg:col-span-4 p-4 space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              AI Operational Triage
            </span>
            {alert.floorIssue && (
              <span className="text-[10px] font-extrabold px-2 py-0.5 bg-indigo-50 text-indigo-800 rounded-full border border-indigo-200">
                {Math.round(alert.floorIssue.confidenceScore * 100)}% Confidence
              </span>
            )}
          </div>

          {/* AI Category Pill */}
          <div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-600 text-white shadow-3xs uppercase tracking-wide">
              {alert.floorIssue?.category || 'PROCESS_DELAY'}
            </span>
          </div>

          {/* Clean English Translation */}
          <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100/80">
            <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-900 mb-1">
              Clean English Translation
            </div>
            <p className="text-xs text-slate-800 leading-relaxed font-medium">
              {alert.floorIssue?.translatedText || 'Floor operations proceeding with monitored pacing.'}
            </p>
          </div>

          {/* Deficit Impact Stat Box */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 text-center">
              <div className="text-[10px] text-slate-500 font-bold uppercase">Rate Variance</div>
              <div className="text-sm font-black font-mono text-rose-600">
                {alert.varianceQtyPerDay > 0 ? `+${alert.varianceQtyPerDay}` : alert.varianceQtyPerDay} pcs/d
              </div>
            </div>
            <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 text-center">
              <div className="text-[10px] text-slate-500 font-bold uppercase">Days Late</div>
              <div className="text-sm font-black font-mono text-amber-700">
                +{alert.daysLate}d
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 3 (Right): Merchandiser Action Gate */}
        <div className="lg:col-span-4 p-4 space-y-3 bg-slate-50/30 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-sky-700" />
                Merchandiser Action Gate
              </span>
              <span className="text-xs font-black font-mono text-slate-900">
                ₹{alert.financialExposureRupees.toLocaleString()} At Risk
              </span>
            </div>

            {/* If Already Confirmed or Overridden: show review outcome */}
            {isConfirmed && (
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Confirmed for Buyer Visibility</span>
                </div>
                <p className="text-xs text-emerald-950 font-medium italic bg-white/80 p-2 rounded-lg border border-emerald-200/60">
                  "{alert.mitigationPlan}"
                </p>
                <div className="text-[10px] text-emerald-700 font-semibold flex items-center justify-between">
                  <span>Reviewed by Merchandiser</span>
                  <span>{alert.reviewedAt ? new Date(alert.reviewedAt).toLocaleDateString() : 'Confirmed'}</span>
                </div>
              </div>
            )}

            {isOverridden && (
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <ShieldCheck className="w-4 h-4 text-slate-600 shrink-0" />
                  <span>Resolved Internally (Protected)</span>
                </div>
                <p className="text-xs text-slate-700 italic bg-white p-2 rounded-lg border border-slate-200">
                  "{alert.mitigationPlan}"
                </p>
                <div className="text-[10px] text-slate-500 font-medium">
                  Never visible to international buyer • Managed within factory buffer
                </div>
              </div>
            )}

            {/* If Pending: Action Buttons */}
            {isPending && !isConfirming && !isOverriding && (
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsConfirming(true);
                    setIsOverriding(false);
                  }}
                  className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-black shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  <span>Confirm for Buyer View</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsOverriding(true);
                    setIsConfirming(false);
                  }}
                  className="w-full py-2.5 px-3 bg-white hover:bg-slate-100 active:scale-98 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold shadow-3xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <EyeOff className="w-4 h-4 text-slate-500" />
                  <span>Internal Override (Hide from Buyer)</span>
                </button>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="p-2 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-medium mt-2">
                {errorMessage}
              </div>
            )}
          </div>

          {/* CONFIRMATION INLINE COMPOSER */}
          {isConfirming && (
            <form onSubmit={handleConfirm} className="p-3 bg-white rounded-xl border border-emerald-300 space-y-2.5 mt-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-900">Buyer Mitigation Note</span>
                <button
                  type="button"
                  onClick={handleGenerateAiDraft}
                  disabled={isGeneratingAi}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-lg border border-indigo-200 cursor-pointer disabled:opacity-50"
                >
                  {isGeneratingAi ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-indigo-600" />}
                  <span>{isGeneratingAi ? 'Drafting...' : '✨ AI Draft Note'}</span>
                </button>
              </div>

              <textarea
                value={mitigationPlan}
                onChange={(e) => setMitigationPlan(e.target.value)}
                placeholder="Compose a reassuring, professional note explaining recovery plan to buyer..."
                rows={3}
                className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 bg-slate-50 text-slate-800"
              />

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Mitigation Action</label>
                  <select
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value)}
                    className="w-full mt-0.5 p-1.5 border border-slate-200 rounded-lg text-xs font-medium bg-white"
                  >
                    <option value="AUTHORIZE_OVERTIME">Authorize Overtime</option>
                    <option value="ADD_STITCHING_LINE">Add Extra Line</option>
                    <option value="SPLIT_SUBCONTRACT">Subcontract Assist</option>
                    <option value="AIR_FREIGHT_ABSORB">Factory Air Freight</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Internal Cost (₹)</label>
                  <input
                    type="number"
                    value={estimatedCost}
                    onChange={(e) => setEstimatedCost(Number(e.target.value))}
                    className="w-full mt-0.5 p-1.5 border border-slate-200 rounded-lg text-xs font-medium bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Confirming...' : 'Publish to Buyer'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirming(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* OVERRIDE INLINE COMPOSER */}
          {isOverriding && (
            <form onSubmit={handleOverride} className="p-3 bg-white rounded-xl border border-slate-300 space-y-2 mt-2 animate-in fade-in">
              <span className="text-xs font-black text-slate-800">Internal Override Reason</span>
              <textarea
                value={resolutionReason}
                onChange={(e) => setResolutionReason(e.target.value)}
                placeholder="Explain why this issue is handled internally and safe to hide from buyer..."
                rows={2}
                className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 bg-slate-50 text-slate-800"
              />

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => setResolutionReason('Buffer absorbs delay with zero delivery impact.')}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200 cursor-pointer"
                >
                  Buffer absorbs delay
                </button>
                <button
                  type="button"
                  onClick={() => setResolutionReason('Technical issue resolved; auxiliary capacity mobilized.')}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200 cursor-pointer"
                >
                  Resolved on floor
                </button>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Overriding...' : 'Save Internal Override'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOverriding(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
