import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Plus,
  Trash2,
  Sparkles,
  Send,
  Loader2,
  Calendar,
  Layers,
  FileText,
  DollarSign,
  Palette,
  CheckCircle2,
} from 'lucide-react';
import { apiRequest, getAuthoritativeServerDate } from '../../services/api';
import { useLanguage } from '../../hooks/useLanguage';

interface BuyerProductRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestSubmitted: () => void;
  buyerName?: string;
}

interface SizeRow {
  size: string;
  color: string;
  plannedQty: number;
}

export const BuyerProductRequestModal: React.FC<BuyerProductRequestModalProps> = ({
  isOpen,
  onClose,
  onRequestSubmitted,
  buyerName,
}) => {
  const { isTa } = useLanguage();
  const today = getAuthoritativeServerDate();
  const defaultExDate = new Date(today);
  defaultExDate.setDate(defaultExDate.getDate() + 45);
  const defaultExStr = defaultExDate.toISOString().split('T')[0];

  const [styleName, setStyleName] = useState('');
  const [description, setDescription] = useState('');
  const [targetQuantity, setTargetQuantity] = useState<number>(5000);
  const [targetExFactoryDate, setTargetExFactoryDate] = useState(defaultExStr);
  const [currency, setCurrency] = useState('USD');
  const [targetPrice, setTargetPrice] = useState<number | ''>(6.5);
  const [color, setColor] = useState('Vintage Black');
  const [fabricSpecs, setFabricSpecs] = useState('100% Combed Cotton Single Jersey, 200-220 GSM');
  const [specialNotes, setSpecialNotes] = useState('Pre-shrunk, bio-washed, folded in individual eco-polybags.');

  const [sizeRows, setSizeRows] = useState<SizeRow[]>([
    { size: 'S', color: 'Vintage Black', plannedQty: 1000 },
    { size: 'M', color: 'Vintage Black', plannedQty: 2000 },
    { size: 'L', color: 'Vintage Black', plannedQty: 1500 },
    { size: 'XL', color: 'Vintage Black', plannedQty: 500 },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState(false);

  if (!isOpen) return null;

  const sizeSum = sizeRows.reduce((acc, r) => acc + (Number(r.plannedQty) || 0), 0);

  const handleAddSizeRow = () => {
    setSizeRows((prev) => [...prev, { size: 'M', color: color || 'Standard', plannedQty: 500 }]);
  };

  const handleRemoveSizeRow = (index: number) => {
    if (sizeRows.length <= 1) return;
    setSizeRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSizeChange = (index: number, field: keyof SizeRow, val: any) => {
    setSizeRows((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        [field]: field === 'plannedQty' ? Number(val) || 0 : val,
      };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!styleName.trim()) {
      setErrorMessage('Style Name / Product Ref is required');
      return;
    }
    if (!targetQuantity || targetQuantity <= 0) {
      setErrorMessage('Target quantity must be greater than zero');
      return;
    }
    if (!targetExFactoryDate) {
      setErrorMessage('Target Ex-Factory date is required');
      return;
    }

    try {
      setSubmitting(true);
      await apiRequest('/orders/product-requests', {
        method: 'POST',
        body: JSON.stringify({
          styleName: styleName.trim(),
          description: description.trim() || undefined,
          targetQuantity: Number(targetQuantity),
          targetExFactoryDate: new Date(targetExFactoryDate).toISOString(),
          currency,
          targetPrice: targetPrice !== '' ? Number(targetPrice) : undefined,
          color: color.trim() || undefined,
          fabricSpecs: fabricSpecs.trim() || undefined,
          specialNotes: specialNotes.trim() || undefined,
          sizeBreakdown: sizeRows.map((r) => ({
            size: r.size.trim().toUpperCase(),
            color: r.color.trim(),
            plannedQty: Number(r.plannedQty) || 0,
          })),
        }),
      });

      setSuccessToast(true);
      setTimeout(() => {
        setSuccessToast(false);
        onRequestSubmitted();
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit product sourcing request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn font-sans">
      <div className="bg-white w-full max-w-2xl rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#0C2D48] to-[#164368] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight">
                {isTa ? 'புதிய தயாரிப்பு கோரிக்கை' : 'New Product Sourcing Request'}
              </h2>
              <p className="text-[11px] text-sky-200/80">
                {buyerName ? `Submitting on behalf of ${buyerName}` : 'Submit specifications directly to factory merchandisers'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-sky-200 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {successToast && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-semibold animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Sourcing request submitted! Notified factory merchandiser & admin teams.</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
              {errorMessage}
            </div>
          )}

          {/* Row 1: Style Name & Primary Color */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Style / Garment Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={styleName}
                onChange={(e) => setStyleName(e.target.value)}
                placeholder="e.g. Heavyweight Boxy Tee"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Palette className="w-3.5 h-3.5 text-slate-400" />
                Primary Color / Shade
              </label>
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="e.g. Vintage Black, Washed Sage"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:bg-white transition"
              />
            </div>
          </div>

          {/* Row 2: Target Qty, Target Ex-Factory, Currency & Target Price */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                Target Qty (pcs) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                min={1}
                value={targetQuantity}
                onChange={(e) => setTargetQuantity(Math.max(1, parseInt(e.target.value, 10) || 0))}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:bg-white font-mono transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Ex-Factory Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={targetExFactoryDate}
                onChange={(e) => setTargetExFactoryDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:bg-white transition cursor-pointer"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="INR">INR (₹)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                Target FOB Price
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="6.50"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:bg-white font-mono transition"
              />
            </div>
          </div>

          {/* Row 3: Fabric Specifications */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Fabric & GSM Specifications
            </label>
            <input
              type="text"
              value={fabricSpecs}
              onChange={(e) => setFabricSpecs(e.target.value)}
              placeholder="e.g. 100% Combed Cotton, 240 GSM French Terry"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:bg-white transition"
            />
          </div>

          {/* Row 4: Description & Special Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Garment Construction / Description</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ribbed collar, twin needle stitching, pre-shrunk..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:bg-white transition resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Special Packaging & Compliance Notes</label>
              <textarea
                rows={2}
                value={specialNotes}
                onChange={(e) => setSpecialNotes(e.target.value)}
                placeholder="Recycled polybags, barcoded hangtags, SMETA audit requirement..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:bg-white transition resize-none"
              />
            </div>
          </div>

          {/* Row 5: Size Breakdown Table */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Target Size Breakdown
                </span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  sizeSum === targetQuantity
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  Sum: {sizeSum.toLocaleString()} / {targetQuantity.toLocaleString()} pcs
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddSizeRow}
                className="text-xs font-semibold text-sky-700 hover:text-sky-900 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Size
              </button>
            </div>

            <div className="space-y-1.5 max-h-36 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200">
              {sizeRows.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={row.size}
                    onChange={(e) => handleSizeChange(idx, 'size', e.target.value)}
                    placeholder="Size"
                    className="w-20 px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 text-center font-bold"
                  />
                  <input
                    type="text"
                    value={row.color}
                    onChange={(e) => handleSizeChange(idx, 'color', e.target.value)}
                    placeholder="Color"
                    className="flex-1 px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
                  />
                  <input
                    type="number"
                    min={0}
                    value={row.plannedQty}
                    onChange={(e) => handleSizeChange(idx, 'plannedQty', e.target.value)}
                    placeholder="Qty"
                    className="w-24 px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 text-right font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveSizeRow(idx)}
                    disabled={sizeRows.length <= 1}
                    className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500">
            Request will trigger an urgent notification for Merchandiser & Admin teams
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || successToast}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-sky-700 to-sky-800 hover:from-sky-800 hover:to-sky-900 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Sourcing Request</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
