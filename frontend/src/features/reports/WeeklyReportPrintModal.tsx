import React from 'react';
import { BuyerProfile, BuyerExportOrder } from './exportService';
import { Printer, X, Download, ShieldCheck, CheckCircle2, Building2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  buyer: BuyerProfile;
  orders: BuyerExportOrder[];
}

export const WeeklyReportPrintModal: React.FC<Props> = ({
  isOpen,
  onClose,
  buyer,
  orders,
}) => {
  if (!isOpen) return null;

  const totalContractedPcs = orders.reduce((sum, o) => sum + o.totalQuantity, 0);
  const completedOrders = orders.filter((o) => o.progressPercent >= 100).length;
  const activeOrders = orders.length - completedOrders;

  const todayStr = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
      {/* Modal Container */}
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden print:m-0 print:p-0 print:max-w-none print:max-h-none print:shadow-none print:rounded-none">
        {/* Screen Toolbar (Hidden during Print) */}
        <div className="p-3 bg-slate-900 text-white flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-xs sm:text-sm">
              Official Weekly Buyer Status Report — {buyer.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save as PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6 text-slate-900 font-sans print:p-0 print:space-y-4">
          {/* 1. Formal Letterhead */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
            <div>
              <div className="text-xl font-black tracking-tight text-slate-950 uppercase">
                Company A Manufacturing Units
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                Cotton Knitwear Export Hub • Tiruppur 641602, Tamil Nadu, India
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-1">
                <span>ISO 9001:2015 Certified</span>
                <span>•</span>
                <span>Sedex SMETA 4-Pillar Audited Facility</span>
                <span>•</span>
                <span>OEKO-TEX Standard 100</span>
              </div>
            </div>

            <div className="text-right">
              <span className="inline-block px-2.5 py-1 rounded bg-slate-100 border border-slate-300 font-mono font-bold text-xs text-slate-900">
                WEEKLY STATUS REPORT
              </span>
              <div className="text-xs text-slate-500 font-medium mt-1">
                Generated: {todayStr}
              </div>
            </div>
          </div>

          {/* 2. Client & Facility Snapshot */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Foreign Buyer</div>
              <div className="font-bold text-slate-900 mt-0.5">{buyer.name}</div>
              <div className="text-slate-500 text-[11px]">{buyer.country || 'Europe'}</div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contracted Pieces</div>
              <div className="font-bold text-slate-900 mt-0.5 font-mono text-sm">
                {totalContractedPcs.toLocaleString()} pcs
              </div>
              <div className="text-slate-500 text-[11px]">{orders.length} Active Export POs</div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Production Status</div>
              <div className="font-bold text-emerald-800 mt-0.5">
                {activeOrders} In-Progress • {completedOrders} Completed
              </div>
              <div className="text-slate-500 text-[11px]">Milestones Monitored Daily</div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Facility Hub</div>
              <div className="font-bold text-slate-900 mt-0.5">
                {orders[0]?.unit.name || 'Unit 1 (Cotton Hub)'}
              </div>
              <div className="text-slate-500 text-[11px]">Tiruppur Line Direct</div>
            </div>
          </div>

          {/* 3. High-Density PO Milestones Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
              Active Export Purchase Orders & TNA Milestones
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-300">
                <thead className="bg-[#0C2D48] text-white font-bold uppercase text-[10px] tracking-wider border-b border-[#143D60]">
                  <tr>
                    <th className="py-2.5 px-2.5 text-slate-100 border-r border-[#143D60]">PO Number</th>
                    <th className="py-2.5 px-2.5 text-slate-100 border-r border-[#143D60]">Style</th>
                    <th className="py-2.5 px-2 text-right text-slate-100 border-r border-[#143D60]">Quantity</th>
                    <th className="py-2.5 px-2 text-slate-100 border-r border-[#143D60]">Ex-Factory</th>
                    <th className="py-2.5 px-2 text-slate-100 border-r border-[#143D60]">Active Stage</th>
                    <th className="py-2.5 px-2 text-center text-slate-100 border-r border-[#143D60]">Progress</th>
                    <th className="py-2.5 px-3 text-slate-100">Confirmed Delivery Directives</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {orders.map((o) => (
                    <tr key={o.id} className="even:bg-slate-50 odd:bg-white hover:bg-sky-50/50">
                      <td className="py-2 px-2.5 font-mono font-bold text-slate-900 border-r border-slate-300">
                        {o.poNumber}
                      </td>
                      <td className="py-2 px-2.5 font-medium text-slate-800 border-r border-slate-300">
                        {o.style}
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-bold text-slate-900 border-r border-slate-300">
                        {o.totalQuantity.toLocaleString()}
                      </td>
                      <td className="py-2 px-2 whitespace-nowrap text-slate-700 border-r border-slate-300">
                        {new Date(o.exFactoryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        <span className="text-[10px] text-slate-500 block">
                          ({o.daysToExFactory}d left)
                        </span>
                      </td>
                      <td className="py-2 px-2 font-semibold text-slate-800 border-r border-slate-300 capitalize">
                        {o.activeStage.replace(/_/g, ' ')}
                      </td>
                      <td className="py-2 px-2 text-center font-mono font-bold border-r border-slate-300">
                        {o.progressPercent}%
                      </td>
                      <td className="py-2 px-3 text-[11px] text-slate-700 leading-relaxed">
                        {o.confirmedAlerts.map((a) => a.mitigationPlan).filter(Boolean).join(' • ') ||
                          o.latestDailyLog?.notes ||
                          'Floor schedule on-track for vessel cut-off.'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. Executive Sign-Off Block */}
          <div className="pt-6 border-t-2 border-slate-800 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Executive Review & Quality Verification Sign-Off
            </div>

            <div className="grid grid-cols-3 gap-6 pt-4 text-xs">
              <div className="space-y-8">
                <div className="border-b border-slate-400 pb-1 text-slate-400 italic text-[11px]">
                  Sign & Date
                </div>
                <div>
                  <div className="font-bold text-slate-900">Factory General Manager</div>
                  <div className="text-[11px] text-slate-500">Manufacturing Operations</div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="border-b border-slate-400 pb-1 text-slate-400 italic text-[11px]">
                  Sign & Date
                </div>
                <div>
                  <div className="font-bold text-slate-900">Lead Merchandiser</div>
                  <div className="text-[11px] text-slate-500">TNA Planning & Buyer Dispatch</div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="border-b border-slate-400 pb-1 text-slate-400 italic text-[11px]">
                  Sign & Date
                </div>
                <div>
                  <div className="font-bold text-slate-900">Quality Assurance Head</div>
                  <div className="text-[11px] text-slate-500">Sedex SMETA Compliance</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
