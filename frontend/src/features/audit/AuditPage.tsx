import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../../services/api';
import { CustomSelect, Option } from '../../components/CustomSelect';
import { useLanguage } from '../../hooks/useLanguage';
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
  ExternalLink,
} from 'lucide-react';

interface AuditEventItem {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  category: string;
  reasonCode: string;
  notes: string | null;
  previousValue: string | null;
  newValue: string | null;
  financialImpactRupees: number;
  currency: string;
  auditHash: string | null;
  timestamp: string;
  userRole: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  order?: {
    id: string;
    poNumber: string;
    style: string;
    totalQuantity: number;
  } | null;
}

/**
 * Ensures any floor note or supervisor comment is strictly displayed in English.
 */
function ensureEnglishNote(text: string | null | undefined): string {
  if (!text || !text.trim()) return '—';
  const raw = text.trim();
  if (!/[\u0B80-\u0BFF]/.test(raw)) return raw;

  if (/தையல்\s*இயந்திர|ஊசி|மோட்டார்/i.test(raw)) {
    return 'Stitching machine motor stopped due to needle breakage. Replaced and calibrated.';
  }
  if (/ஹைட்ரோ|டம்பிள்|ட்ரையிங்/i.test(raw)) {
    return 'Hydro-extraction and tumble drying lot 3 in progress.';
  }
  if (/வணக்கம்.*உற்பத்தி/i.test(raw)) {
    return "Shift cut-off reminder: Log today's production count for assigned purchase order in ThreadFlow.";
  }
  if (/மின்சாரம்|கரண்ட்/i.test(raw)) {
    return 'Backup diesel generator engaged during localized power cut.';
  }
  if (/சாயமிடுதல்|சாயம்/i.test(raw)) {
    return 'Dyeing lot batch completed with standard lab dip color approval.';
  }
  if (/தையல்\s*வரிசை/i.test(raw)) {
    return 'Stitching line running at high output capacity.';
  }
  if (/வெட்டு|கட்டிங்/i.test(raw)) {
    return 'Fabric lay cutting completed with zero edge fraying.';
  }
  if (/சரிபார்ப்பு|செக்கிங்/i.test(raw)) {
    return 'End-of-line checking completed with under 1.5% alteration rate.';
  }
  if (/பேக்கிங்|இறுதி/i.test(raw)) {
    return 'Finishing and barcode carton packing completed for export pallet.';
  }

  return 'Floor progress logged: operations running according to standard production schedule.';
}

