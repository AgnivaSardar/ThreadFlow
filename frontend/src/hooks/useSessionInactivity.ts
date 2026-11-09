import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuthStore } from '../features/auth/authStore';
import { useNavigate } from 'react-router-dom';

// 30 minutes of inactivity auto-logout
export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

// Show gentle countdown warning 2 minutes before auto-logout (at 28 min mark)
const WARNING_BEFORE_LOGOUT_MS = 2 * 60 * 1000;

// Proactively refresh access token every 10 minutes if user is active on the page
const PROACTIVE_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

// Throttle localStorage writes to once every 5 seconds
const ACTIVITY_THROTTLE_MS = 5 * 1000;

export const useSessionInactivity = () => {
  const { isAuthenticated, logout, refreshSession } = useAuthStore();
  const navigate = useNavigate();

  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(120);

  const lastActivityRef = useRef<number>(Date.now());
  const lastThrottleRef = useRef<number>(0);
  const lastRefreshRef = useRef<number>(Date.now());

  // Record user interaction on the page
  const recordActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;

    // Dismiss warning if visible
    setShowWarning(false);

    // Throttle writing to localStorage to prevent unnecessary disk/CPU operations
    if (now - lastThrottleRef.current > ACTIVITY_THROTTLE_MS) {
      lastThrottleRef.current = now;
      localStorage.setItem('threadflow_last_activity', String(now));
    }
  }, []);

  // Explicitly extend session (e.g. clicking "Stay Logged In")
  const extendSession = useCallback(async () => {
    recordActivity();
    setShowWarning(false);
    try {
      await refreshSession();
      lastRefreshRef.current = Date.now();
    } catch {
      // Ignored: fallback logic in authStore handles failed refresh
    }
  }, [recordActivity, refreshSession]);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Initialize or load stored activity timestamp
    const stored = Number(localStorage.getItem('threadflow_last_activity') || '0');
    const initialTime = stored > 0 ? Math.max(stored, Date.now()) : Date.now();
    lastActivityRef.current = initialTime;
    localStorage.setItem('threadflow_last_activity', String(initialTime));

    // Listen for all common user interaction events across the entire page
    const activityEvents: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'click',
    ];

    const handleUserActivity = () => {
      recordActivity();
    };

    activityEvents.forEach((ev) => {
      window.addEventListener(ev, handleUserActivity, { passive: true });
    });

    // Cross-tab synchronization: if user is active in another tab, update local activity
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'threadflow_last_activity' && e.newValue) {
        const remoteTime = Number(e.newValue);
        if (remoteTime > lastActivityRef.current) {
          lastActivityRef.current = remoteTime;
          setShowWarning(false);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // When tab regains focus or visibility
    const handleFocusOrVisibility = () => {
      if (document.visibilityState === 'visible') {
        const latestStored = Number(localStorage.getItem('threadflow_last_activity') || '0');
        const now = Date.now();
        const effectiveLast = Math.max(lastActivityRef.current, latestStored);

        // Check if 30 minutes elapsed while away
        if (now - effectiveLast >= INACTIVITY_TIMEOUT_MS) {
          logout();
          navigate('/login?reason=inactivity');
        } else {
          // Still within 30 min window: reset activity
          recordActivity();
          // If more than 10 mins since last token refresh, refresh now
          if (now - lastRefreshRef.current >= PROACTIVE_REFRESH_INTERVAL_MS) {
            refreshSession();
            lastRefreshRef.current = now;
          }
        }
      }
    };

    window.addEventListener('focus', handleFocusOrVisibility);
    document.addEventListener('visibilitychange', handleFocusOrVisibility);

    // Heartbeat check every 10 seconds
    const interval = setInterval(() => {
      const now = Date.now();
      const latestStored = Number(localStorage.getItem('threadflow_last_activity') || '0');
      const effectiveLast = Math.max(lastActivityRef.current, latestStored);
      const idleTime = now - effectiveLast;

      // 1. Inactivity reached 30 minutes -> Auto logout
      if (idleTime >= INACTIVITY_TIMEOUT_MS) {
        clearInterval(interval);
        logout();
        navigate('/login?reason=inactivity');
        return;
      }

      // 2. Warning zone: last 2 minutes (28m to 30m idle)
      if (idleTime >= INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_LOGOUT_MS) {
        const remainingMs = INACTIVITY_TIMEOUT_MS - idleTime;
        setSecondsRemaining(Math.max(1, Math.ceil(remainingMs / 1000)));
        setShowWarning(true);
      } else {
        setShowWarning(false);
      }

      // 3. Active session keepalive:
      // If user has been active within the last 15 mins AND 10 mins have passed since last token refresh,
      // silently renew access token in background. This ensures session NEVER ends while user is on the page!
      if (idleTime < 15 * 60 * 1000 && now - lastRefreshRef.current >= PROACTIVE_REFRESH_INTERVAL_MS) {
        refreshSession();
        lastRefreshRef.current = now;
      }
    }, 10000);

    return () => {
      activityEvents.forEach((ev) => {
        window.removeEventListener(ev, handleUserActivity);
      });
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocusOrVisibility);
      document.removeEventListener('visibilitychange', handleFocusOrVisibility);
      clearInterval(interval);
    };
  }, [isAuthenticated, logout, refreshSession, navigate, recordActivity]);

  return {
    showWarning,
    secondsRemaining,
    extendSession,
  };
};
