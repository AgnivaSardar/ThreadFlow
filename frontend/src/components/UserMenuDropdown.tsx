import React, { useState, useRef, useEffect } from 'react';
import { User, LogOut, ChevronDown, Building2, Phone, Settings, Shield, UserPlus, ClipboardList } from 'lucide-react';
import { useAuthStore } from '../features/auth/authStore';
import { useNavigate } from 'react-router-dom';
import { ProfileModal } from './ProfileModal';
import { ContactsModal } from './ContactsModal';
import { AddMemberModal } from './AddMemberModal';
import { AssignSupervisorModal } from './AssignSupervisorModal';
import {
  Language,
  translateRole,
  translateUnit,
} from '../features/supervisor/supervisorTranslations';

export const UserMenuDropdown: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isContactsModalOpen, setIsContactsModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isAssignSupervisorModalOpen, setIsAssignSupervisorModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [lang, setLang] = useState<Language>(
    (localStorage.getItem('threadflow_lang') as Language) ||
      (user?.languagePreference === 'ta' ? 'ta' : 'en')
  );

  useEffect(() => {
    const handleLangChange = (e: any) => {
      if (e.detail?.lang) {
        setLang(e.detail.lang);
      }
    };
    window.addEventListener('threadflow-lang-change', handleLangChange);
    return () => window.removeEventListener('threadflow-lang-change', handleLangChange);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Clickable Avatar Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 p-1 rounded-full hover:bg-slate-100 transition focus:outline-none focus:ring-2 focus:ring-sky-500/40"
        title="Open user profile & actions menu"
      >
        <div className="w-8 h-8 rounded-full bg-[#0C2D48] text-white flex items-center justify-center font-bold text-xs shadow-xs hover:bg-[#143D60] transition">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Floating Menu Dropdown */}
      {isOpen && (
        <div
          style={{ colorScheme: 'light' }}
          className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100 text-slate-900"
        >
          {/* User Details Header */}
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#0C2D48] text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 truncate">{user.name}</div>
                <div className="text-xs text-slate-500 truncate">{user.email}</div>
                <div className="mt-1">
                  <span className="inline-block px-2 py-0.5 rounded-md font-mono font-bold text-[10px] bg-amber-100 text-amber-900">
                    {translateRole(user.role, lang)}
                  </span>
                </div>
              </div>
            </div>

            {user.assignedUnit && (
              <div className="mt-2.5 pt-2 border-t border-slate-100/80 text-[11px] text-slate-600 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{translateUnit(user.assignedUnit.name, lang)}</span>
              </div>
            )}
          </div>

          {/* Menu Items */}
          <div className="py-1 text-xs">
            {/* Admin: Add Member */}
            {user.role === 'ADMIN' && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsAddMemberModalOpen(true);
                }}
                className="w-full px-4 py-2 text-left flex items-center gap-2.5 hover:bg-sky-50 text-sky-900 hover:text-sky-950 font-semibold transition"
              >
                <UserPlus className="w-4 h-4 text-sky-600" />
                <span>{lang === 'ta' ? 'புதிய உறுப்பினரைச் சேர்க்க (Add Member)' : 'Add New Member'}</span>
              </button>
            )}

            {/* Admin & Merchandiser: Assign Floor Work to Supervisor */}
            {(user.role === 'ADMIN' || user.role === 'MERCHANDISER') && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsAssignSupervisorModalOpen(true);
                }}
                className="w-full px-4 py-2 text-left flex items-center gap-2.5 hover:bg-amber-50 text-amber-900 hover:text-amber-950 font-semibold transition"
              >
                <ClipboardList className="w-4 h-4 text-amber-600" />
                <span>{lang === 'ta' ? 'மேற்பார்வையாளர் தளப் பணி ஒதுக்கீடு' : 'Assign Supervisor Floor Work'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsProfileModalOpen(true);
              }}
              className="w-full px-4 py-2 text-left flex items-center gap-2.5 hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition"
            >
              <User className="w-4 h-4 text-slate-500" />
              <span>{lang === 'ta' ? 'சுயவிவரம் பார்க்க & திருத்த' : 'View & Edit Profile'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsContactsModalOpen(true);
              }}
              className="w-full px-4 py-2 text-left flex items-center gap-2.5 hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition"
            >
              <Phone className="w-4 h-4 text-emerald-600" />
              <span>{lang === 'ta' ? 'தொழிற்சாலை தொடர்புகள் & எண்கள்' : 'Plant Directory & Contacts'}</span>
            </button>
          </div>

          {/* Logout Action */}
          <div className="pt-1 border-t border-slate-100">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full px-4 py-2 text-left flex items-center gap-2.5 text-rose-600 hover:bg-rose-50 transition text-xs font-semibold"
            >
              <LogOut className="w-4 h-4" />
              <span>{lang === 'ta' ? 'வெளியேறு' : 'Logout'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
      <ContactsModal isOpen={isContactsModalOpen} onClose={() => setIsContactsModalOpen(false)} />
      <AddMemberModal
        isOpen={isAddMemberModalOpen}
        onClose={() => setIsAddMemberModalOpen(false)}
      />
      <AssignSupervisorModal
        isOpen={isAssignSupervisorModalOpen}
        onClose={() => setIsAssignSupervisorModalOpen(false)}
      />
    </div>
  );
};
