import React from 'react';
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
  Settings,
} from 'lucide-react';
import { useAuthStore } from '../features/auth/authStore';

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, hasRole } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    {
      label: 'Order Board',
      to: '/orders',
      icon: <LayoutDashboard className="w-5 h-5" />,
      visible: hasRole('MERCHANDISER', 'ADMIN'),
    },
    {
      label: 'Floor Work',
      to: '/supervisor/my-work',
      icon: <Factory className="w-5 h-5" />,
      visible: hasRole('SUPERVISOR', 'MERCHANDISER', 'ADMIN'),
    },
    {
      label: 'Risk & Delays',
      to: '/risk',
      icon: <AlertTriangle className="w-5 h-5" />,
      visible: hasRole('MERCHANDISER', 'ADMIN'),
    },
    {
      label: 'Buyer Portal',
      to: '/buyer-portal',
      icon: <Globe className="w-5 h-5" />,
      visible: hasRole('BUYER', 'MERCHANDISER', 'ADMIN'),
    },
    {
      label: 'Audit History',
      to: '/audit',
      icon: <ShieldCheck className="w-5 h-5" />,
      visible: hasRole('MERCHANDISER', 'ADMIN'),
    },
    {
      label: 'Weekly Reports',
      to: '/reports',
      icon: <FileText className="w-5 h-5" />,
      visible: hasRole('MERCHANDISER', 'ADMIN', 'BUYER'),
    },
  ];

  return (
    <aside className="w-64 bg-[#0C2D48] text-slate-100 flex flex-col justify-between shrink-0 h-full border-r border-[#103859] select-none overflow-hidden">
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center px-5 gap-3 border-b border-[#143D60]/60">
          <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-[#0C2D48] shadow-md shrink-0">
            <Factory className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-bold tracking-tight text-white font-mono leading-none">
              Thread<span className="text-amber-400">Flow</span>
            </div>
            <div className="text-[10px] text-sky-200/70 uppercase tracking-widest font-semibold mt-1">
              Tiruppur Knitwear
            </div>
          </div>
        </div>

        {/* Main Navigation */}
        <div className="px-3 py-4">
          <div className="text-[10px] uppercase font-bold text-sky-200/40 px-3 mb-2 tracking-wider">
            Production Ops
          </div>
          <nav className="space-y-1">
            {navItems
              .filter((item) => item.visible)
              .map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative ${
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
                        <div className="absolute left-0 top-2 bottom-2 w-1.5 rounded-r bg-amber-400 shadow-sm shadow-amber-400/50" />
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

      {/* Bottom Section */}
      <div className="p-3 space-y-3">
        {/* Run-rate Recovery CTA Banner (Matching reference design bottom-left banner) */}
        {hasRole('MERCHANDISER', 'ADMIN') && (
          <div className="rounded-2xl p-3.5 bg-gradient-to-br from-[#1E5676] to-[#0E3652] border border-sky-400/20 text-white shadow-lg relative overflow-hidden">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-white tracking-wide">Shift Run-Rate</span>
            </div>
            <p className="text-[11px] text-sky-100/80 leading-relaxed mb-2.5">
              Simulate floor recovery & line reallocations 14 days ahead.
            </p>
            <button
              type="button"
              onClick={() => navigate('/risk')}
              className="w-full py-1.5 px-3 bg-white hover:bg-slate-50 text-[#0C2D48] rounded-lg text-xs font-bold shadow transition-all cursor-pointer text-center"
            >
              Open Simulator
            </button>
          </div>
        )}

        {/* Logout Action Bar (Dedicated Button, No Name) */}
        <div className="pt-2 border-t border-[#143D60]/60">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-sky-100 hover:text-white bg-[#103859]/60 hover:bg-rose-500/20 hover:border-rose-400/40 border border-transparent transition-all cursor-pointer shadow-xs"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
