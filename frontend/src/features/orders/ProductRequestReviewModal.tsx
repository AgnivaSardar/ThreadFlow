import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Sparkles,
  Building2,
  Calendar,
  Layers,
  DollarSign,
  FileText,
  Palette,
  ArrowRight,
  XCircle,
  CheckCircle2,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { BuyerProductRequest } from '../../types';
import { apiRequest } from '../../services/api';

interface ProductRequestReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: BuyerProductRequest | null;
  onGoForward: (request: BuyerProductRequest) => void;
  onRequestStatusUpdated?: () => void;
}

export const ProductRequestReviewModal: React.FC<ProductRequestReviewModalProps> = ({
  isOpen,
  onClose,
  request,
  onGoForward,
  onRequestStatusUpdated,
}) => {
  const [loadingAction, setLoadingAction] = useState<'accept' | 'decline' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!isOpen || !request) return null;

  let parsedSizes: { size: string; color: string; plannedQty: number }[] = [];
  try {
    if (request.sizeBreakdown) {
      parsedSizes = JSON.parse(request.sizeBreakdown);
    }
  } catch {
    parsedSizes = [];
  }

  const handleDecline = async () => {
    try {
      setLoadingAction('decline');
      setActionError(null);
      await apiRequest(`/orders/product-requests/${request.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'DECLINED' }),
      });
      if (onRequestStatusUpdated) onRequestStatusUpdated();
      onClose();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update request status.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleProceed = () => {
    onGoForward(request);
    onClose();
  };

  const formattedDate = new Date(request.targetExFactoryDate).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn font-sans">
      <div className="bg-white w-full max-w-2xl rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-slate-950 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center font-black shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold tracking-tight text-white">
                  Buyer Product Sourcing Request
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-white text-amber-900 uppercase tracking-wider shadow-2xs">
                  IMPORTANT
                </span>
              </div>
              <p className="text-[11px] text-amber-100 font-medium">
                Submitted by {request.buyer?.name || 'Buyer Partner'} ({request.buyer?.country || 'International'})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-amber-100 hover:text-white hover:bg-black/10 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {actionError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Style / Ref
              </span>
              <span className="text-xs font-black text-slate-900 truncate block mt-0.5" title={request.styleName}>
                {request.styleName}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Target Quantity
              </span>
              <span className="text-xs font-black text-sky-700 block mt-0.5">
                {request.targetQuantity.toLocaleString()} pcs
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Target Ex-Factory
              </span>
              <span className="text-xs font-black text-slate-800 block mt-0.5">
                {formattedDate}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Target FOB Price
              </span>
              <span className="text-xs font-black text-emerald-700 block mt-0.5 font-mono">
                {request.targetPrice
                  ? `${request.currency} ${request.targetPrice.toFixed(2)}`
                  : 'Open Negotiation'}
              </span>
            </div>
          </div>

          {/* Sourcing Specifications Card */}
          <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-sky-600" />
              Garment Specifications & Fabric Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Primary Color</span>
                <span className="text-xs font-semibold text-slate-800 mt-0.5 block">
                  {request.color || 'Standard Navy / Black'}
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Fabric & GSM</span>
                <span className="text-xs font-semibold text-slate-800 mt-0.5 block">
                  {request.fabricSpecs || 'Not specified'}
                </span>
              </div>
            </div>

            {request.description && (
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase mb-1">
                  Garment Construction & Details
                </span>
                <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100 leading-relaxed">
                  {request.description}
                </p>
              </div>
            )}

            {request.specialNotes && (
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase mb-1">
                  Packaging, Labeling & Compliance Notes
                </span>
                <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100 leading-relaxed">
                  {request.specialNotes}
                </p>
              </div>
            )}
          </div>

          {/* Size Breakdown Table */}
          {parsedSizes.length > 0 && (
            <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                Target Size Breakdown ({parsedSizes.length} variants)
              </span>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase">
                      <th className="py-1.5 px-2">Size</th>
                      <th className="py-1.5 px-2">Color</th>
                      <th className="py-1.5 px-2 text-right">Planned Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {parsedSizes.map((s, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-1.5 px-2 font-bold text-slate-900">{s.size}</td>
                        <td className="py-1.5 px-2">{s.color}</td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900">
                          {Number(s.plannedQty).toLocaleString()} pcs
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Info pill about going forward */}
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-sky-900 text-xs flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <p className="leading-snug">
              Choosing <strong>“Go Forward & Create Order”</strong> will pre-fill the official Order creation form with the buyer's requested style, specs, and quantities. You only need to assign the manufacturing unit, sewing line, and final PO number.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDecline}
              disabled={loadingAction !== null}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              {loadingAction === 'decline' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <XCircle className="w-3.5 h-3.5" />
              )}
              <span>Decline Request</span>
            </button>

            <button
              type="button"
              onClick={handleProceed}
              disabled={loadingAction !== null}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Go Forward & Create Order</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
