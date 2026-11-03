import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Buyer, Unit, CreateOrderPayload } from '../../types';
import { apiRequest } from '../../services/api';
import { CustomSelect, Option } from '../../components/CustomSelect';

interface OrderFormProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated: () => void;
  buyers: Buyer[];
  units: Unit[];
}

interface SizeRow {
  size: string;
  color: string;
  plannedQty: number;
}

export const OrderForm: React.FC<OrderFormProps> = ({
  isOpen,
  onClose,
  onOrderCreated,
  buyers,
  units,
}) => {
  const [poNumber, setPoNumber] = useState('');
  const [style, setStyle] = useState('');
  const [description, setDescription] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [totalQuantity, setTotalQuantity] = useState<number>(10000);
  const [exFactoryDate, setExFactoryDate] = useState('2026-12-15');
  const [currency, setCurrency] = useState('INR');
  const [fobPricePerPiece, setFobPricePerPiece] = useState<number>(320);
  const [sizeRows, setSizeRows] = useState<SizeRow[]>([
    { size: 'S', color: 'Navy', plannedQty: 2000 },
    { size: 'M', color: 'Navy', plannedQty: 4000 },
    { size: 'L', color: 'Navy', plannedQty: 3000 },
    { size: 'XL', color: 'Navy', plannedQty: 1000 },
  ]);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Set default buyer and unit when available
  useEffect(() => {
    if (buyers.length > 0 && !buyerId) {
      setBuyerId(buyers[0].id);
    }
    if (units.length > 0 && !unitId) {
      setUnitId(units[0].id);
    }
  }, [buyers, units, buyerId, unitId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sumOfSizes = sizeRows.reduce((acc, row) => acc + (Number(row.plannedQty) || 0), 0);
  const isSumMatched = sumOfSizes === Number(totalQuantity);
  const diff = sumOfSizes - Number(totalQuantity);

  const handleAddRow = () => {
    setSizeRows((prev) => [...prev, { size: 'M', color: 'Navy', plannedQty: 1000 }]);
  };

  const handleRemoveRow = (index: number) => {
    if (sizeRows.length <= 1) return;
    setSizeRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRowChange = (index: number, field: keyof SizeRow, value: any) => {
    setSizeRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: field === 'plannedQty' ? Number(value) || 0 : value };
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!poNumber.trim()) {
      setErrorMessage('PO Number is required');
      return;
    }
    if (!style.trim()) {
      setErrorMessage('Style is required');
      return;
    }
    if (!buyerId) {
      setErrorMessage('Please select a Buyer');
      return;
    }
    if (!unitId) {
      setErrorMessage('Please select a Manufacturing Unit');
      return;
    }
    if (!isSumMatched) {
      setErrorMessage(`Size breakdown total (${sumOfSizes.toLocaleString()} pcs) does not match Total Order Quantity (${Number(totalQuantity).toLocaleString()} pcs)`);
      return;
    }

    try {
      setLoading(true);
      const payload: CreateOrderPayload = {
        poNumber: poNumber.trim().toUpperCase(),
        buyerId,
        unitId,
        style: style.trim(),
        description: description.trim() || undefined,
        totalQuantity: Number(totalQuantity),
        exFactoryDate: new Date(exFactoryDate).toISOString(),
        currency,
        exchangeRate: currency === 'INR' ? 1.0 : currency === 'GBP' ? 108.5 : currency === 'EUR' ? 90.2 : 84.0,
        fobPricePerPiece: Number(fobPricePerPiece),
        sizeBreakdowns: sizeRows.map((r) => ({
          size: r.size.trim().toUpperCase(),
          color: r.color.trim(),
          plannedQty: Number(r.plannedQty),
        })),
      };

      await apiRequest('/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      onOrderCreated();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create export order');
    } finally {
      setLoading(false);
    }
  };

  const buyerOptions: Option[] = buyers.map((b) => ({
    value: b.id,
    label: `${b.name} (${b.code})`,
    sublabel: b.country ? `${b.country} Market` : 'Global Market',
  }));

  const unitOptions: Option[] = units.map((u) => ({
    value: u.id,
    label: u.name,
    badge: u.type === 'SUBCONTRACTOR' ? 'Subcontractor' : 'In-House Facility',
  }));

  const currencyOptions: Option[] = [
    { value: 'INR', label: 'INR (₹)' },
    { value: 'GBP', label: 'GBP (£)' },
    { value: 'EUR', label: 'EUR (€)' },
    { value: 'USD', label: 'USD ($)' },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        style={{ colorScheme: 'light' }}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden text-slate-900"
      >
        {/* Header - Fixed & Pinned */}
        <div className="bg-[#0C2D48] px-5 py-3.5 text-white flex items-center justify-between shrink-0 border-b border-[#143D60]">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">New Export Purchase Order</h2>
            <p className="text-xs text-sky-200/90 font-medium">
              Configure order specifications, size distribution, and production schedule
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-sky-200 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition cursor-pointer"
            aria-label="Close Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body - Scrollable only if needed */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 bg-white text-slate-900 smooth-scroll">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section 1: Order Meta */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                PO Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                placeholder="e.g. B-PO-88290"
                className="w-full px-3 py-1.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 uppercase font-mono bg-white text-slate-900 placeholder:text-slate-400 font-semibold"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Style Code / Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                placeholder="e.g. Mercerized Cotton Rib Polo"
                className="w-full px-3 py-1.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white text-slate-900 placeholder:text-slate-400 font-medium"
                required
              />
            </div>
          </div>

          {/* Section 2: Buyer & Unit with CustomSelect */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Foreign Buyer <span className="text-rose-500">*</span>
              </label>
              <CustomSelect
                value={buyerId}
                options={buyerOptions}
                onChange={(val) => setBuyerId(val)}
                placeholder="Select Foreign Buyer"
                buttonClassName="bg-white border-slate-300 py-1.5 text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Assigned Unit <span className="text-rose-500">*</span>
              </label>
              <CustomSelect
                value={unitId}
                options={unitOptions}
                onChange={(val) => setUnitId(val)}
                placeholder="Select Assigned Unit"
                buttonClassName="bg-white border-slate-300 py-1.5 text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* Section 3: Quantity, Logistics, Pricing */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Total Order Qty (pcs) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                value={totalQuantity}
                onChange={(e) => setTotalQuantity(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 font-mono font-bold bg-white text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Ex-Factory Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={exFactoryDate}
                onChange={(e) => setExFactoryDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 font-medium bg-white text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Currency</label>
              <CustomSelect
                value={currency}
                options={currencyOptions}
                onChange={(val) => setCurrency(val)}
                placeholder="Currency"
                buttonClassName="bg-white border-slate-300 py-1.5 text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">FOB / Piece</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={fobPricePerPiece}
                onChange={(e) => setFobPricePerPiece(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 font-mono font-bold bg-white text-slate-900"
              />
            </div>
          </div>

          {/* Section 4: Size Breakdown Matrix */}
          <div className="border border-slate-200 rounded-xl p-3 sm:p-4 bg-slate-50/70 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Size Breakdown & Color Allocation
                </h4>
                <p className="text-[11px] text-slate-500">
                  Defines planned quantity per ratio to safeguard against size skew traps
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-sky-700 bg-sky-100 hover:bg-sky-200 rounded-lg transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Ratio
              </button>
            </div>

            <div className="space-y-1.5">
              {sizeRows.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2 sm:gap-3">
                  <div className="w-24 sm:w-28">
                    <input
                      type="text"
                      value={row.size}
                      onChange={(e) => handleRowChange(idx, 'size', e.target.value)}
                      placeholder="Size"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg uppercase font-bold text-center bg-white text-slate-900"
                      required
                    />
                  </div>

                  <div className="flex-1">
                    <input
                      type="text"
                      value={row.color}
                      onChange={(e) => handleRowChange(idx, 'color', e.target.value)}
                      placeholder="Color / Shade"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 font-medium"
                      required
                    />
                  </div>

                  <div className="w-32 sm:w-36">
                    <input
                      type="number"
                      min={1}
                      value={row.plannedQty}
                      onChange={(e) => handleRowChange(idx, 'plannedQty', e.target.value)}
                      placeholder="Pieces"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg font-mono font-bold text-right bg-white text-slate-900"
                      required
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveRow(idx)}
                    disabled={sizeRows.length <= 1}
                    className="text-slate-400 hover:text-rose-600 disabled:opacity-30 p-1.5 transition cursor-pointer"
                    title="Remove ratio row"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Live Size Sum Invariant Checker */}
            <div
              className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition ${
                isSumMatched
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-300 text-amber-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {isSumMatched ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span>
                  {isSumMatched
                    ? 'Size quantities match order total.'
                    : `Discrepancy: ${diff > 0 ? `+${diff}` : diff} pcs difference.`}
                </span>
              </div>
              <span className="font-mono font-bold">
                {sumOfSizes.toLocaleString()} / {Number(totalQuantity).toLocaleString()} pcs
              </span>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !isSumMatched}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-[#0C2D48] hover:bg-[#143D60] disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl shadow-md transition cursor-pointer"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Export Order
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
