import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  Clock,
  User,
  Loader2,
  Calendar,
} from 'lucide-react';
import { RiskAlertItem } from '../../types';
import { apiRequest } from '../../services/api';
import { Language } from '../supervisor/supervisorTranslations';

interface RiskReviewCardProps {
  alert: RiskAlertItem;
  onAlertUpdated?: (updated: RiskAlertItem) => void;
  lang?: Language;
}

const CATEGORY_TRANSLATIONS: Record<string, { en: string; ta: string }> = {
  MACHINE_BREAKDOWN: { en: 'Machine Breakdown', ta: 'இயந்திரக் கோளாறு' },
  POWER_OUTAGE: { en: 'Power Outage', ta: 'மின்வெட்டு / மின் தடை' },
  FABRIC_DEFECT: { en: 'Fabric Defect', ta: 'துணி குறைபாடு' },
  SUBCONTRACTOR_DELAY: { en: 'Subcontractor Delay', ta: 'துணை ஒப்பந்தத் தாமதம்' },
  LABOUR_SHORTAGE: { en: 'Labour Shortage', ta: 'பணியாளர் பற்றாக்குறை' },
  OTHER: { en: 'Operational Issue', ta: 'செயல்பாட்டுப் பிரச்சனை' },
};

export const RiskReviewCard: React.FC<RiskReviewCardProps> = ({
  alert,
  onAlertUpdated,
  lang: initialLang,
}) => {
  const [lang, setLang] = useState<Language>(
    initialLang || (localStorage.getItem('threadflow_lang') as Language) || 'en'
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

  const [isConfirming, setIsConfirming] = useState(false);
  const [isOverriding, setIsOverriding] = useState(false);
  const [mitigationPlan, setMitigationPlan] = useState(alert.mitigationPlan || '');
  const [resolutionReason, setResolutionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isPending = alert.approvalStatus === 'PENDING_REVIEW';
  const isConfirmed = alert.approvalStatus === 'CONFIRMED';
  const isOverridden = alert.approvalStatus === 'OVERRIDDEN';

  // Get clean English note (never Tamil)
  const cleanEnglishNote =
    (alert.floorIssue as any)?.cleanEnglishNote ||
    alert.floorIssue?.translatedText ||
    'Floor operational issue reported during shift.';

  const rawCategory = alert.floorIssue?.category || 'MACHINE_BREAKDOWN';
  const categoryLabel = CATEGORY_TRANSLATIONS[rawCategory]?.[lang] || rawCategory.replace(/_/g, ' ');

  // Exact Date and Time when record was recorded on floor
  const recordedAtTimestamp = alert.floorIssue?.loggedAt || alert.createdAt;
  const recordedDateTime = new Date(recordedAtTimestamp).toLocaleString(
    lang === 'ta' ? 'ta-IN' : 'en-IN',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }
  );

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

  // Submit confirmation for buyer view
  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mitigationPlan.trim()) {
      setErrorMessage(
        lang === 'ta'
          ? 'சர்வதேச வாங்குபவருக்கான தீர்வு குறிப்பை உள்ளிடவும்.'
          : 'Please enter an external mitigation note for international buyer view.'
      );
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await apiRequest<{ success: boolean; data: any }>(
        `/risk/alerts/${alert.id}/confirm`,
        {
          method: 'POST',
          body: JSON.stringify({
            mitigationPlan: mitigationPlan.trim(),
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
      setErrorMessage(
        lang === 'ta'
          ? 'உள்ளகத் தீர்வின் காரணத்தை உள்ளிடவும்.'
          : 'Please enter an internal resolution reason.'
      );
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await apiRequest<{ success: boolean; data: any }>(
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
          ? 'border-amber-200/80 hover:border-amber-300'
          : isConfirmed
          ? 'border-emerald-200/80 bg-emerald-50/15'
          : 'border-slate-200 bg-slate-50/50'
      }`}
    >
      {/* Top Header Bar Styled with Dark Navy Matching Sidebar & Table Headers */}
      <div className="px-4 py-2.5 bg-[#0C2D48] text-white border-b border-[#143D60] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-black text-sky-200 bg-white/10 px-2 py-0.5 rounded border border-white/20">
            {alert.poNumber}
          </span>
          <span className="font-bold text-white">{alert.style.split(' (')[0].split(' - ')[0]}</span>
          <span className="text-white/40">•</span>
          <span className="font-medium text-sky-100">{alert.buyer.name}</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-sky-900/90 text-sky-200 border border-sky-600/80">
            {alert.stage.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Status Badge & Recorded Date/Time */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-200 bg-white/10 px-2 py-0.5 rounded-lg border border-white/15">
            <Calendar className="w-3 h-3 text-sky-300" />
            <span>{recordedDateTime}</span>
          </span>

          {isPending && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-amber-950 border border-amber-300 shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-amber-900" />
              {lang === 'ta' ? 'மதிப்பாய்வு நிலுவை' : 'Pending Review'}
            </span>
          )}
          {isConfirmed && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-400 text-emerald-950 border border-emerald-300 shadow-2xs">
              <Eye className="w-3.5 h-3.5 text-emerald-900" />
              {lang === 'ta' ? 'வாங்குபவருக்குத் தெரிவிக்கப்பட்டது' : 'Buyer Informed'}
            </span>
          )}
          {isOverridden && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-800 border border-slate-300 shadow-2xs">
              <EyeOff className="w-3.5 h-3.5 text-slate-700" />
              {lang === 'ta' ? 'உள்ளகமாகத் தீர்க்கப்பட்டது' : 'Handled Internally'}
            </span>
          )}
        </div>
      </div>

      {/* Main Content: Clean 2-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-100 p-4 gap-4 md:gap-0">
        {/* Left Column: Reported Floor Issue (Clean English Note & Supervisor Info) */}
        <div className="md:col-span-6 md:pr-5 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-500 flex-wrap gap-1">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              {alert.floorIssue?.supervisorName || (lang === 'ta' ? 'தள மேற்பார்வையாளர்' : 'Floor Supervisor')}
            </span>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400 flex-wrap">
              <span>
                {alert.floorIssue?.shift || 'DAY'} {lang === 'ta' ? 'ஷிப்ட்' : 'Shift'} • {alert.floorIssue?.machineLine || 'Line 1'}
              </span>
              <span className="text-slate-300">•</span>
              <span className="inline-flex items-center gap-1 text-slate-600 font-mono font-bold bg-slate-100/80 px-1.5 py-0.5 rounded">
                <Clock className="w-3 h-3 text-slate-500" />
                {recordedDateTime}
              </span>
            </div>
          </div>

          <div>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
              {categoryLabel}
            </span>
          </div>

          {/* Clean English Note */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-800 leading-relaxed font-medium">
            "{cleanEnglishNote}"
          </div>
        </div>

        {/* Right Column: Buyer Notification Decision */}
        <div className="md:col-span-6 md:pl-5 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                {lang === 'ta' ? 'வாங்குபவர் அறிவிப்பு முடிவு' : 'Buyer Notification Decision'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mb-2">
              {lang === 'ta'
                ? 'இந்த உற்பத்திப் பிரச்சனையை சர்வதேச வாங்குபவருக்குத் தெரிவிக்க வேண்டுமா அல்லது ஆலையிலேயே தீர்க்க முடியுமா என்பதை முடிவு செய்யுங்கள்.'
                : 'Decide whether this operational problem requires international buyer notification or can be resolved internally within factory buffers.'}
            </p>

            {/* Resolved state: Confirmed */}
            {isConfirmed && (
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {lang === 'ta'
                      ? 'தீர்வுத் திட்டத்துடன் வாங்குபவருக்குத் தெரிவிக்கப்பட்டது:'
                      : 'Notified to Buyer with Mitigation Note:'}
                  </span>
                </div>
                <p className="text-slate-700 italic bg-white/90 p-2 rounded-lg border border-emerald-200/60 leading-relaxed">
                  "{alert.mitigationPlan}"
                </p>
                <div className="text-[10px] text-slate-400 text-right">
                  {lang === 'ta' ? 'வணிகரால் மதிப்பாய்வு செய்யப்பட்டது' : 'Reviewed by Merchandiser'} •{' '}
                  {alert.reviewedAt ? new Date(alert.reviewedAt).toLocaleDateString() : 'Confirmed'}
                </div>
              </div>
            )}

            {/* Resolved state: Overridden */}
            {isOverridden && (
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <ShieldCheck className="w-4 h-4 text-slate-600 shrink-0" />
                  <span>
                    {lang === 'ta'
                      ? 'உள்ளகமாகத் தீர்க்கப்பட்டது (வாங்குபவர் பாதுகாக்கப்பட்டார்):'
                      : 'Handled Internally (Buyer Protected):'}
                  </span>
                </div>
                <p className="text-slate-600 italic bg-white p-2 rounded-lg border border-slate-200 leading-relaxed">
                  "{alert.mitigationPlan}"
                </p>
                <div className="text-[10px] text-slate-400 text-right">
                  {lang === 'ta'
                    ? 'வாங்குபவர் போர்ட்டலில் இருந்து மறைக்கப்பட்டது • ஆலைக்குள் கையாளப்பட்டது'
                    : 'Hidden from buyer portal • Managed within factory line buffers'}
                </div>
              </div>
            )}

            {/* Pending State: Two Clear Buttons */}
            {isPending && !isConfirming && !isOverriding && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsConfirming(true);
                    setIsOverriding(false);
                  }}
                  className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{lang === 'ta' ? 'வாங்குபவருக்குத் தெரிவி' : 'Inform Buyer'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsOverriding(true);
                    setIsConfirming(false);
                  }}
                  className="py-2.5 px-3 bg-white hover:bg-slate-100 active:scale-98 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold shadow-3xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                  <span>{lang === 'ta' ? 'உள்ளகமாக வை' : 'Keep Internal'}</span>
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

          {/* CONFIRM / INFORM BUYER COMPOSER */}
          {isConfirming && (
            <form onSubmit={handleConfirm} className="p-3 bg-white rounded-xl border border-emerald-300 space-y-2 mt-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-900">
                  {lang === 'ta' ? 'வாங்குபவருக்கான தீர்வு குறிப்பு' : 'Mitigation Note for Buyer'}
                </span>
                <button
                  type="button"
                  onClick={handleGenerateAiDraft}
                  disabled={isGeneratingAi}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-lg border border-indigo-200 cursor-pointer disabled:opacity-50"
                >
                  {isGeneratingAi ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-indigo-600" />}
                  <span>{isGeneratingAi ? (lang === 'ta' ? 'வரைவு செய்கிறது...' : 'Drafting...') : (lang === 'ta' ? '✨ AI வரைவு குறிப்பு' : '✨ AI Draft Note')}</span>
                </button>
              </div>

              <textarea
                value={mitigationPlan}
                onChange={(e) => setMitigationPlan(e.target.value)}
                placeholder={
                  lang === 'ta'
                    ? 'வாங்குபவருக்கு நிலைமையை விளக்கும் அமைதியான, தொழில்முறை குறிப்பை எழுதுங்கள்...'
                    : 'Compose a reassuring, professional note explaining the operational mitigation to the buyer...'
                }
                rows={2}
                className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 bg-slate-50 text-slate-800"
              />

              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting
                    ? lang === 'ta' ? 'அனுப்புகிறது...' : 'Sending...'
                    : lang === 'ta' ? 'வாங்குபவருக்கு வெளியிடு' : 'Publish to Buyer'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirming(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                >
                  {lang === 'ta' ? 'ரத்து செய்' : 'Cancel'}
                </button>
              </div>
            </form>
          )}

          {/* INTERNAL OVERRIDE COMPOSER */}
          {isOverriding && (
            <form onSubmit={handleOverride} className="p-3 bg-white rounded-xl border border-slate-300 space-y-2 mt-2 animate-in fade-in">
              <span className="text-xs font-black text-slate-800">
                {lang === 'ta' ? 'உள்ளகத் தீர்வு குறிப்பு' : 'Internal Resolution Note'}
              </span>
              <textarea
                value={resolutionReason}
                onChange={(e) => setResolutionReason(e.target.value)}
                placeholder={
                  lang === 'ta'
                    ? 'இச்சிக்கல் எவ்வாறு உள்ளகமாகத் தீர்க்கப்பட்டது என்பதை விளக்குங்கள் (எ.கா: ஜெனரேட்டர் பயன்படுத்தப்பட்டது, ஊசி மாற்றப்பட்டது)...'
                    : 'Explain how this problem was handled internally (e.g. backup generator used, needle replaced)...'
                }
                rows={2}
                className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 bg-slate-50 text-slate-800"
              />

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() =>
                    setResolutionReason(
                      lang === 'ta'
                        ? 'தாங்கல் நேரம் தாமதத்தை ஈடுசெய்கிறது.'
                        : 'Buffer absorbs delay with zero delivery impact.'
                    )
                  }
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200 cursor-pointer"
                >
                  {lang === 'ta' ? 'தாங்கல் நேரம் ஈடுசெய்கிறது' : 'Buffer absorbs delay'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setResolutionReason(
                      lang === 'ta'
                        ? 'தளத்தில் தீர்க்கப்பட்டது; பராமரிப்பு முடிந்தது.'
                        : 'Resolved on floor; maintenance completed.'
                    )
                  }
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200 cursor-pointer"
                >
                  {lang === 'ta' ? 'தளத்தில் தீர்க்கப்பட்டது' : 'Resolved on floor'}
                </button>
              </div>

              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting
                    ? lang === 'ta' ? 'சேமிக்கிறது...' : 'Saving...'
                    : lang === 'ta' ? 'உள்ளகத் தீர்வைச் சேமி' : 'Save Internal Resolution'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOverriding(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                >
                  {lang === 'ta' ? 'ரத்து செய்' : 'Cancel'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
