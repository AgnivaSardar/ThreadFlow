import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Check,
  Trash2,
  X,
  ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../features/auth/authStore';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'alert' | 'info' | 'success';
  read: boolean;
  link?: string;
  targetRole: string[];
}

const DEFAULT_NOTIFICATIONS: AppNotification[] = [
  // Supervisor scoped
  {
    id: 'notif-1',
    title: 'Line 1 Target Updated',
    message: 'Knitting quota for B-PO-88213 is set to 500 pcs today. Buffer remaining: 2 days.',
    timestamp: '10 mins ago',
    type: 'info',
    read: false,
    link: '/supervisor/my-work',
    targetRole: ['SUPERVISOR', 'ADMIN'],
  },
  {
    id: 'notif-2',
    title: 'Machine Alert: Line 2 Motor Inspected',
    message: 'Maintenance team cleared stitching line 2 motor. Running at 100% capacity.',
    timestamp: '45 mins ago',
    type: 'success',
    read: false,
    link: '/supervisor/my-work',
    targetRole: ['SUPERVISOR', 'ADMIN'],
  },
  // Merchandiser scoped
  {
    id: 'notif-3',
    title: 'Buyer Feedback Received',
    message: 'Sarah Jenkins (Company B UK) approved revised shipment buffer for B-PO-88213.',
    timestamp: '1 hour ago',
    type: 'info',
    read: false,
    link: '/risk',
    targetRole: ['MERCHANDISER', 'ADMIN'],
  },
  {
    id: 'notif-4',
    title: 'Critical Buffer Alert',
    message: 'B-PO-88260 Mercerized Cotton Tee consumed 1.5 days buffer in Knitting stage.',
    timestamp: '3 hours ago',
    type: 'alert',
    read: false,
    link: '/orders',
    targetRole: ['MERCHANDISER', 'ADMIN'],
  },
  // Buyer scoped
  {
    id: 'notif-5',
    title: 'Production Milestone Complete',
    message: 'Finishing & Packing completed for Waffle Knit Henley (B-PO-88272). Ready for carton loading.',
    timestamp: '2 hours ago',
    type: 'success',
    read: false,
    link: '/buyer-portal',
    targetRole: ['BUYER', 'ADMIN'],
  },
  {
    id: 'notif-6',
    title: 'Weekly Compliance Report Published',
    message: 'CW 45 factory throughput and quality audit report is now accessible for review.',
    timestamp: 'Yesterday',
    type: 'info',
    read: true,
    link: '/reports',
    targetRole: ['BUYER', 'MERCHANDISER', 'ADMIN'],
  },
];

export const NotificationPopover: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Local storage persistence keyed by user role/email
  const storageKey = `threadflow_notifs_${user?.email || 'default'}`;

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return DEFAULT_NOTIFICATIONS;
  });

  // Filter scoped to this particular user's role
  const scopedNotifications = notifications.filter((n) =>
    user?.role ? n.targetRole.includes(user.role) : true
  );

  const unreadCount = scopedNotifications.filter((n) => !n.read).length;

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(notifications));
  }, [notifications, storageKey]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Mark all as read
  const markAllAsRead = () => {
    setNotifications((prev) =>
      prev.map((n) =>
        user?.role && n.targetRole.includes(user.role) ? { ...n, read: true } : n
      )
    );
  };

  // Mark single as read & navigate
  const handleItemClick = (item: AppNotification) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
    );
    if (item.link) {
      navigate(item.link);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all active:scale-95 cursor-pointer shadow-2xs"
        aria-label="User Notifications"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white ring-2 ring-white animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="p-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-[11px] font-semibold text-sky-700 hover:text-sky-900 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3 h-3" />
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Scoped Notification List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 smooth-scroll">
            {scopedNotifications.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                No notifications for your account.
              </div>
            ) : (
              scopedNotifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                    n.read ? 'bg-white hover:bg-slate-50' : 'bg-sky-50/50 hover:bg-sky-50'
                  }`}
                >
                  <div className="shrink-0 mt-0.5">
                    {n.type === 'alert' && (
                      <div className="w-6 h-6 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </div>
                    )}
                    {n.type === 'success' && (
                      <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                    )}
                    {n.type === 'info' && (
                      <div className="w-6 h-6 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center">
                        <Info className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-xs font-bold truncate ${n.read ? 'text-slate-800' : 'text-slate-900'}`}>
                        {n.title}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {n.timestamp}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5 leading-snug">
                      {n.message}
                    </p>
                  </div>

                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-sky-600 shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
            <span className="text-[10px] text-slate-400">
              Filtered for {user?.name} ({user?.role})
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
