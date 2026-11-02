import React, { useState, useEffect, useRef } from 'react';
import {
  Stage,
  SupervisorWorkOrderItem,
  SupervisorActiveMilestone,
} from '../../types';
import {
  SUPERVISOR_ISSUE_CHIPS,
  STAGE_TRANSLATIONS,
  SUPERVISOR_I18N,
  Language,
  IssueChipItem,
  translateStyle,
  translateDescription,
  translateBuyer,
} from './supervisorTranslations';
import { useTamilSpeechRecognition } from '../../hooks/useTamilSpeechRecognition';
import { compressFloorPhoto } from '../../offline/imageCompressor';
import { queueProductionUpdate, isEffectiveOnline, generateUUID } from '../../offline/queue/queue';
import { apiRequest } from '../../services/api';
import {
  Mic,
  MicOff,
  Camera,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Layers,
  Clock,
  Check,
  ChevronDown,
} from 'lucide-react';

interface ProductionUpdateFormProps {
  order: SupervisorWorkOrderItem;
  activeMilestone: SupervisorActiveMilestone;
  lang: Language;
  onSuccess: (message: string) => void;
  onCancel?: () => void;
}

export const ProductionUpdateForm: React.FC<ProductionUpdateFormProps> = ({
  order,
  activeMilestone,
  lang,
  onSuccess,
  onCancel,
}) => {
  const t = SUPERVISOR_I18N[lang];
  const [selectedStage, setSelectedStage] = useState<Stage>(activeMilestone.stage);
  const [shift, setShift] = useState<'DAY' | 'NIGHT'>('DAY');
  const [machineLine, setMachineLine] = useState('Line 1');

  // Quantities
  const [goodQty, setGoodQty] = useState<number>(0);
  const [rejectedQty, setRejectedQty] = useState<number>(0);

  // Issues & Notes
  const [selectedChip, setSelectedChip] = useState<IssueChipItem | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [compressedPhoto, setCompressedPhoto] = useState<string | null>(null);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);

  // Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Speech Recognition Hook
  const {
    isListening,
    isSupported: isSpeechSupported,
    transcript,
    interimTranscript,
    error: speechError,
    startListening,
    stopListening,
    resetTranscript,
  } = useTamilSpeechRecognition();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize transcribed Tamil speech into the notes input
  useEffect(() => {
    if (transcript) {
      setNotes((prev) => {
        const trimmed = prev.trim();
        return trimmed ? `${trimmed} ${transcript}` : transcript;
      });
      resetTranscript();
    }
  }, [transcript, resetTranscript]);

  // Haptic feedback helper for mobile touch
  const triggerHaptic = (ms = 40) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch {
        // ignore
      }
    }
  };

  // Quick increment handlers for Good Quantity
  const handleAddGoodQty = (amount: number) => {
    triggerHaptic(40);
    setGoodQty((prev) => Math.max(0, prev + amount));
    setFormError(null);
  };

  const handleResetGoodQty = () => {
    triggerHaptic(30);
    setGoodQty(0);
  };

  // Quick increment handlers for Rejected Quantity
  const handleAddRejectedQty = (amount: number) => {
    triggerHaptic(40);
    setRejectedQty((prev) => Math.max(0, prev + amount));
  };

  const handleResetRejectedQty = () => {
    triggerHaptic(30);
    setRejectedQty(0);
  };

  // Issue Chip toggle
  const handleToggleChip = (chip: IssueChipItem) => {
    triggerHaptic(50);
    if (selectedChip?.id === chip.id) {
      setSelectedChip(null);
    } else {
      setSelectedChip(chip);
      // Pre-populate note if empty with the Tamil/English description
      const chipText = lang === 'ta' ? chip.labelTa : chip.labelEn;
      if (!notes.includes(chipText)) {
        setNotes((prev) => (prev ? `${prev} [${chipText}]` : `[${chipText}]`));
      }
    }
  };

  // Photo compression handler
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressingPhoto(true);
      const compressedDataUrl = await compressFloorPhoto(file, 1024, 0.72);
      setCompressedPhoto(compressedDataUrl);
      triggerHaptic(60);
    } catch (err: any) {
      setFormError(`Photo error: ${err.message || 'Failed to compress photo'}`);
    } finally {
      setIsCompressingPhoto(false);
    }
  };

  // Voice recording toggle
  const handleToggleVoice = () => {
    triggerHaptic(50);
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (goodQty <= 0 && rejectedQty <= 0) {
      setFormError(t.validationErrorQty);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const targetMilestone =
      order.milestones.find((m) => m.stage === selectedStage) || activeMilestone;

    const payload = {
      orderId: order.orderId,
      poNumber: order.poNumber,
      style: order.style,
      milestoneId: targetMilestone.id,
      stage: selectedStage,
      shift,
      machineLine,
      goodQuantity: goodQty,
      rejectedQuantity: rejectedQty,
      notes: notes.trim() || undefined,
      issueCategory: selectedChip?.category || undefined,
      compressedPhotoBase64: compressedPhoto || undefined,
      clientEventAt: new Date().toISOString(),
    };

    try {
      if (isEffectiveOnline()) {
        // Direct Online Submission
        try {
          await apiRequest('/production/updates', {
            method: 'POST',
            body: JSON.stringify({
              ...payload,
              idempotencyKey: generateUUID(),
            }),
          });
          triggerHaptic(100);
          onSuccess(
            lang === 'ta'
              ? `ஆர்டர் #${order.poNumber} க்கு ${goodQty} துணிகள் வெற்றிகரமாக பதிவாகியது!`
              : `Successfully logged ${goodQty} pieces for ${order.poNumber}!`
          );
          return;
        } catch (apiErr: any) {
          // If network failed midway, fallback to offline queue automatically!
          console.warn('Direct API submission failed, falling back to offline queue:', apiErr);
          await queueProductionUpdate(payload);
          triggerHaptic(80);
          onSuccess(
            lang === 'ta'
              ? `நெட்வொர்க் பிழை. பதிவு ஆஃப்லைன் வரிசையில் சேர்க்கப்பட்டது (Auto-syncs)!`
              : `Network dropped. Saved to Offline Queue (Auto-syncs when online)!`
          );
          return;
        }
      } else {
        // Offline / Offline Simulated Submission
        await queueProductionUpdate(payload);
        triggerHaptic(80);
        onSuccess(
          lang === 'ta'
            ? `ஆஃப்லைன் பதிவு சேமிக்கப்பட்டது! இணையம் வந்ததும் தானாக சர்வரில் சேரும்.`
            : `Saved offline! Will automatically synchronize once back online.`
        );
      }
    } catch (err: any) {
      setFormError(err.message || 'Submission error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stageName =
    STAGE_TRANSLATIONS[selectedStage]?.[lang] || selectedStage;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Target PO Header Card (Preserves authentic commercial buyer & product names) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {order.buyer.name}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            {order.poNumber}
          </span>
        </div>
        <div className="text-base font-extrabold text-slate-900 truncate">
          {order.style}
        </div>
        <div className="text-xs text-slate-500 mt-0.5 truncate">
          {order.description || (lang === 'ta' ? 'ஏற்றுமதி பின்னலாடை ஆர்டர்' : 'Export Knitwear Style')}
        </div>

        {/* Stage Selector */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            {t.stageLabel}:
          </div>
          <div className="relative">
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value as Stage)}
              className="appearance-none bg-slate-100 text-slate-900 font-bold text-xs rounded-lg pl-3 pr-7 py-1.5 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {order.milestones.map((m) => (
                <option key={m.id} value={m.stage}>
                  {STAGE_TRANSLATIONS[m.stage]?.[lang] || m.stage}{' '}
                  {m.isCompleted ? '✓' : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Shift & Line Selectors (Responsive 1-col on mobile, 2-col on sm+) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* Shift Toggle */}
        <div className="bg-white rounded-xl p-2.5 border border-slate-200 flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1 shrink-0">
            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>{t.shiftLabel}:</span>
          </span>
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(30);
                setShift('DAY');
              }}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                shift === 'DAY'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.shiftDay}
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic(30);
                setShift('NIGHT');
              }}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                shift === 'NIGHT'
                  ? 'bg-indigo-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.shiftNight}
            </button>
          </div>
        </div>

        {/* Machine Line Selector */}
        <div className="bg-white rounded-xl p-2.5 border border-slate-200 flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-700 shrink-0">{t.lineSelector}:</span>
          <select
            value={machineLine}
            onChange={(e) => setMachineLine(e.target.value)}
            className="flex-1 max-w-[150px] bg-slate-100 text-slate-900 font-bold text-xs rounded-lg px-2 py-1.5 border border-slate-200 focus:outline-none truncate"
          >
            <option value="Line 1">{lang === 'ta' ? 'வரிசை 1' : 'Line 1'}</option>
            <option value="Line 2">{lang === 'ta' ? 'வரிசை 2' : 'Line 2'}</option>
            <option value="Line 3">{lang === 'ta' ? 'வரிசை 3' : 'Line 3'}</option>
            <option value="Line 4">{lang === 'ta' ? 'வரிசை 4' : 'Line 4'}</option>
            <option value="Subcontract">{t.outsideUnit}</option>
          </select>
        </div>
      </div>

      {/* ONE-TAP QUICK-INCREMENT KEYPAD (Good Output) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            {t.goodQuantity}
          </span>
          <button
            type="button"
            onClick={handleResetGoodQty}
            className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-red-600 px-2 py-1 rounded-md hover:bg-red-50 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t.reset}
          </button>
        </div>

        {/* Numeric Display & Direct Input */}
        <div className="relative mb-3">
          <input
            type="number"
            min={0}
            value={goodQty === 0 ? '' : goodQty}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              setGoodQty(isNaN(val) ? 0 : Math.max(0, val));
              setFormError(null);
            }}
            placeholder="0"
            className="w-full text-center text-4xl font-black text-slate-900 tracking-tight bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-inner"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
            {t.pieces.toUpperCase()}
          </span>
        </div>

        {/* One-Tap Increments Grid */}
        <div className="grid grid-cols-4 gap-2">
          {[50, 100, 250, 500].map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => handleAddGoodQty(amount)}
              className="min-h-[52px] bg-slate-100 hover:bg-emerald-600 active:scale-95 text-slate-900 hover:text-white font-black text-base rounded-xl border border-slate-300 shadow-sm transition-all flex flex-col items-center justify-center"
            >
              <span className="text-xs font-semibold opacity-70">+</span>
              <span>{amount}</span>
            </button>
          ))}
        </div>
      </div>

      {/* REJECTED QUANTITY COUNTER (Defective output) */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            {t.rejectedQuantity}
          </span>
          {rejectedQty > 0 && (
            <button
              type="button"
              onClick={handleResetRejectedQty}
              className="text-xs font-bold text-slate-400 hover:text-red-600 px-2 py-0.5 rounded"
            >
              {t.reset}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 text-center py-2 bg-rose-50 border border-rose-200 rounded-xl">
            <span className="text-2xl font-black text-rose-700">
              {rejectedQty} <span className="text-xs font-normal">{t.pieces}</span>
            </span>
          </div>
          <div className="flex gap-1.5">
            {[1, 5, 10].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => handleAddRejectedQty(amt)}
                className="min-h-[46px] px-3.5 bg-slate-100 hover:bg-rose-100 active:scale-95 text-rose-800 font-black text-sm rounded-xl border border-slate-300 transition-all"
              >
                +{amt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 6 VISUAL TAMIL ISSUE CHIPS */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            {t.issueChipsTitle}
          </span>
          {selectedChip && (
            <button
              type="button"
              onClick={() => setSelectedChip(null)}
              className="text-xs text-slate-400 hover:text-slate-600 font-bold"
            >
              {t.clear}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SUPERVISOR_ISSUE_CHIPS.map((chip) => {
            const isSelected = selectedChip?.id === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => handleToggleChip(chip)}
                className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-amber-100 border-amber-500 shadow-md ring-2 ring-amber-400/50'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xl">{chip.emoji}</span>
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px] font-bold">
                      ✓
                    </span>
                  )}
                </div>
                <div className="text-xs font-extrabold text-slate-900 leading-tight">
                  {lang === 'ta' ? chip.labelTa : chip.labelEn}
                </div>
                <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                  {lang === 'ta' ? chip.subtextTa : chip.subtextEn}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAMIL VOICE-TO-TEXT & NOTES */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black uppercase tracking-wider text-slate-800">
            {t.notesVoiceTitle}
          </span>
          <span className="text-[10px] font-bold text-slate-400">
            {lang === 'ta' ? 'தமிழ் குரல் பதிவு (ta-IN)' : 'Tamil Speech (ta-IN)'}
          </span>
        </div>

        {/* Voice Recognition Button */}
        <div className="mb-3">
          <button
            type="button"
            onClick={handleToggleVoice}
            disabled={!isSpeechSupported}
            className={`w-full min-h-[52px] rounded-xl font-black text-sm flex items-center justify-center gap-2.5 transition-all shadow-sm ${
              isListening
                ? 'bg-rose-600 text-white animate-pulse ring-4 ring-rose-200'
                : 'bg-indigo-50 border-2 border-indigo-200 text-indigo-900 hover:bg-indigo-100 active:scale-95'
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-5 h-5 text-white animate-bounce" />
                <span>{t.voiceListening} ({t.voiceStop})</span>
              </>
            ) : (
              <>
                <Mic className="w-5 h-5 text-indigo-700" />
                <span>{t.voiceStart}</span>
              </>
            )}
          </button>

          {/* Interim speech transcript live preview */}
          {isListening && interimTranscript && (
            <div className="mt-2 p-2 bg-indigo-50/70 border border-indigo-100 rounded-lg text-xs font-medium text-indigo-900 italic">
              "{interimTranscript}..."
            </div>
          )}

          {speechError && (
            <div className="mt-1.5 text-xs text-rose-600 font-semibold">
              {speechError}
            </div>
          )}
        </div>

        {/* Notes Textarea */}
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t.notesPlaceholder}
          className="w-full text-xs font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-blue-500 focus:bg-white resize-none"
        />

        {/* Client-Side Canvas Compressed Photo Capture */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputRef}
            onChange={handlePhotoSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isCompressingPhoto}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-colors"
          >
            <Camera className="w-4 h-4 text-slate-600" />
            {isCompressingPhoto ? (lang === 'ta' ? 'சுருக்கப்படுகிறது...' : 'Compressing...') : t.takePhoto}
          </button>

          {compressedPhoto && (
            <div className="flex items-center gap-2">
              <img
                src={compressedPhoto}
                alt="Floor capture"
                className="w-9 h-9 object-cover rounded-lg border border-emerald-400 shadow-sm"
              />
              <span className="text-[10px] font-bold text-emerald-700">
                {t.photoAttached}
              </span>
              <button
                type="button"
                onClick={() => setCompressedPhoto(null)}
                className="text-xs text-slate-400 hover:text-red-500"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {formError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
          <span>{formError}</span>
        </div>
      )}

      {/* SUBMIT BUTTON */}
      <div className="pt-1">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full min-h-[56px] bg-slate-900 hover:bg-black active:scale-[0.98] text-white font-black text-base rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isSubmitting ? (
            <span>{t.submitting}</span>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>{t.submitShiftUpdate}</span>
            </>
          )}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full mt-2 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 text-center"
          >
            {t.cancel}
          </button>
        )}
      </div>
    </form>
  );
};
