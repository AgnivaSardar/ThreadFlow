import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Factory,
  AlertTriangle,
  FileText,
  ShieldCheck,
  Globe,
  LogOut,
  TrendingUp,
  X,
  Activity,
  Clock,
  Calendar as CalendarIcon,
  CheckSquare,
} from 'lucide-react';
import { useAuthStore } from '../features/auth/authStore';
import {
  Language,
  SUPERVISOR_I18N,
} from '../features/supervisor/supervisorTranslations';
import { SidebarCalendar } from './SidebarCalendar';

interface SidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const navigate = useNavigate();
  const { user, logout, hasRole } = useAuthStore();
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

  const t = SUPERVISOR_I18N[lang];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    {
      label: t.orderBoard,
      to: '/orders',
      icon: <LayoutDashboard className="w-5 h-5" />,
      visible: hasRole('MERCHANDISER', 'ADMIN'),
    },
    {
      label: t.floorWork,
      to: '/supervisor/my-work',
      icon: <Factory className="w-5 h-5" />,
      visible: hasRole('SUPERVISOR', 'MERCHANDISER', 'ADMIN'),
    },
    {
      label: t.riskDelays,
      to: '/risk',
      icon: <AlertTriangle className="w-5 h-5" />,
      visible: hasRole('MERCHANDISER', 'ADMIN'),
    },
    {
      label: t.buyerPortal,
      to: '/buyer-portal',
      icon: <Globe className="w-5 h-5" />,
      visible: hasRole('BUYER', 'MERCHANDISER', 'ADMIN'),
    },
    {
      label: t.auditHistory,
      to: '/audit',
      icon: <ShieldCheck className="w-5 h-5" />,
      visible: hasRole('MERCHANDISER', 'ADMIN'),
    },
    {
      label: t.weeklyReports,
      to: '/reports',
      icon: <FileText className="w-5 h-5" />,
      visible: hasRole('MERCHANDISER', 'ADMIN', 'BUYER'),
    },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`w-64 bg-[#0C2D48] text-slate-100 flex flex-col justify-between shrink-0 h-full border-r border-[#103859] select-none overflow-hidden transition-transform duration-300 z-50 ${
          isMobileOpen
            ? 'fixed inset-y-0 left-0 translate-x-0 shadow-2xl'
            : 'fixed inset-y-0 left-0 -translate-x-full lg:static lg:translate-x-0'
        }`}
      >
        <div className="flex-1 overflow-y-auto smooth-scroll min-h-0">
          {/* Brand Header */}
          <div className="h-14 sm:h-16 flex items-center justify-between px-5 border-b border-[#143D60]/60 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white p-1 flex items-center justify-center text-[#0C2D48] shadow-md shrink-0 overflow-hidden">
                <img src="/logo.png" alt="ThreadFlow Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <div className="text-base font-bold tracking-tight text-white font-mono leading-none">
                  Thread<span className="text-amber-400">Flow</span>
                </div>
                <div className="text-[10px] text-sky-200/70 uppercase tracking-widest font-semibold mt-1">
                  {t.tiruppurKnitwear}
                </div>
              </div>
            </div>

            {/* Close button on mobile */}
            {onCloseMobile && (
              <button
                type="button"
                onClick={onCloseMobile}
                className="lg:hidden p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Main Navigation */}
          <div className="px-3 py-2.5">
            <nav className="space-y-1">
              {navItems
                .filter((item) => item.visible)
                .map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => {
                      if (onCloseMobile) onCloseMobile();
                    }}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all relative ${
                        isActive
                          ? 'bg-[#164368] text-white shadow-inner font-semibold'
                          : 'text-sky-100/70 hover:text-white hover:bg-[#103859]/60'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {/* Active indicator bar */}
                        {isActive && (
                          <div className="absolute left-0 top-1.5 bottom-1.5 w-1.5 rounded-r bg-amber-400 shadow-sm shadow-amber-400/50" />
                        )}
                        <span className={isActive ? 'text-amber-400' : 'text-sky-200/60'}>
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
            </nav>
          </div>
        </div>

        {/* Bottom Section (Fixed at bottom, never cut off) */}
        <div className="p-2.5 sm:p-3 space-y-2 shrink-0 border-t border-[#143D60]/60 bg-[#0C2D48]">
          {/* Full-fledged Month Calendar with Single Event Related Dots */}
          <SidebarCalendar />

          {/* Logout Action Bar */}
          <div>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-sky-100 hover:text-white bg-[#103859]/60 hover:bg-rose-500/20 hover:border-rose-400/40 border border-transparent transition-all cursor-pointer shadow-xs"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span>{t.logout}</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
