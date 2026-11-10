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
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../features/auth/authStore';
import { BuyerProductRequest } from '../types';
import { apiRequest } from '../services/api';
import { ProductRequestReviewModal } from '../features/orders/ProductRequestReviewModal';

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
    title: 'Daily Line Target Updated',
    message: 'Shift production target initialized. Log good output and operator tallies before 6:00 PM cutoff.',
    timestamp: '10 mins ago',
    type: 'info',
    read: false,
    link: '/supervisor/my-work',
    targetRole: ['SUPERVISOR', 'ADMIN'],
  },
  {
    id: 'notif-2',
    title: 'Machine Maintenance Clearance',
    message: 'Maintenance team cleared stitching and assembly lines. Operations running at normal capacity.',
    timestamp: '45 mins ago',
    type: 'success',
    read: false,
    link: '/supervisor/my-work',
    targetRole: ['SUPERVISOR', 'ADMIN'],
  },
  // Merchandiser scoped
  {
    id: 'notif-3',
    title: 'Buyer Portal Activity',
    message: 'Buyer partner reviewed active milestone progress and approved current shipment timelines.',
    timestamp: '1 hour ago',
    type: 'info',
    read: false,
    link: '/risk',
    targetRole: ['MERCHANDISER', 'ADMIN'],
  },
  {
    id: 'notif-4',
    title: 'Throughput Deficit Alert',
    message: 'Active stage pace alert flagged in Risk Engine. Check Show-Your-Math breakdown for recommended pacing.',
    timestamp: '3 hours ago',
    type: 'alert',
    read: false,
    link: '/risk',
    targetRole: ['MERCHANDISER', 'ADMIN'],
  },
  // Buyer scoped
  {
    id: 'notif-5',
    title: 'Milestone Progress Update',
    message: 'Verified stage output pass recorded by factory merchandiser. Inspection photos updated in portal.',
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

  // Active Pending Buyer Sourcing Requests (for Merchandiser & Admin)
  const [pendingRequests, setPendingRequests] = useState<BuyerProductRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<BuyerProductRequest | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  const fetchPendingRequests = async () => {
    if (user?.role === 'MERCHANDISER' || user?.role === 'ADMIN') {
      try {
        const res = await apiRequest<{ success: boolean; data: BuyerProductRequest[] }>(
          '/orders/product-requests?status=PENDING'
        );
        setPendingRequests(res.data || []);
      } catch {
        // Non-blocking
      }
    } else {
      setPendingRequests([]);
    }
  };

  useEffect(() => {
    fetchPendingRequests();
    const interval = setInterval(fetchPendingRequests, 15000);
    return () => clearInterval(interval);
  }, [user?.role]);

  const unreadCount = scopedNotifications.filter((n) => !n.read).length;
  const totalUnreadCount = unreadCount + pendingRequests.length;

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
        {totalUnreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white ring-2 ring-white animate-pulse">
            {totalUnreadCount}
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
              {totalUnreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  {totalUnreadCount} new
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
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Scoped Notification List & Buyer Sourcing Requests */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 smooth-scroll">
            {/* Top Priority Section: Pending Buyer Product Sourcing Requests */}
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                onClick={() => {
                  setSelectedRequest(req);
                  setIsReviewModalOpen(true);
                  setIsOpen(false);
                }}
                className="p-3.5 bg-amber-50/90 hover:bg-amber-100 border-l-4 border-amber-500 cursor-pointer transition-colors relative"
              >
                <div className="flex items-start gap-2.5">
                  <div className="shrink-0 mt-0.5 w-6 h-6 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center shadow-xs">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-black text-amber-950 truncate">
                        {req.styleName}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-600 text-white uppercase tracking-wider animate-pulse shrink-0">
                        IMPORTANT
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-700 mt-0.5 line-clamp-2 leading-snug">
                      <strong>{req.buyer?.name || 'Buyer Partner'}</strong> requested{' '}
                      <strong>{req.targetQuantity.toLocaleString()} pcs</strong> • Target Ex-Factory:{' '}
                      {new Date(req.targetExFactoryDate).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-amber-800">
                      <span>Click to view details & create order</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {scopedNotifications.length === 0 && pendingRequests.length === 0 ? (
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

      {/* Review Modal for Buyer Product Sourcing Requests */}
      {selectedRequest && (
        <ProductRequestReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          request={selectedRequest}
          onRequestStatusUpdated={fetchPendingRequests}
          onGoForward={(req) => {
            setIsReviewModalOpen(false);
            sessionStorage.setItem('tf_pending_request_to_order', JSON.stringify(req));
            window.dispatchEvent(
              new CustomEvent('threadflow:open_order_with_request', { detail: req })
            );
            navigate('/orders');
          }}
        />
      )}
    </div>
  );
};
