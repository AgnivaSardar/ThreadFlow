import React from 'react';
import { X, Phone, Mail, Building2, MapPin, ShieldAlert, UserCheck } from 'lucide-react';

interface ContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PLANT_CONTACTS = [
  {
    role: 'Operations & General Manager',
    name: 'Mr. R. Natarajan',
    dept: 'Executive Management • Tiruppur Hub',
    phone: '+91 94431 20000',
    email: 'gm@tiruppurknitwear.com',
    location: 'Central Plant, Avinashi Road',
  },
  {
    role: 'Senior Export Merchandiser',
    name: 'Ramesh K.',
    dept: 'Buyer Coordination & TNA Milestones',
    phone: '+91 98422 55443',
    email: 'merchandiser@threadflow.com',
    location: 'Merchandising Wing, 2nd Floor',
  },
  {
    role: 'Floor Supervisor (Unit 2 Stitching)',
    name: 'Muthuvel S.',
    dept: 'Assembly Lines & Tamil Telemetry',
    phone: '+91 98422 10101',
    email: 'supervisor.muthu@threadflow.com',
    location: 'Unit 2 Production Floor',
  },
  {
    role: 'Printing & Embroidery Line Manager',
    name: 'P. Murugan',
    dept: 'Subcontract Operations • PrintTex',
    phone: '+91 98425 40404',
    email: 'murugan@printtex.in',
    location: 'PrintTex Facility, Angeripalayam',
  },
  {
    role: 'Dyeing & Washing Plant Lead',
    name: 'K. Selvam',
    dept: 'Subcontract Operations • WashTex',
    phone: '+91 98425 30303',
    email: 'selvam@washtex.in',
    location: 'WashTex Processing Zone',
  },
  {
    role: 'ThreadFlow Support & IT Desk',
    name: 'Technical Support Team',
    dept: 'System Integration & Device Sync',
    phone: '1800-425-9988 (Toll Free)',
    email: 'support@threadflow.app',
    location: 'Available 24x7 for Floor Ops',
  },
];

export const ContactsModal: React.FC<ContactsModalProps> = ({ isOpen, onClose }) => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        style={{ colorScheme: 'light' }}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden text-slate-900 max-h-[88vh] flex flex-col"
      >
        {/* Header */}
        <div className="bg-[#0C2D48] px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-amber-300 font-bold">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Plant Directory & Key Contacts</h3>
              <p className="text-xs text-sky-200/80">Department heads, supervisors, and subcontractor contacts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-sky-200 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Directory List */}
        <div className="p-6 overflow-y-auto space-y-3 divide-y divide-slate-100">
          {PLANT_CONTACTS.map((c, idx) => (
            <div key={idx} className="pt-3 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900">{c.name}</h4>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200">
                    {c.role}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{c.dept} • {c.location}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs shrink-0 pt-1 sm:pt-0">
                <a
                  href={`tel:${c.phone}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono font-medium transition"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{c.phone}</span>
                </a>
                <a
                  href={`mailto:${c.email}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                  title={c.email}
                >
                  <Mail className="w-3.5 h-3.5 text-sky-600" />
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
