import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  Phone,
  Clock,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Users,
  ShieldCheck,
  ChevronRight,
  ClipboardList,
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useLanguage } from '../hooks/useLanguage';

interface SupervisorItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  languagePreference: string;
  assignedUnitId: string | null;
  assignedUnit: {
    id: string;
    name: string;
    code: string;
    type: string;
    location: string;
  } | null;
  floorOrders: Array<{
    orderId: string;
    poNumber: string;
    style: string;
    totalQuantity: number;
    buyerName: string;
    activeStage: string;
    completedQuantity: number;
    targetQuantity: number;
  }>;
}

interface UnitItem {
  id: string;
  name: string;
  code: string;
  type: string;
  location: string;
}

interface AssignSupervisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssignmentUpdated?: () => void;
}

export const AssignSupervisorModal: React.FC<AssignSupervisorModalProps> = ({
  isOpen,
  onClose,
  onAssignmentUpdated,
}) => {
  const { lang } = useLanguage();
  const isTa = lang === 'ta';

  const [supervisors, setSupervisors] = useState<SupervisorItem[]>([]);
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [activeOrdersByUnit, setActiveOrdersByUnit] = useState<Record<string, any[]>>({});

  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>('');
  const [targetUnitId, setTargetUnitId] = useState<string>('');
  const [shiftName, setShiftName] = useState<string>('Day Shift (08:00 AM - 04:30 PM)');
  const [notingFrequency, setNotingFrequency] = useState<string>('Hourly Line Tally (Every 1 hour)');
  const [assignedLines, setAssignedLines] = useState<string>('Line 1 & Line 2 (All Tables)');
  const [phone, setPhone] = useState<string>('');
  const [languagePreference, setLanguagePreference] = useState<'ta' | 'en'>('ta');

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch supervisors and active units
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<{
        success: boolean;
        data: {
          supervisors: SupervisorItem[];
          units: UnitItem[];
          activeOrdersByUnit: Record<string, any[]>;
        };
      }>('/users/supervisors');

      if (res.data) {
        setSupervisors(res.data.supervisors || []);
        setUnits(res.data.units || []);
        setActiveOrdersByUnit(res.data.activeOrdersByUnit || {});

        if (res.data.supervisors.length > 0) {
          const first = res.data.supervisors[0];
          setSelectedSupervisorId(first.id);
          setTargetUnitId(first.assignedUnitId || (res.data.units[0]?.id ?? ''));
          setPhone(first.phone || '');
          setLanguagePreference(first.languagePreference === 'en' ? 'en' : 'ta');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load supervisor floor assignments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMessage(null);
      fetchData();
    }
  }, [isOpen]);

  // When selected supervisor changes, populate their details
  const handleSupervisorSelect = (id: string) => {
    setSelectedSupervisorId(id);
    const sup = supervisors.find((s) => s.id === id);
    if (sup) {
      setTargetUnitId(sup.assignedUnitId || (units[0]?.id ?? ''));
      setPhone(sup.phone || '');
      setLanguagePreference(sup.languagePreference === 'en' ? 'en' : 'ta');
    }
  };

  const selectedSupervisor = supervisors.find((s) => s.id === selectedSupervisorId);
  const selectedUnitOrders = targetUnitId ? activeOrdersByUnit[targetUnitId] || [] : [];
  const selectedUnit = units.find((u) => u.id === targetUnitId);

  // Other supervisors sharing this same floor work
  const coSupervisors = supervisors.filter(
    (s) => s.id !== selectedSupervisorId && s.assignedUnitId === targetUnitId
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupervisorId || !targetUnitId) {
      setError(isTa ? 'தயவுசெய்து மேற்பார்வையாளர் மற்றும் உற்பத்தி பிரிவை தேர்ந்தெடுக்கவும்' : 'Please select supervisor and target unit');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccessMessage(null);

      await apiRequest(`/users/supervisors/${selectedSupervisorId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          assignedUnitId: targetUnitId,
          phone: phone.trim() || undefined,
          languagePreference,
          shiftName,
          notingFrequency,
          assignedLines,
        }),
      });

      setSuccessMessage(
        isTa
          ? `${selectedSupervisor?.name} அவர்களின் தளப் பணி வெற்றிகரமாக மாற்றப்பட்டது!`
          : `Floor work assignment for ${selectedSupervisor?.name} successfully updated to ${selectedUnit?.name}!`
      );

      if (onAssignmentUpdated) {
        onAssignmentUpdated();
      }

      await fetchData();

      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to update supervisor floor assignment');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] mx-auto animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#0C2D48] text-white p-5 flex items-center justify-between border-b border-[#143D60]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-400 shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  {isTa ? 'மேற்பார்வையாளர் தளப் பணி ஒதுக்கீடு' : 'Assign Floor Work to Supervisor'}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  {isTa ? 'நிர்வாகி & வணிகர்' : 'Admin & Merchandiser'}
                </span>
              </div>
              <p className="text-xs text-sky-200/70 mt-0.5">
                {isTa
                  ? 'மேற்பார்வையாளர்களுக்கு உற்பத்தி பிரிவுகள், ஷிப்ட் மற்றும் ஆர்டர்களை ஒதுக்குதல்'
                  : 'Assign manufacturing facilities, active PO work, and shift telemetry rules'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-sky-200/70 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
              <span className="text-xs font-semibold">{isTa ? 'தளத் தரவு ஏற்றப்படுகிறது...' : 'Loading supervisor floor data...'}</span>
            </div>
          ) : (
            <>
              {/* Supervisor Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>{isTa ? 'மேற்பார்வையாளரைத் தேர்வு செய்க *' : 'Select Supervisor to Assign *'}</span>
                  <span className="text-[10px] font-medium text-slate-500">
                    {supervisors.length} {isTa ? 'மேற்பார்வையாளர்கள் உள்ளனர்' : 'Supervisors Onboarded'}
                  </span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {supervisors.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSupervisorSelect(s.id)}
                      className={`p-3 rounded-2xl border text-left transition cursor-pointer flex items-start gap-2.5 ${
                        selectedSupervisorId === s.id
                          ? 'border-sky-600 bg-sky-50/70 ring-2 ring-sky-500/20'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-[#0C2D48] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        {s.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 truncate">{s.name}</div>
                        <div className="text-[11px] text-slate-500 truncate">{s.email}</div>
                        <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 font-semibold text-slate-700">
                            {s.assignedUnit?.code || 'UNASSIGNED'}
                          </span>
                          <span className="text-slate-400 font-mono">
                            {s.floorOrders.length} {isTa ? 'ஆர்டர்கள்' : 'active POs'}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Floor Work Assignment (Target Unit) */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>{isTa ? 'ஒதுக்கப்படும் உற்பத்திப் பிரிவு (Floor Work Assignment) *' : 'Assigned Manufacturing Floor / Facility *'}</span>
                  <span className="text-[10px] text-sky-700 font-semibold">
                    {isTa ? 'ஒரே பிரிவுக்கு பல மேற்பார்வையாளர்களை ஒதுக்கலாம்' : 'Shared Floor Work Supported'}
                  </span>
                </label>
                <select
                  value={targetUnitId}
                  onChange={(e) => setTargetUnitId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.code}) - {u.type}
                    </option>
                  ))}
                </select>

                {/* Shared Floor Work Notice */}
                {coSupervisors.length > 0 && (
                  <div className="mt-2 p-2.5 rounded-xl bg-sky-50/80 border border-sky-200 text-sky-900 text-[11px] flex items-center gap-2">
                    <Users className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>
                      {isTa
                        ? `இந்த தளப் பணி ஏற்கனவே ${(coSupervisors.map((c) => c.name)).join(', ')} அவர்களுடன் பகிரப்பட்டுள்ளது.`
                        : `This floor work is also co-managed by: ${coSupervisors.map((c) => c.name).join(', ')}.`}
                    </span>
                  </div>
                )}
              </div>

              {/* Active Floor Orders Preview for Selected Unit */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Layers className="w-4 h-4 text-sky-600" />
                    <span>
                      {isTa ? 'இந்த தளத்தில் உள்ள நேரடி உற்பத்தி ஆர்டர்கள்' : 'Active Orders on This Floor'} ({selectedUnitOrders.length})
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    {selectedUnit?.code}
                  </span>
                </div>

                {selectedUnitOrders.length === 0 ? (
                  <div className="text-center py-3 text-xs text-slate-400">
                    {isTa ? 'தற்போது செயலில் உள்ள ஆர்டர்கள் இல்லை' : 'No active orders currently running on this floor'}
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {selectedUnitOrders.map((ord) => (
                      <div
                        key={ord.orderId}
                        className="p-2 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-900 truncate">
                            <span className="text-sky-700 font-mono mr-1.5">{ord.poNumber}</span>
                            {ord.style}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {ord.buyerName} • {ord.totalQuantity.toLocaleString()} pcs
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">
                            {ord.activeStage}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Shift Timing & Output Noting Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Shift Hours */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{isTa ? 'ஷிப்ட் வேலை நேரம்' : 'Shift Working Window'}</span>
                  </label>
                  <select
                    value={shiftName}
                    onChange={(e) => setShiftName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  >
                    <option value="Day Shift (08:00 AM - 04:30 PM)">Day Shift (08:00 AM - 04:30 PM)</option>
                    <option value="Evening Shift (04:30 PM - 01:00 AM)">Evening Shift (04:30 PM - 01:00 AM)</option>
                    <option value="Night Shift (01:00 AM - 08:00 AM)">Night Shift (01:00 AM - 08:00 AM)</option>
                    <option value="General Shift (09:00 AM - 06:00 PM)">General Shift (09:00 AM - 06:00 PM)</option>
                  </select>
                </div>

                {/* Output Noting Frequency */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isTa ? 'உற்பத்தி பதிவு செய்யும் கால இடைவெளி' : 'Floor Output Noting Frequency'}
                  </label>
                  <select
                    value={notingFrequency}
                    onChange={(e) => setNotingFrequency(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  >
                    <option value="Hourly Line Tally (Every 1 hour)">Hourly Line Tally (Every 1 hour)</option>
                    <option value="Bi-Hourly Output Audit (Every 2 hours)">Bi-Hourly Output Audit (Every 2 hours)</option>
                    <option value="Shift-End Final Batch Tally (Before 6:00 PM cutoff)">Shift-End Final Batch Tally (Before 6:00 PM cutoff)</option>
                  </select>
                </div>

                {/* Assigned Production Lines */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isTa ? 'பொறுப்புள்ள தையல் / உற்பத்தி லைன்கள்' : 'Assigned Lines / Tables'}
                  </label>
                  <input
                    type="text"
                    value={assignedLines}
                    onChange={(e) => setAssignedLines(e.target.value)}
                    placeholder="e.g. Line 1, Line 2, Checking Tables"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>

                {/* Supervisor Phone */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span>{isTa ? 'தொலைபேசி எண் (எச்சரிக்கைகள்)' : 'Supervisor Mobile (SMS / WhatsApp)'}</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98422 30003"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>
              </div>

              {/* Language Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isTa ? 'தள குரல் பதிவு & பயன்பாட்டு மொழி' : 'Speech-to-Text & Display Language'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLanguagePreference('ta')}
                    className={`py-1.5 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      languagePreference === 'ta'
                        ? 'border-sky-600 bg-sky-50 text-sky-800 ring-2 ring-sky-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    தமிழ் (Tamil Voice & Notes)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguagePreference('en')}
                    className={`py-1.5 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      languagePreference === 'en'
                        ? 'border-sky-600 bg-sky-50 text-sky-800 ring-2 ring-sky-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              {isTa ? 'ரத்துசெய்' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={submitting || loading || !selectedSupervisorId || !targetUnitId}
              className="px-5 py-2.5 rounded-xl bg-[#0C2D48] hover:bg-[#143D60] text-white text-xs font-bold shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isTa ? 'ஒதுக்கீட்டைப் புதுப்பிக்க' : 'Save Floor Assignment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
