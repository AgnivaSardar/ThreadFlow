import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, CheckCircle, AlertCircle, Loader2, RotateCcw, Calendar, Clock } from 'lucide-react';
import { Buyer, Unit, CreateOrderPayload, Stage } from '../../types';
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

interface StageScheduleRow {
  stage: Stage;
  sequenceOrder: number;
  displayName: string;
  durationDays: number;
  plannedStart: string;
  plannedEnd: string;
}

const DEFAULT_STAGES: { stage: Stage; sequenceOrder: number; displayName: string; defaultDays: number }[] = [
  { stage: 'KNITTING', sequenceOrder: 1, displayName: 'Knitting', defaultDays: 4 },
  { stage: 'DYEING_WASHING', sequenceOrder: 2, displayName: 'Dyeing & Washing', defaultDays: 3 },
  { stage: 'PRINTING', sequenceOrder: 3, displayName: 'Printing & Embroidery', defaultDays: 2 },
  { stage: 'CUTTING', sequenceOrder: 4, displayName: 'Fabric Cutting', defaultDays: 3 },
  { stage: 'STITCHING', sequenceOrder: 5, displayName: 'Assembly & Stitching', defaultDays: 6 },
  { stage: 'CHECKING', sequenceOrder: 6, displayName: 'Quality Checking', defaultDays: 2 },
  { stage: 'FINISHING', sequenceOrder: 7, displayName: 'Finishing & Packing', defaultDays: 2 },
];

function parseDateParts(dateStr: string): { year: number; month: number; day: number } {
  const parts = dateStr.split('-');
  return {
    year: parseInt(parts[0], 10),
    month: parseInt(parts[1], 10) - 1,
    day: parseInt(parts[2], 10),
  };
}

function formatDateParts(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addWorkingDays(startDateStr: string, daysToAdd: number): string {
  if (!startDateStr || daysToAdd <= 0) return startDateStr;
  const { year, month, day } = parseDateParts(startDateStr);
  const d = new Date(year, month, day);
  let count = 0;
  while (count < daysToAdd) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) {
      // Exclude Sunday
      count++;
    }
  }
  return formatDateParts(d);
}

