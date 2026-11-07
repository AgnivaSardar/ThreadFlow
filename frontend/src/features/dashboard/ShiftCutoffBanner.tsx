import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import { useLanguage } from '../../hooks/useLanguage';
import { translateUnit } from '../supervisor/supervisorTranslations';
import {
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Send,
  Check,
  RefreshCw,
  Building2,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

interface MissingOrderSummary {
  orderId: string;
  poNumber: string;
  style: string;
  targetQuantity: number;
  activeStage: string;
}

interface UnitMissingGroup {
  unitId: string;
  unitName: string;
  unitCode: string;
  unitLocation: string | null;
  supervisorId: string | null;
  supervisorName: string;
  supervisorPhone: string;
  missingOrdersCount: number;
  orders: MissingOrderSummary[];
  whatsappUrl: string;
  bilingualMessage: string;
}

interface ShiftCutoffData {
  serverTimeIso: string;
  currentTimeIst: string;
  isPastCutoff: boolean;
  cutoffTimeIst: string;
  missingUnitsCount: number;
  missingOrdersCount: number;
  groups: UnitMissingGroup[];
}

export const ShiftCutoffBanner: React.FC = () => {
  const { lang, isTa, t } = useLanguage();
  const [data, setData] = useState<ShiftCutoffData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSimulated, setIsSimulated] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [sentUnits, setSentUnits] = useState<Record<string, boolean>>({});

  const fetchStatus = async (simulate: boolean = isSimulated) => {
    setIsLoading(true);
    try {
      const res = await apiRequest<{ success: boolean; data: ShiftCutoffData }>(
        `/production/missing-shift-updates?simulate=${simulate}`
      );
      if (res.data) {
        setData(res.data);
      }
    } catch {
      // Fallback gracefully without breaking layout
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => {
      fetchStatus();
    }, 60000);
    return () => clearInterval(interval);
  }, [isSimulated]);

  const handleToggleSimulate = () => {
    const nextState = !isSimulated;
    setIsSimulated(nextState);
    fetchStatus(nextState);
  };

  const handleSendNudge = async (group: UnitMissingGroup) => {
    // 1. Open WhatsApp link with pre-filled bilingual Tamil + English text
    window.open(group.whatsappUrl, '_blank', 'noopener,noreferrer');

    // 2. Mark as sent locally
    setSentUnits((prev) => ({ ...prev, [group.unitId]: true }));

    // 3. Log nudge in backend cryptographic audit chain
    try {
      await apiRequest('/production/log-nudge', {
        method: 'POST',
        body: JSON.stringify({
          unitId: group.unitId,
          supervisorName: group.supervisorName,
          missingOrdersCount: group.missingOrdersCount,
          poNumbers: group.orders.map((o) => o.poNumber),
        }),
      });
    } catch {
      // Non-blocking logging
    }
  };

  // Only render if past 6:00 PM IST or simulated AND there are missing units
  if (!data || (!data.isPastCutoff && !isSimulated) || data.missingUnitsCount === 0) {
    return null;
  }

  return (
    <div className="bg-amber-50/95 border border-amber-300 rounded-xl shadow-xs overflow-hidden text-xs transition-all animate-in fade-in duration-200">
      {/* Compact Main Banner Bar */}
      <div className="px-3 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded-md bg-amber-500 text-white flex items-center justify-center shrink-0">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-slate-900">
              {t.shiftCutoff.alertTitle}
            </span>
            <span className="font-semibold text-amber-900">
              {isTa
                ? `${data.missingUnitsCount} பிரிவுகளில் இன்றைய தினசரி புதுப்பிப்பு விடுபட்டுள்ளது (${data.missingOrdersCount} ஆர்டர்கள்)`
                : `${data.missingUnitsCount} ${data.missingUnitsCount === 1 ? 'Unit' : 'Units'} Missing Today's Daily Update (${data.missingOrdersCount} POs)`}
            </span>
            <span className="text-slate-400 font-mono text-[11px] hidden sm:inline">
              • {data.currentTimeIst}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Quick Demo Simulator Toggle */}
          <button
            type="button"
            onClick={handleToggleSimulate}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer border ${
              isSimulated
                ? 'bg-amber-200 text-amber-950 border-amber-400'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="Toggle 6:00 PM cut-off simulation for testing"
          >
            {isSimulated ? (isTa ? 'மாலை 6 மணி உருவகப்படுத்தப்பட்டது' : 'Simulated 6PM Active') : t.shiftCutoff.simulate6pm}
          </button>

          {/* Refresh button */}
          <button
            type="button"
            onClick={() => fetchStatus()}
            disabled={isLoading}
            className="p-1 rounded text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
            title="Recheck unit updates"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* Expand/Collapse Toggle */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#0C2D48] hover:bg-[#143D60] text-white rounded-lg text-[11px] font-bold transition shadow-2xs cursor-pointer"
          >
            <span>{isExpanded ? t.shiftCutoff.hide : (isTa ? 'பார்வையிடு & நினைவூட்டு' : 'Review & Nudge')}</span>
            {isExpanded ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>

      {/* High-Density Collapsible Unit Nudge Drawer */}
      {isExpanded && (
        <div className="border-t border-amber-200/80 bg-white/70 p-2.5 space-y-2 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.groups.map((group) => {
              const isSent = sentUnits[group.unitId];
              return (
                <div
                  key={group.unitId}
                  className="bg-white p-2.5 rounded-lg border border-amber-200 shadow-2xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 truncate">
                      <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{translateUnit(group.unitName, lang)}</span>
                    </div>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-200 shrink-0">
                      {group.missingOrdersCount} {t.shiftCutoff.posPending}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600 flex items-center justify-between">
                    <span>
                      {t.shiftCutoff.supervisor} <strong className="text-slate-800">{group.supervisorName}</strong>
                    </span>
                    <span className="font-mono text-slate-400 text-[10px]">
                      +{group.supervisorPhone}
                    </span>
                  </div>

                  {/* Pending PO Chips */}
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                    {group.orders.map((o) => (
                      <span
                        key={o.orderId}
                        className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[10px] whitespace-nowrap"
                        title={`${o.style} (${o.activeStage})`}
                      >
                        {o.poNumber}
                      </span>
                    ))}
                  </div>

                  {/* Compact Bilingual Tamil & English WhatsApp Nudge Button */}
                  <button
                    type="button"
                    onClick={() => handleSendNudge(group)}
                    className={`w-full py-1 px-2 rounded-md font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      isSent
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                    }`}
                  >
                    {isSent ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>{isTa ? 'எச்சரிக்கை அனுப்பப்பட்டது' : 'Alert Dispatched'}</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3 h-3" />
                        <span>{t.shiftCutoff.sendWhatsappNudge}</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
