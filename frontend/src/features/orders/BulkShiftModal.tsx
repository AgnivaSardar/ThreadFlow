import React, { useState } from 'react';
import { X, Calendar, AlertTriangle, Loader2, CheckCircle2, Clock, Send } from 'lucide-react';
import { OrderListItem, BulkShiftExFactoryDatePayload } from '../../types';
import { apiRequest } from '../../services/api';
import { useLanguage } from '../../hooks/useLanguage';

interface BulkShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedOrders: OrderListItem[];
}

export const BulkShiftModal: React.FC<BulkShiftModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  selectedOrders,
}) => {
  const { isTa, t } = useLanguage();
  const [shiftMode, setShiftMode] = useState<'DAYS' | 'FIXED_DATE'>('DAYS');
  const [shiftDays, setShiftDays] = useState<number>(5);
  const [newDate, setNewDate] = useState<string>('');
  const [reasonCode, setReasonCode] = useState<string>('FABRIC_DELAY');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedOrders.length === 0) {
      setError('Please select at least one order.');
      return;
    }

    if (!reasonCode) {
      setError('A mandatory reason code is required for audit compliance.');
      return;
    }

    if (shiftMode === 'FIXED_DATE' && !newDate) {
      setError('Please select a valid new ex-factory target date.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: BulkShiftExFactoryDatePayload = {
        orderIds: selectedOrders.map((o) => o.id),
        shiftDays: shiftMode === 'DAYS' ? Number(shiftDays) : undefined,
        newExFactoryDate: shiftMode === 'FIXED_DATE' ? new Date(newDate).toISOString() : undefined,
        reasonCode,
        notes: notes.trim() || undefined,
      };

      await apiRequest('/orders/bulk/ex-factory-date', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to apply bulk ex-factory date shift');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        style={{ colorScheme: 'light' }}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden text-slate-900 max-h-[92vh] sm:max-h-[88vh] flex flex-col animate-in zoom-in-95"
      >
        {/* Header */}
        <div className="bg-[#0C2D48] px-4 sm:px-6 py-3.5 sm:py-4 text-white flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
              <h3 className="text-sm sm:text-base font-bold text-white">
                {isTa ? 'ஒட்டுமொத்த அட்டவணை மாற்றம்' : 'Bulk Ex-Factory Schedule Shift'}
              </h3>
            </div>
            <p className="text-[11px] sm:text-xs text-sky-200/80 mt-0.5">
              {isTa ? 'அட்டவணை மாற்றம் மற்றும் மைல்கல் மறுசீரமைப்பு' : 'Batch delivery date rescheduling and milestone recalculation'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-sky-200 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body (Scrollable) */}
        <form id="bulk-shift-form" onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-left">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Selected Orders Summary Banner */}
          <div className="p-3 sm:p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-800 mb-2">
              <span>{isTa ? 'தேர்ந்தெடுக்கப்பட்ட ஏற்றுமதி ஆர்டர்கள்' : 'Selected Export Orders'} ({selectedOrders.length})</span>
              <span className="text-sky-700 font-mono font-bold">
                {selectedOrders.reduce((sum, o) => sum + o.totalQuantity, 0).toLocaleString()} {t.common.pieces} {isTa ? 'மொத்தம்' : 'total'}
              </span>
            </div>
            <div className="max-h-28 overflow-y-auto divide-y divide-slate-100 text-xs no-scrollbar">
              {selectedOrders.map((o) => (
                <div key={o.id} className="py-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-slate-600">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono font-bold text-slate-900 shrink-0">{o.poNumber}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-700 truncate max-w-[190px] font-medium">{o.style}</span>
                    <span className="text-slate-400 text-[11px] shrink-0">({o.buyer.code})</span>
                  </div>
                  <div className="text-[11px] text-slate-500 shrink-0">
                    {isTa ? 'தற்போது:' : 'Current:'} <span className="font-semibold text-slate-700">{formatDate(o.exFactoryDate)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Shift Method Switcher */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              Schedule Adjustment Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShiftMode('DAYS')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  shiftMode === 'DAYS'
                    ? 'bg-sky-50 border-sky-400 text-sky-800 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Clock className="w-4 h-4 text-sky-600 shrink-0" />
                <span>Shift Forward by Working Days</span>
              </button>

              <button
                type="button"
                onClick={() => setShiftMode('FIXED_DATE')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  shiftMode === 'FIXED_DATE'
                    ? 'bg-sky-50 border-sky-400 text-sky-800 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Calendar className="w-4 h-4 text-sky-600 shrink-0" />
                <span>Set Fixed Target Date</span>
              </button>
            </div>
          </div>

          {/* Shift Configuration */}
          {shiftMode === 'DAYS' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Postpone Working Days (Excluding Sundays)
              </label>
              <div className="grid grid-cols-5 gap-1.5 mb-2">
                {[3, 5, 7, 10, 14].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setShiftDays(d)}
                    className={`py-2 px-1 rounded-lg text-xs font-bold transition text-center cursor-pointer ${
                      shiftDays === d
                        ? 'bg-[#0C2D48] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span className="sm:hidden">+{d}d</span>
                    <span className="hidden sm:inline">+{d} Days</span>
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={1}
                max={90}
                value={shiftDays}
                onChange={(e) => setShiftDays(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-mono font-bold bg-white text-slate-900 shadow-xs"
                placeholder="Or enter custom number of working days"
                required
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                New Target Ex-Factory Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-medium bg-white text-slate-900 shadow-xs"
                required
              />
            </div>
          )}

          {/* Reason Code */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1">
              Reason for Schedule Postponement <span className="text-rose-500">*</span>
            </label>
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-semibold bg-white text-slate-900 shadow-xs"
              required
            >
              <option value="BUYER_REQUEST">Buyer Requested Delivery Postponement</option>
              <option value="FABRIC_DELAY">Fabric / Yarn Supply Delay</option>
              <option value="LABOUR_SHORTAGE">Labour Shortage / Absenteeism</option>
              <option value="MACHINE_BREAKDOWN">Machine Maintenance / Line Breakdown</option>
              <option value="POWER_OUTAGE">Power Outage / Facility Interruption</option>
              <option value="QUALITY_HOLD">Quality Inspection / Shade Approval Hold</option>
              <option value="SUBCONTRACTOR_DELAY">Subcontractor Processing Delay</option>
              <option value="OTHER">Other Operational Reason</option>
            </select>
          </div>

          {/* Explanatory Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1">
              Batch Postponement Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Provide background context for factory management and buyer liaison..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 bg-white text-slate-900 placeholder:text-slate-400 shadow-xs"
            ></textarea>
          </div>

          {/* Compliance & Notification Note */}
          <div className="p-3 bg-sky-50/70 border border-sky-200/80 rounded-xl text-[11px] text-sky-900 flex items-start gap-2.5">
            <Send className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
            <div>
              {isTa
                ? `${selectedOrders.length} ஆர்டர்களின் மைல்கல் அட்டவணைகளை மறுசீரமைத்து, வாங்குபவர்களுக்கு அறிவிக்கிறது.`
                : `Recalibrates milestone schedules across ${selectedOrders.length} orders and notifies buyer accounts.`}
            </div>
          </div>
        </form>

        {/* Sticky Action Footer (Always visible at the bottom) */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 rounded-xl transition cursor-pointer"
          >
            {t.common.cancel}
          </button>
          <button
            type="submit"
            form="bulk-shift-form"
            disabled={isSubmitting || selectedOrders.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 active:scale-95 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{isTa ? `மாற்றத்தைப் பயன்படுத்து (${selectedOrders.length} ஆர்டர்கள்)` : `Apply Shift (${selectedOrders.length} POs)`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