function countWorkingDays(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr) return 0;
  const p1 = parseDateParts(startDateStr);
  const p2 = parseDateParts(endDateStr);
  const start = new Date(p1.year, p1.month, p1.day);
  const end = new Date(p2.year, p2.month, p2.day);
  if (start >= end) return 0;
  const cur = new Date(start);
  let count = 0;
  while (cur < end) {
    cur.setDate(cur.getDate() + 1);
    if (cur.getDay() !== 0) {
      count++;
    }
  }
  return count;
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
  const [orderStartDate, setOrderStartDate] = useState('2026-11-02');
  const [exFactoryDate, setExFactoryDate] = useState('2026-12-15');
  const [currency, setCurrency] = useState('INR');
  const [fobPricePerPiece, setFobPricePerPiece] = useState<number>(320);

  const [stageRows, setStageRows] = useState<StageScheduleRow[]>(() => {
    let cur = '2026-11-02';
    return DEFAULT_STAGES.map((s) => {
      const start = cur;
      const end = addWorkingDays(start, s.defaultDays);
      cur = end;
      return {
        stage: s.stage,
        sequenceOrder: s.sequenceOrder,
        displayName: s.displayName,
        durationDays: s.defaultDays,
        plannedStart: start,
        plannedEnd: end,
      };
    });
  });

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

  // Calculations for Stage Lead Times
  const totalStageDays = stageRows.reduce((acc, r) => acc + r.durationDays, 0);
  const availableWindowDays = countWorkingDays(orderStartDate, exFactoryDate);
  const finalStageEnd = stageRows[stageRows.length - 1]?.plannedEnd || exFactoryDate;
  const isTimelineOverrun = finalStageEnd > exFactoryDate;
  const finalBufferDays = isTimelineOverrun
    ? -countWorkingDays(exFactoryDate, finalStageEnd)
    : countWorkingDays(finalStageEnd, exFactoryDate);

  // Handlers for Stage Pipeline adjustments
  const handleOrderStartDateChange = (newStart: string) => {
    setOrderStartDate(newStart);
    if (!newStart) return;
    setStageRows((prev) => {
      let cur = newStart;
      return prev.map((row) => {
        const start = cur;
        const end = addWorkingDays(start, row.durationDays);
        cur = end;
        return {
          ...row,
          plannedStart: start,
          plannedEnd: end,
        };
      });
    });
  };

  const handleStageDaysChange = (index: number, days: number) => {
    const safeDays = Math.max(1, Number(days) || 1);
    setStageRows((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        durationDays: safeDays,
        plannedEnd: addWorkingDays(next[index].plannedStart, safeDays),
      };
      // Auto cascade downstream stages forward sequentially
      for (let j = index + 1; j < next.length; j++) {
        const prevEnd = next[j - 1].plannedEnd;
        next[j] = {
          ...next[j],
          plannedStart: prevEnd,
          plannedEnd: addWorkingDays(prevEnd, next[j].durationDays),
        };
      }
      return next;
    });
  };

  const handleStageStartChange = (index: number, newStart: string) => {
    if (!newStart) return;
    setStageRows((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        plannedStart: newStart,
        plannedEnd: addWorkingDays(newStart, next[index].durationDays),
      };
      // Cascade downstream
      for (let j = index + 1; j < next.length; j++) {
        const prevEnd = next[j - 1].plannedEnd;
        next[j] = {
          ...next[j],
          plannedStart: prevEnd,
          plannedEnd: addWorkingDays(prevEnd, next[j].durationDays),
        };
      }
      return next;
    });
  };

  const handleStageEndChange = (index: number, newEnd: string) => {
    if (!newEnd) return;
    setStageRows((prev) => {
      const next = [...prev];
      const computedDays = Math.max(1, countWorkingDays(next[index].plannedStart, newEnd));
      next[index] = {
        ...next[index],
        durationDays: computedDays,
        plannedEnd: newEnd,
      };
      // Cascade downstream
      for (let j = index + 1; j < next.length; j++) {
        const prevEnd = next[j - 1].plannedEnd;
        next[j] = {
          ...next[j],
          plannedStart: prevEnd,
          plannedEnd: addWorkingDays(prevEnd, next[j].durationDays),
        };
      }
      return next;
    });
  };

  const handleResetStages = () => {
    let cur = orderStartDate || '2026-11-02';
    setStageRows(
      DEFAULT_STAGES.map((s) => {
        const start = cur;
        const end = addWorkingDays(start, s.defaultDays);
        cur = end;
        return {
          stage: s.stage,
          sequenceOrder: s.sequenceOrder,
          displayName: s.displayName,
          durationDays: s.defaultDays,
          plannedStart: start,
          plannedEnd: end,
        };
      })
    );
  };

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
      setErrorMessage(
        `Size breakdown total (${sumOfSizes.toLocaleString()} pcs) does not match Total Order Quantity (${Number(
          totalQuantity
        ).toLocaleString()} pcs)`
      );
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
        orderDate: new Date(orderStartDate).toISOString(),
        exFactoryDate: new Date(exFactoryDate).toISOString(),
        currency,
        exchangeRate: currency === 'INR' ? 1.0 : currency === 'GBP' ? 108.5 : currency === 'EUR' ? 90.2 : 84.0,
        fobPricePerPiece: Number(fobPricePerPiece),
        sizeBreakdowns: sizeRows.map((r) => ({
          size: r.size.trim().toUpperCase(),
          color: r.color.trim(),
          plannedQty: Number(r.plannedQty),
        })),
        customStages: stageRows.map((s) => ({
          stage: s.stage,
          sequenceOrder: s.sequenceOrder,
          displayName: s.displayName,
          durationDays: s.durationDays,
          plannedStart: new Date(s.plannedStart).toISOString(),
          plannedEnd: new Date(s.plannedEnd).toISOString(),
          bufferDaysAhead: Math.max(0, countWorkingDays(s.plannedEnd, exFactoryDate)),
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
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-900"
      >
        {/* Header - Fixed & Pinned */}
        <div className="bg-[#0C2D48] px-5 py-3.5 text-white flex items-center justify-between shrink-0 border-b border-[#143D60]">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">New Export Purchase Order</h2>
            <p className="text-xs text-sky-200/90 font-medium">
              Configure order specifications, 7-stage T&A timeline, and size distribution
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

        {/* Form Body - Scrollable */}
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

          {/* Section 3: Quantity, Timeline Limits & Pricing */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Total Qty (pcs) <span className="text-rose-500">*</span>
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
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-sky-600" />
                <span>Start Date</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={orderStartDate}
                onChange={(e) => handleOrderStartDateChange(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 font-medium bg-white text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Ex-Factory</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={exFactoryDate}
                onChange={(e) => setExFactoryDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 font-medium bg-white text-slate-900"
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

          {/* Section 4: Flexible Stage Durations & Lead Times (T&A Timeline) */}
          <div className="border border-slate-200 rounded-xl p-3 sm:p-4 bg-slate-50/70 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    7-Stage Production Timeline & Stage Durations
                  </h4>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-sky-100 text-sky-800 border border-sky-200">
                    Flexible T&A
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Input working days or start/end dates for each stage. Downstream stages auto-cascade forward (Sundays excluded).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs">
                  Total: <strong className="text-sky-700">{totalStageDays} Working Days</strong>
                </span>
                <button
                  type="button"
                  onClick={handleResetStages}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer shadow-2xs"
                  title="Reset to standard stage durations"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="text-[11px]">Reset Standard</span>
                </button>
              </div>
            </div>

            {/* Clean, Uncluttered Stage Matrix */}
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-2xs">
              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-100/70 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                <div className="col-span-4 sm:col-span-4">Stage Name</div>
                <div className="col-span-2 sm:col-span-2 text-center">Days</div>
                <div className="col-span-3 sm:col-span-3">Start Date</div>
                <div className="col-span-3 sm:col-span-3">End Date</div>
              </div>

              {stageRows.map((row, idx) => (
                <div key={row.stage} className="grid grid-cols-12 gap-2 px-3 py-1.5 items-center hover:bg-slate-50/70 transition">
                  <div className="col-span-4 sm:col-span-4 flex items-center gap-1.5 min-w-0">
                    <span className="w-4 h-4 rounded-full bg-sky-100 text-sky-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-slate-800 truncate" title={row.displayName}>
                      {row.displayName}
                    </span>
                  </div>

                  <div className="col-span-2 sm:col-span-2 flex items-center justify-center">
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        min={1}
                        max={90}
                        value={row.durationDays}
                        onChange={(e) => handleStageDaysChange(idx, Number(e.target.value))}
                        className="w-14 px-1.5 py-1 text-xs border border-slate-200 rounded-lg text-center font-mono font-bold bg-white focus:ring-1 focus:ring-sky-500 text-slate-900"
                        title={`${row.displayName} duration in working days`}
                      />
                      <span className="ml-1 text-[11px] text-slate-400 font-medium">d</span>
                    </div>
                  </div>

                  <div className="col-span-3 sm:col-span-3">
                    <input
                      type="date"
                      value={row.plannedStart}
                      onChange={(e) => handleStageStartChange(idx, e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white font-medium text-slate-800 focus:ring-1 focus:ring-sky-500"
                    />
                  </div>

                  <div className="col-span-3 sm:col-span-3">
                    <input
                      type="date"
                      value={row.plannedEnd}
                      onChange={(e) => handleStageEndChange(idx, e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white font-medium text-slate-800 focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Stage Pipeline Buffer Indicator */}
            <div
              className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-between transition ${
                finalBufferDays >= 0
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {finalBufferDays >= 0 ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>
                  {finalBufferDays >= 0
                    ? `Production finishes on ${stageRows[6]?.plannedEnd} with ${finalBufferDays} working days buffer before Ex-Factory.`
                    : `Schedule overrun: Finishing completes on ${stageRows[6]?.plannedEnd}, exceeding Ex-Factory by ${Math.abs(
                        finalBufferDays
                      )} working days.`}
                </span>
              </div>
              <span className="font-mono font-bold text-[11px] shrink-0">
                {totalStageDays}d required / {availableWindowDays}d window
              </span>
            </div>
          </div>

          {/* Section 5: Size Breakdown Matrix */}
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
