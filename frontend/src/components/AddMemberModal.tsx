import React, { useState, useEffect } from 'react';
import { X, UserPlus, Shield, Building2, Phone, Mail, Lock, Globe, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { apiRequest } from '../services/api';
import { useLanguage } from '../hooks/useLanguage';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMemberAdded?: () => void;
}

interface UnitOption {
  id: string;
  name: string;
  code: string;
  type: string;
}

interface BuyerOption {
  id: string;
  name: string;
  code: string;
  country: string;
}

export const AddMemberModal: React.FC<AddMemberModalProps> = ({
  isOpen,
  onClose,
  onMemberAdded,
}) => {
  const { lang } = useLanguage();
  const isTa = lang === 'ta';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MERCHANDISER' | 'SUPERVISOR' | 'BUYER'>('SUPERVISOR');
  const [password, setPassword] = useState('ThreadFlow@2026');
  const [languagePreference, setLanguagePreference] = useState<'ta' | 'en'>('ta');
  const [assignedUnitId, setAssignedUnitId] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const [shiftName, setShiftName] = useState('Day Shift (08:00 AM - 04:30 PM)');

  const [units, setUnits] = useState<UnitOption[]>([]);
  const [buyers, setBuyers] = useState<BuyerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load units & buyers metadata
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSuccessMessage(null);

    const fetchMetadata = async () => {
      try {
        setLoading(true);
        const res = await apiRequest<{ success: boolean; data: { units: UnitOption[]; buyers: BuyerOption[] } }>(
          '/users/metadata'
        );
        if (res.data) {
          setUnits(res.data.units || []);
          setBuyers(res.data.buyers || []);
          if (res.data.units.length > 0 && !assignedUnitId) {
            setAssignedUnitId(res.data.units[0].id);
          }
          if (res.data.buyers.length > 0 && !buyerId) {
            setBuyerId(res.data.buyers[0].id);
          }
        }
      } catch (err: any) {
        console.warn('Failed to load metadata:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
  }, [isOpen]);

  // Adjust default language when role changes
  useEffect(() => {
    if (role === 'SUPERVISOR') {
      setLanguagePreference('ta');
    } else {
      setLanguagePreference('en');
    }
  }, [role]);

  // Auto-suggest email domain when typing
  const handleEmailChange = (val: string) => {
    setEmail(val);
  };

  const handleRoleChange = (newRole: 'ADMIN' | 'MERCHANDISER' | 'SUPERVISOR' | 'BUYER') => {
    setRole(newRole);
    if (newRole !== 'BUYER' && email.includes('@') && !email.endsWith('@threadflow.com')) {
      const prefix = email.split('@')[0];
      setEmail(`${prefix}@threadflow.com`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!name.trim()) {
      setError(isTa ? 'பெயர் அவசியமானது' : 'Full name is required');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError(isTa ? 'சரியான மின்னஞ்சல் முகவரி தேவை' : 'Valid email address is required');
      return;
    }
    if (role === 'SUPERVISOR' && !assignedUnitId) {
      setError(isTa ? 'தயவுசெய்து உற்பத்தி பிரிவை தேர்வு செய்யவும்' : 'Please select an assigned manufacturing unit');
      return;
    }
    if (role === 'BUYER' && !buyerId) {
      setError(isTa ? 'தயவுசெய்து வாங்குபவர் நிறுவனத்தை தேர்வு செய்யவும்' : 'Please select a buyer organization');
      return;
    }

    try {
      setSubmitting(true);
      await apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          role,
          password: password.trim() || 'ThreadFlow@2026',
          languagePreference,
          assignedUnitId: role === 'SUPERVISOR' ? assignedUnitId : undefined,
          buyerId: role === 'BUYER' ? buyerId : undefined,
        }),
      });

      setSuccessMessage(
        isTa
          ? `உறுப்பினர் ${name} (${role}) வெற்றிகரமாக சேர்க்கப்பட்டார்!`
          : `Member ${name} (${role}) added successfully!`
      );

      if (onMemberAdded) {
        onMemberAdded();
      }

      // Reset form
      setName('');
      setEmail('');
      setPhone('');
      setPassword('ThreadFlow@2026');

      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err: any) {
      setError(err.message || (isTa ? 'உறுப்பினரைச் சேர்க்க முடியவில்லை' : 'Failed to add member'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        style={{ colorScheme: 'light' }}
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] mx-auto text-slate-900 animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="bg-[#0C2D48] text-white p-5 flex items-center justify-between border-b border-[#143D60]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-400 shrink-0">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                {isTa ? 'புதிய உறுப்பினரைச் சேர்க்க' : 'Add New Member'}
              </h2>
              <p className="text-xs text-sky-200/70 mt-0.5">
                {isTa
                  ? 'மேற்பார்வையாளர், வணிகர் அல்லது வாங்குபவரை அமைப்பில் சேர்க்க'
                  : 'Onboard supervisor, merchandiser, or international buyer'}
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

        {/* Form Body */}
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

          {/* Full Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {isTa ? 'முழுப் பெயர் *' : 'Full Name *'}
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isTa ? 'எ.கா: சுந்தரம் ஆர்.' : 'e.g. Kavitha Sundaram'}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
            />
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {isTa ? 'பங்கு / பணிப் பொறுப்பு *' : 'System Role *'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { key: 'SUPERVISOR', label: isTa ? 'மேற்பார்வையாளர் (Supervisor)' : 'Floor Supervisor', desc: isTa ? 'உற்பத்தி தளம்' : 'Shop Floor & Shifts' },
                  { key: 'MERCHANDISER', label: isTa ? 'வணிகர் (Merchandiser)' : 'Merchandiser', desc: isTa ? 'ஆர்டர்கள் & TNA' : 'Orders & Run-Rates' },
                  { key: 'BUYER', label: isTa ? 'வாங்குபவர் (Buyer)' : 'Buyer Representative', desc: isTa ? 'சர்வதேச வாடிக்கையாளர்' : 'International Brand' },
                  { key: 'ADMIN', label: isTa ? 'நிர்வாகி (Admin)' : 'Administrator', desc: isTa ? 'முழு அணுகல்' : 'Global Governance' },
                ] as const
              ).map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => handleRoleChange(r.key)}
                  className={`p-2.5 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                    role === r.key
                      ? 'border-sky-600 bg-sky-50/80 text-sky-950 ring-2 ring-sky-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="font-bold text-xs">{r.label}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">{r.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Work Email */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>{isTa ? 'அலுவலக மின்னஞ்சல் *' : 'Work Email Address *'}</span>
              {role !== 'BUYER' && (
                <span className="text-[10px] font-mono font-medium text-slate-500">
                  @threadflow.com
                </span>
              )}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                placeholder={
                  role === 'BUYER'
                    ? 'sourcing@brand.co.uk'
                    : 'first.name@threadflow.com'
                }
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
              />
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {isTa ? 'தொலைபேசி எண் (வாட்ஸ்அப் / எஸ்எம்எஸ்)' : 'Phone Number (Alerts & WhatsApp)'}
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98422 12345"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
              />
            </div>
          </div>

          {/* Conditional: SUPERVISOR Assigned Unit & Shift */}
          {role === 'SUPERVISOR' && (
            <div className="p-3.5 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-3 animate-in fade-in duration-100">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                <Building2 className="w-4 h-4 text-amber-700" />
                <span>{isTa ? 'மேற்பார்வையாளர் தளப் பணி ஒதுக்கீடு' : 'Supervisor Floor Work Assignment'}</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {isTa ? 'ஒதுக்கப்பட்ட உற்பத்தி பிரிவு *' : 'Assigned Manufacturing Unit / Facility *'}
                </label>
                <select
                  value={assignedUnitId}
                  onChange={(e) => setAssignedUnitId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.code}) - {u.type}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  {isTa
                    ? 'இந்த பிரிவுக்கு ஒதுக்கப்பட்ட அனைத்து ஆர்டர்களும் தானாகவே மேற்பார்வையாளரின் பணிப்பலகையில் தோன்றும்.'
                    : 'All floor work orders assigned to this unit will automatically appear on this supervisor’s floor workspace.'}
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {isTa ? 'வழக்கமான ஷிப்ட் நேரம்' : 'Default Assigned Shift'}
                </label>
                <select
                  value={shiftName}
                  onChange={(e) => setShiftName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none"
                >
                  <option value="Day Shift (08:00 AM - 04:30 PM)">Day Shift (08:00 AM - 04:30 PM)</option>
                  <option value="Evening Shift (04:30 PM - 01:00 AM)">Evening Shift (04:30 PM - 01:00 AM)</option>
                  <option value="Night Shift (01:00 AM - 08:00 AM)">Night Shift (01:00 AM - 08:00 AM)</option>
                </select>
              </div>
            </div>
          )}

          {/* Conditional: BUYER Organization Selection */}
          {role === 'BUYER' && (
            <div className="p-3.5 rounded-2xl bg-sky-50/60 border border-sky-200 space-y-2 animate-in fade-in duration-100">
              <label className="block text-xs font-bold text-sky-950">
                {isTa ? 'வாங்குபவர் நிறுவனம் *' : 'Buyer Brand Organization *'}
              </label>
              <select
                value={buyerId}
                onChange={(e) => setBuyerId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-sky-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              >
                {buyers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.country})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Language Preference */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              <span>{isTa ? 'குரல் மற்றும் இடைமுக மொழி' : 'Voice Logging & Display Language'}</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLanguagePreference('ta')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold text-center transition cursor-pointer ${
                  languagePreference === 'ta'
                    ? 'border-sky-600 bg-sky-50 text-sky-800 ring-2 ring-sky-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                தமிழ் (Tamil)
              </button>
              <button
                type="button"
                onClick={() => setLanguagePreference('en')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold text-center transition cursor-pointer ${
                  languagePreference === 'en'
                    ? 'border-sky-600 bg-sky-50 text-sky-800 ring-2 ring-sky-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* Initial Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>{isTa ? 'ஆரம்ப கடவுச்சொல்' : 'Initial Password'}</span>
              <span className="text-[10px] text-slate-400 font-mono">
                {isTa ? 'முதல் உள்நுழைவில் மாற்றலாம்' : 'Can be changed on login'}
              </span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 bg-slate-50 text-slate-900 placeholder:text-slate-400 font-medium"
              />
            </div>
          </div>

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
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-[#0C2D48] hover:bg-[#143D60] text-white text-xs font-bold shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isTa ? 'உறுப்பினரைச் சேர்க்க' : 'Create Member'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
