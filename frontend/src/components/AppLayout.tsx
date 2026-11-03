import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '../features/auth/authStore';
import { Clock, Menu, Wifi, WifiOff, RefreshCw, Languages } from 'lucide-react';
import { syncServerTime, getAuthoritativeServerDate } from '../services/api';
import { UserMenuDropdown } from './UserMenuDropdown';
import { OfflineQueueDrawer } from './OfflineQueueDrawer';
import {
  getPendingOfflineCount,
} from '../offline/queue/queue';
import {
  registerOfflineSyncListeners,
  syncOfflineQueue,
  SyncResult,
} from '../offline/sync/sync';
import {
  formatDateLocalized,
  translateRole,
} from '../features/supervisor/supervisorTranslations';

export const AppLayout: React.FC = () => {
  const { isAuthenticated, user, isLoading } = useAuthStore();
  const location = useLocation();
  const [serverTime, setServerTime] = useState<Date>(getAuthoritativeServerDate());
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Network & Sync states in Main Header
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isQueueDrawerOpen, setIsQueueDrawerOpen] = useState(false);

  // Language state
  const [lang, setLang] = useState<'ta' | 'en'>(
    (localStorage.getItem('threadflow_lang') as 'ta' | 'en') ||
      (user?.languagePreference === 'ta' ? 'ta' : 'en')
  );

  // Toggle Language Handler
  const handleToggleLanguage = () => {
    const nextLang = lang === 'ta' ? 'en' : 'ta';
    setLang(nextLang);
    localStorage.setItem('threadflow_lang', nextLang);
    window.dispatchEvent(new CustomEvent('threadflow-lang-change', { detail: { lang: nextLang } }));
  };

  // Refresh pending items count
  const refreshPending = useCallback(async () => {
    const count = await getPendingOfflineCount();
    setPendingCount(count);
  }, []);

  useEffect(() => {
    // Initial server sync
    syncServerTime().then(() => {
      setServerTime(getAuthoritativeServerDate());
    });

    const timer = setInterval(() => {
      setServerTime(getAuthoritativeServerDate());
    }, 1000);

    const syncInterval = setInterval(() => {
      syncServerTime();
    }, 60000);

    // Offline listeners
    refreshPending();
    const cleanupSync = registerOfflineSyncListeners();

    const handleNetworkChange = () => {
      setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
      refreshPending();
    };

    const handleQueueChange = () => {
      refreshPending();
    };

    const handleOpenDrawerEvent = () => {
      setIsQueueDrawerOpen(true);
    };

    window.addEventListener('online', handleNetworkChange);
    window.addEventListener('offline', handleNetworkChange);
    window.addEventListener('threadflow-network-change', handleNetworkChange);
    window.addEventListener('threadflow-queue-changed', handleQueueChange);
    window.addEventListener('threadflow-queue-synced', handleQueueChange);
    window.addEventListener('threadflow-open-queue-drawer', handleOpenDrawerEvent);

    return () => {
      clearInterval(timer);
      clearInterval(syncInterval);
      cleanupSync();
      window.removeEventListener('online', handleNetworkChange);
      window.removeEventListener('offline', handleNetworkChange);
      window.removeEventListener('threadflow-network-change', handleNetworkChange);
      window.removeEventListener('threadflow-queue-changed', handleQueueChange);
      window.removeEventListener('threadflow-queue-synced', handleQueueChange);
      window.removeEventListener('threadflow-open-queue-drawer', handleOpenDrawerEvent);
    };
  }, [refreshPending]);

  // Manual Trigger Sync & Open Drawer from Main Dashboard Header
  const handleManualSync = async () => {
    setIsQueueDrawerOpen(true);
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    setIsSyncing(true);
    try {
      await syncOfflineQueue(true);
    } finally {
      setIsSyncing(false);
      refreshPending();
    }
  };

  if (!isAuthenticated && !isLoading) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Format date and time
  const formattedDate = formatDateLocalized(serverTime, lang);

  const formattedTimeFull = serverTime.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const formattedTimeCompact = serverTime.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8FAFC]">
      {/* Responsive Collapsible Sidebar */}
      <Sidebar
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Main Dashboard Header (Unified, Compact on Mobile, Non-Congested) */}
        <header className="h-13 sm:h-16 bg-white border-b border-slate-200 px-2 sm:px-6 flex items-center justify-between shrink-0 relative z-30 shadow-2xs">
          {/* Left: Mobile Menu Toggle + Authoritative Server Date & Time */}
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            {/* Hamburger Button for Mobile */}
            <div className="flex items-center gap-1.5 lg:hidden">
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="p-1.5 rounded-xl text-slate-700 hover:bg-slate-100 active:scale-95 transition-all shrink-0"
                aria-label="Open Navigation Menu"
              >
                <Menu className="w-5 h-5 text-slate-800" />
              </button>
              <img src="/logo.png" alt="ThreadFlow" className="w-6 h-6 object-contain shrink-0" />
            </div>

            {/* Server Date & Time Badge */}
            <div className="flex items-center gap-1 sm:gap-2 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-50 border border-slate-200/90 text-slate-700 text-xs shadow-2xs shrink-0">
              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-600 shrink-0" />
              <span className="font-semibold text-slate-800 hidden sm:inline">{formattedDate}</span>
              <span className="text-slate-300 hidden sm:inline">|</span>
              {/* Compact time on mobile, full with seconds on sm+ */}
              <span className="font-mono font-bold text-slate-900 tracking-tight text-[11px] sm:hidden">
                {formattedTimeCompact}
              </span>
              <span className="font-mono font-bold text-slate-900 tracking-wide text-xs hidden sm:inline">
                {formattedTimeFull}
              </span>
            </div>
          </div>

          {/* Right: Online/Offline Badge + Language Toggle + User Avatar Dropdown */}
          <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
            {/* On header left side of Online/Offline capsule: Write queue pending when offline or pending exists */}
            {(!isOnline || pendingCount > 0) && (
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncing}
                title={lang === 'ta' ? 'கிளிக் செய்து பதிவுகளைக் காணவும் / ஒத்திசைக்கவும்' : 'Click to inspect pending queue or sync'}
                className="text-[10px] sm:text-[11px] font-black px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl shadow-2xs transition-all text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 cursor-pointer active:scale-95"
              >
                {isSyncing ? (lang === 'ta' ? 'ஒத்திசைகிறது...' : 'Syncing...') : `${pendingCount} Pending`}
              </button>
            )}

            {/* Real Network Status Badge (Unclickable - solely reflects actual network connection) */}
            <div
              className={`inline-flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-xs font-bold shadow-2xs select-none cursor-default ${
                !isOnline
                  ? 'bg-rose-50 text-rose-800 border border-rose-300'
                  : 'bg-emerald-50 text-emerald-900 border border-emerald-300'
              }`}
              title={!isOnline ? (lang === 'ta' ? 'இணையத் தொடர்பு இல்லை' : 'Offline - No Internet Connection') : (lang === 'ta' ? 'இணையத் தொடர்பு உள்ளது' : 'Online - Connected')}
            >
              {!isOnline ? (
                <>
                  <WifiOff className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-600 shrink-0" />
                  <span className="text-[10px] sm:text-[11px] font-black">
                    {lang === 'ta' ? 'இணைப்பில்லை' : 'OFFLINE'}
                  </span>
                </>
              ) : (
                <>
                  <Wifi className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600 shrink-0" />
                  <span className="text-[10px] sm:text-[11px] font-black text-emerald-800">
                    {lang === 'ta' ? 'இணைப்பில்' : 'ONLINE'}
                  </span>
                </>
              )}
            </div>

            {/* Language Toggle (தமிழ் / EN) */}
            <button
              type="button"
              onClick={handleToggleLanguage}
              className="inline-flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all shadow-2xs"
              title="Switch Language / மொழியை மாற்றவும்"
            >
              <Languages className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-600 shrink-0" />
              <span className="text-[10px] sm:text-[11px] font-black">{lang === 'ta' ? 'தமிழ்' : 'EN'}</span>
            </button>

            {/* User Profile Avatar with Dropdown */}
            {user && (
              <div className="flex items-center gap-1.5 sm:gap-3 pl-1 sm:pl-2 border-l border-slate-200">
                <div className="text-right hidden md:block">
                  <div className="text-xs font-bold text-slate-800 truncate max-w-[140px]">
                    {user.name}
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    {translateRole(user.role, lang)} {user.buyer?.code ? `• ${user.buyer.code}` : ''}
                  </div>
                </div>

                <UserMenuDropdown />
              </div>
            )}
          </div>
        </header>

        {/* Scrollable Content Container (Smooth, Responsive, Fits any screen) */}
        <main className="flex-1 overflow-y-auto w-full smooth-scroll">
          <div className="p-3 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            <Outlet />
          </div>
        </main>

        {/* Global Offline Queue Drawer (Accessible from any page via Pending pill) */}
        <OfflineQueueDrawer
          isOpen={isQueueDrawerOpen}
          onClose={() => {
            setIsQueueDrawerOpen(false);
            refreshPending();
          }}
          lang={lang}
        />
      </div>
    </div>
  );
};
