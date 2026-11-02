import React, { useState, useEffect } from 'react';
import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '../features/auth/authStore';
import { Clock, LogOut } from 'lucide-react';
import { syncServerTime, getAuthoritativeServerDate } from '../services/api';
import { UserMenuDropdown } from './UserMenuDropdown';

export const AppLayout: React.FC = () => {
  const { isAuthenticated, user, isLoading, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [serverTime, setServerTime] = useState<Date>(getAuthoritativeServerDate());

  useEffect(() => {
    // Initial server sync
    syncServerTime().then(() => {
      setServerTime(getAuthoritativeServerDate());
    });

    // Tick every 1 second using monotonic server offset
    const timer = setInterval(() => {
      setServerTime(getAuthoritativeServerDate());
    }, 1000);

    // Periodic re-sync with server every 60s
    const syncInterval = setInterval(() => {
      syncServerTime();
    }, 60000);

    return () => {
      clearInterval(timer);
      clearInterval(syncInterval);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!isAuthenticated && !isLoading) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Format date and time cleanly without cramped location tags
  const formattedDate = serverTime.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const formattedTime = serverTime.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8FAFC]">
      {/* Fixed Navigation Sidebar */}
      <div className="h-full shrink-0 flex flex-col">
        <Sidebar />
      </div>

      {/* Main Workspace Area - Only Content Scrolls */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header Bar (Fixed) */}
        {/* Top Header Bar (Fixed with higher stacking context so dropdown renders on top) */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 relative z-40 shadow-xs">
          {/* Authoritative Server Date & Time (Clean, Spacious, No Location Tag) */}
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-slate-50 border border-slate-200/90 text-slate-700 text-xs shadow-2xs">
            <Clock className="w-4 h-4 text-sky-600 shrink-0" />
            <span className="font-semibold text-slate-800">{formattedDate}</span>
            <span className="text-slate-300">|</span>
            <span className="font-mono font-bold text-slate-900 tracking-wide text-xs">
              {formattedTime}
            </span>
          </div>

          {/* Right Section: User Name & Clickable Avatar Menu Dropdown */}
          {user && (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-slate-800">{user.name}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                  {user.role} {user.buyer?.name ? `• ${user.buyer.code}` : ''}
                </div>
              </div>

              {/* Clickable Avatar with Dropdown Menu (Profile view/edit, contacts) */}
              <UserMenuDropdown />
            </div>
          )}
        </header>

        {/* Scrollable Content Container (Docked to right viewport edge with butter-smooth scrolling) */}
        <main className="flex-1 overflow-y-auto w-full smooth-scroll">
          <div className="p-6 max-w-7xl w-full mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