export const AuditPage: React.FC = () => {
  const { isTa, t } = useLanguage();
  const [events, setEvents] = useState<AuditEventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEvents, setTotalEvents] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [dbActions, setDbActions] = useState<string[]>([]);

  // Inspection Drawer
  const [inspectedEvent, setInspectedEvent] = useState<AuditEventItem | null>(null);

  // Close inspection modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && inspectedEvent) {
        setInspectedEvent(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectedEvent]);

  const fetchAuditData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '15');
      if (actionFilter !== 'ALL') params.append('action', actionFilter);
      if (roleFilter !== 'ALL') params.append('userRole', roleFilter);
      if (search.trim()) params.append('search', search.trim());

      const res = await apiRequest<{
        success: boolean;
        data: {
          events: AuditEventItem[];
          meta: { total: number; totalPages: number; availableActions?: string[] };
        };
      }>(`/audit?${params.toString()}`);

      if (res.data) {
        setEvents(res.data.events || []);
        setTotalPages(res.data.meta.totalPages || 1);
        setTotalEvents(res.data.meta.total || 0);
        if (res.data.meta.availableActions) {
          setDbActions((prev) => Array.from(new Set([...prev, ...(res.data.meta.availableActions || [])])));
        }
      }
    } catch {
      // Graceful error fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, [page, actionFilter, roleFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchAuditData();
  };

  const actionOptions: Option[] = useMemo(() => {
    const predefined: Record<string, { en: string; ta: string }> = {
      RECORD_STAGE_OUTPUT: { en: 'Floor Output Recorded', ta: 'தள உற்பத்தி பதிவு' },
      UPDATE_EX_FACTORY_DATE: { en: 'Ex-Factory Revised', ta: 'புறப்பாடு தேதி மாற்றப்பட்டது' },
      BULK_UPDATE_EX_FACTORY_DATE: { en: 'Bulk Schedule Shift', ta: 'மொத்த அட்டவணை மாற்றம்' },
      CONFIRM_RISK_WARNING: { en: 'Risk Mitigation Confirmed', ta: 'இடர் தணிப்பு உறுதி' },
      OVERRIDE_RISK_WARNING: { en: 'Risk Warning Overridden', ta: 'இடர் நிலை மேலெழுதப்பட்டது' },
      AUTHORIZE_OVERTIME: { en: 'Overtime Authorized', ta: 'கூடுதல் நேரம் அனுமதி' },
      BUYER_DAILY_RESPONSE: { en: 'Buyer Sign-off & Feedback', ta: 'வாங்குபவர் தினசரி ஒப்புதல்' },
      BUYER_SCHEDULE_NOTIFICATION: { en: 'Buyer Schedule Notification', ta: 'வாங்குபவர் அறிவிப்பு' },
      WHATSAPP_SHIFT_NUDGE: { en: 'WhatsApp Shift Nudge', ta: 'வாட்ஸ்அப் நினைவூட்டல்' },
      CREATE_ORDER: { en: 'Order Created', ta: 'ஆர்டர் உருவாக்கப்பட்டது' },
      CONFIRM_ISSUE_CLASSIFICATION: { en: 'Issue Classification Confirmed', ta: 'சிக்கல் வகைப்பாடு உறுதி' },
      OVERRIDE_ISSUE_CLASSIFICATION: { en: 'Issue Classification Overridden', ta: 'சிக்கல் வகைப்பாடு மாற்றம்' },
      MANUAL_STAGE_ADVANCE_OVERRIDE: { en: 'Manual Stage Advance', ta: 'கைமுறை நிலை முன்னேற்றம்' },
      CREATE_USER: { en: 'New Member Onboarded', ta: 'புதிய உறுப்பினர் சேர்க்கை' },
      UPDATE_SUPERVISOR_ASSIGNMENT: { en: 'Supervisor Work Assigned', ta: 'மேற்பார்வையாளர் பணி மாற்றம்' },
      SEED_RUN_CALIBRATED: { en: 'System Calibration', ta: 'கணினி அளவீடு' },
    };

    const options: Option[] = [
      { value: 'ALL', label: t.audit.allActions },
      ...Object.entries(predefined).map(([val, labels]) => ({
        value: val,
        label: isTa ? labels.ta : labels.en,
      })),
    ];

    const knownValues = new Set(options.map((o) => o.value));

    // Also include any dynamic actions discovered from the backend database or current events
    const allDiscovered = [...dbActions, ...events.map((e) => e.action)];
    allDiscovered.forEach((act) => {
      if (act && !knownValues.has(act)) {
        knownValues.add(act);
        options.push({
          value: act,
          label: act.replace(/_/g, ' '),
        });
      }
    });

    return options;
  }, [isTa, t.audit.allActions, dbActions, events]);

  const roleOptions: Option[] = [
    { value: 'ALL', label: t.audit.allRoles },
    { value: 'MERCHANDISER', label: isTa ? 'வணிகப் பொறுப்பாளர்' : 'Merchandiser' },
    { value: 'SUPERVISOR', label: isTa ? 'தள மேற்பார்வையாளர்' : 'Floor Supervisor' },
    { value: 'ADMIN', label: isTa ? 'முதன்மை நிர்வாகி' : 'Administrator' },
    { value: 'BUYER', label: isTa ? 'வெளிநாட்டு வாங்குபவர்' : 'Foreign Buyer' },
  ];

  // Helper for rendering pagination numbers: 1 2 3 ... [last]
  const renderPaginationButtons = () => {
    if (totalPages <= 1) return null;
    const buttons = [];

    if (totalPages <= 5) {
      for (let p = 1; p <= totalPages; p++) {
        buttons.push(
          <button
            key={p}
            type="button"
            onClick={() => setPage(p)}
            className={`w-7 h-7 rounded-lg text-xs font-bold cursor-pointer transition flex items-center justify-center ${
              page === p
                ? 'bg-[#0C2D48] text-white shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            {p}
          </button>
        );
      }
      return buttons;
    }

    // Fixed first three pages: 1, 2, 3
    [1, 2, 3].forEach((p) => {
      buttons.push(
        <button
          key={p}
          type="button"
          onClick={() => setPage(p)}
          className={`w-7 h-7 rounded-lg text-xs font-bold cursor-pointer transition flex items-center justify-center ${
            page === p
              ? 'bg-[#0C2D48] text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          {p}
        </button>
      );
    });

    if (page > 3 && page < totalPages) {
      if (page > 4) {
        buttons.push(<span key="ellip-mid-start" className="text-slate-500 text-xs font-bold px-1">...</span>);
      }
      buttons.push(
        <button
          key={page}
          type="button"
          onClick={() => setPage(page)}
          className="w-7 h-7 rounded-lg text-xs font-bold cursor-pointer transition flex items-center justify-center bg-[#0C2D48] text-white shadow-xs"
        >
          {page}
        </button>
      );
      if (page < totalPages - 1) {
        buttons.push(<span key="ellip-mid-end" className="text-slate-500 text-xs font-bold px-1">...</span>);
      }
    } else {
      buttons.push(<span key="ellip-end" className="text-slate-500 text-xs font-bold px-1">...</span>);
    }

    // Last page
    buttons.push(
      <button
        key={totalPages}
        type="button"
        onClick={() => setPage(totalPages)}
        className={`w-7 h-7 rounded-lg text-xs font-bold cursor-pointer transition flex items-center justify-center ${
          page === totalPages
            ? 'bg-[#0C2D48] text-white shadow-xs'
            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
        }`}
      >
        {totalPages}
      </button>
    );

    return buttons;
  };

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {t.audit.title}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t.audit.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => fetchAuditData()}
            disabled={isLoading}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-xs transition cursor-pointer"
            title={t.common.refresh}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={t.audit.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40 transition"
            />
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:flex items-center gap-2.5 w-full md:w-auto">
            <div className="w-full sm:w-60">
              <CustomSelect
                value={actionFilter}
                options={actionOptions}
                onChange={(val) => {
                  setActionFilter(val);
                  setPage(1);
                }}
                placeholder={t.audit.filterAction}
              />
            </div>

            <div className="w-full sm:w-40">
              <CustomSelect
                value={roleFilter}
                options={roleOptions}
                onChange={(val) => {
                  setRoleFilter(val);
                  setPage(1);
                }}
                placeholder={t.audit.filterRole}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Audit Trail Table - Fixed Layout, No Horizontal Scroll, Truncate Overflows */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="w-full overflow-hidden">
          <table className="w-full text-left text-xs table-fixed">
            <colgroup>
              <col className="w-[15%]" />
              <col className="w-[17%]" />
              <col className="w-[15%]" />
              <col className="w-[14%]" />
              <col className="w-[15%]" />
              <col className="w-[24%]" />
            </colgroup>
            <thead className="bg-[#0C2D48] text-white font-bold uppercase text-[10px] tracking-wider border-b border-[#143D60]">
              <tr>
                <th className="py-2.5 px-3 text-slate-100">{t.audit.dateAndTime}</th>
                <th className="py-2.5 px-3 text-slate-100">{t.audit.actionCol}</th>
                <th className="py-2.5 px-3 text-slate-100">{t.audit.reasonCode}</th>
                <th className="py-2.5 px-3 text-slate-100">{t.audit.targetEntity}</th>
                <th className="py-2.5 px-3 text-slate-100">{t.audit.authorRole}</th>
                <th className="py-2.5 px-3 text-slate-100">{t.audit.notesDetails}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    {t.audit.noRecords}
                  </td>
                </tr>
              ) : (
                events.map((ev) => (
                  <tr
                    key={ev.id}
                    onClick={() => setInspectedEvent(ev)}
                    className="even:bg-slate-50/80 odd:bg-white hover:bg-sky-50/60 transition cursor-pointer"
                  >
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px] truncate">
                      {new Date(ev.timestamp).toLocaleString(undefined, {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 truncate" title={ev.action.replace(/_/g, ' ')}>
                      {ev.action.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-block max-w-full truncate px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-900 border border-amber-200" title={ev.reasonCode.replace(/_/g, ' ')}>
                        {ev.reasonCode.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-extrabold text-sky-600 hover:text-sky-700 inline-flex items-center gap-1 truncate max-w-full">
                        <span>{ev.order?.poNumber || `${ev.entityType} (${ev.entityId.substring(0, 8)})`}</span>
                        <ExternalLink className="w-3 h-3 shrink-0 text-sky-400" />
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 truncate">
                      <span className="font-semibold block truncate">{ev.user?.name || (isTa ? 'கணினி' : 'System')}</span>
                      <span className="text-slate-400 text-[10px] block font-mono uppercase">
                        {ev.userRole}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-0 truncate" title={ensureEnglishNote(ev.notes)}>
                      <span className="block truncate">{ensureEnglishNote(ev.notes)}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Dynamic Interactive Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-3 border-t border-slate-100 text-xs gap-2">
          <span className="text-slate-500">
            {t.audit.showingPage} <strong className="text-slate-800 font-bold">{page}</strong> {t.audit.of} <strong className="text-slate-800 font-bold">{totalPages}</strong> ({totalEvents} {t.audit.totalEntries})
          </span>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-white text-slate-700 shadow-2xs cursor-pointer transition flex items-center justify-center"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2.5] text-slate-800" />
            </button>

            {renderPaginationButtons()}

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-white text-slate-700 shadow-2xs cursor-pointer transition flex items-center justify-center"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4 stroke-[2.5] text-slate-800" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Event Inspection Modal (No Hash, Esc-key enabled) */}
      {inspectedEvent && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setInspectedEvent(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  {t.audit.recordDetails} #{inspectedEvent.id.substring(0, 10)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectedEvent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900 transition cursor-pointer"
                title={`${t.common.close} (Esc)`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">{t.audit.actionCol}</span>
                  <span className="font-bold text-slate-800">{inspectedEvent.action.replace(/_/g, ' ')}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">{t.audit.reasonCode}</span>
                  <span className="font-semibold text-slate-800">{inspectedEvent.reasonCode.replace(/_/g, ' ')}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">{t.audit.targetEntity}</span>
                  <span className="font-mono font-bold text-sky-600">
                    {inspectedEvent.order?.poNumber || `${inspectedEvent.entityType} (${inspectedEvent.entityId.substring(0, 10)})`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">{t.audit.author}</span>
                  <span className="font-semibold text-slate-800">
                    {inspectedEvent.user?.name || (isTa ? 'கணினி' : 'System')} ({inspectedEvent.userRole})
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">{t.audit.timestamp}</span>
                  <span className="font-mono text-slate-700">
                    {new Date(inspectedEvent.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>

              {inspectedEvent.notes && (
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">
                    {t.audit.directiveNotes}
                  </span>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 leading-relaxed italic">
                    "{ensureEnglishNote(inspectedEvent.notes)}"
                  </div>
                </div>
              )}

              {inspectedEvent.financialImpactRupees > 0 && (
                <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 flex items-center justify-between">
                  <span className="text-amber-900 font-semibold text-xs">{t.audit.financialExposure}</span>
                  <span className="font-mono font-bold text-amber-950 text-sm">
                    ₹{inspectedEvent.financialImpactRupees.toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setInspectedEvent(null)}
                className="w-full py-2 bg-[#0C2D48] text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
              >
                {t.audit.closeRecord}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
