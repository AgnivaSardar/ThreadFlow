import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  X,
  HardDrive,
  Wifi,
  WifiOff,
  CheckCircle2,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import {
  getAllPendingUpdates,
  resetPendingStatus,
  PendingUpdateRecord,
  getStorageQuotaInfo,
  StorageQuotaInfo,
} from '../offline/db';
import { discardOfflineUpdate } from '../offline/queue/queue';
import { syncOfflineQueue } from '../offline/sync/sync';
import { SUPERVISOR_I18N } from '../features/supervisor/supervisorTranslations';

interface OfflineQueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'ta' | 'en';
}

export const OfflineQueueDrawer: React.FC<OfflineQueueDrawerProps> = ({
  isOpen,
  onClose,
  lang,
}) => {
  const t = SUPERVISOR_I18N[lang];
  const [pendingList, setPendingList] = useState<PendingUpdateRecord[]>([]);
  const [storageQuota, setStorageQuota] = useState<StorageQuotaInfo | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  const loadList = useCallback(async () => {
    try {
      const items = await getAllPendingUpdates();
      setPendingList(items);
      const quota = await getStorageQuotaInfo();
      setStorageQuota(quota);
    } catch (err) {
      console.warn('Failed to load pending queue items:', err);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadList();
    }
  }, [isOpen, loadList]);

  // Sync listener to auto-refresh list
  useEffect(() => {
    const handleSyncEvent = () => {
      if (isOpen) loadList();
    };
    window.addEventListener('threadflow-queue-changed', handleSyncEvent);
    window.addEventListener('threadflow-queue-synced', handleSyncEvent);
    return () => {
      window.removeEventListener('threadflow-queue-changed', handleSyncEvent);
      window.removeEventListener('threadflow-queue-synced', handleSyncEvent);
    };
  }, [isOpen, loadList]);

  if (!isOpen) return null;

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      await syncOfflineQueue(true);
      await loadList();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDiscardRecord = async (idempotencyKey: string) => {
    if (window.confirm(t.discardConfirm)) {
      await discardOfflineUpdate(idempotencyKey);
      await loadList();
      window.dispatchEvent(
        new CustomEvent('threadflow-queue-changed', { detail: { count: (await getAllPendingUpdates()).length } })
      );
    }
  };

  const handleDiscardAll = async () => {
    const confirmMsg =
      lang === 'ta'
        ? 'அனைத்து நிலுவைப் பதிவுகளையும் நீக்க விரும்புகிறீர்களா? இது மீட்கப்படாது.'
        : 'Are you sure you want to discard all pending offline updates? This cannot be undone.';
    if (window.confirm(confirmMsg)) {
      for (const item of pendingList) {
        await discardOfflineUpdate(item.idempotencyKey);
      }
      await loadList();
      window.dispatchEvent(
        new CustomEvent('threadflow-queue-changed', { detail: { count: 0 } })
      );
      onClose();
    }
  };

  const handleRetryRecord = async (idempotencyKey: string) => {
    await resetPendingStatus(idempotencyKey);
    await handleSyncAll();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-6 animate-in fade-in">
      <div className="w-full max-w-2xl bg-slate-50 rounded-2xl sm:rounded-3xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 animate-in zoom-in-95">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-50 border border-sky-200 text-sky-700">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">
                  {t.queueDrawerTitle}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                  {pendingList.length}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {t.queueDrawerSubtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Storage and Network Telemetry Bar */}
        <div className="px-4 sm:px-5 py-2.5 bg-slate-100/80 border-b border-slate-200/80 flex items-center justify-between text-xs flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <HardDrive className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-600 font-medium">
              {t.storageUsage}:{' '}
              <span className="font-bold text-slate-800">
                {storageQuota ? storageQuota.usedLabel : '~120 KB'}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {!isOnline ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                <WifiOff className="w-3 h-3 text-rose-600" />
                <span>{t.networkQualityOffline}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <Wifi className="w-3 h-3 text-emerald-600" />
                <span>{t.networkQualityFast}</span>
              </span>
            )}
          </div>
        </div>

        {/* Item List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {pendingList.length === 0 ? (
            <div className="py-14 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="text-sm font-bold text-slate-700">
                {t.noPendingItems}
              </p>
            </div>
          ) : (
            pendingList.map((item) => {
              const isSyncingItem = item.status === 'SYNCING';
              const isErrorItem = item.status === 'ERROR';

              return (
                <div
                  key={item.idempotencyKey}
                  className={`bg-white rounded-xl p-4 border transition-all shadow-xs ${
                    isErrorItem
                      ? 'border-rose-300 bg-rose-50/30'
                      : isSyncingItem
                      ? 'border-blue-300 ring-2 ring-blue-100'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-800 font-mono">
                          #{item.poNumber || item.orderId.substring(0, 8)}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          • {item.style}
                        </span>
                        <span className="text-[11px] font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                          {item.stage}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-600">
                        <span>
                          {lang === 'ta' ? 'நல்ல துண்டுகள்' : 'Good pcs'}:{' '}
                          <strong className="text-emerald-700 font-bold">
                            {item.goodQty} pcs
                          </strong>
                        </span>
                        {item.rejectedQty > 0 && (
                          <span>
                            {lang === 'ta' ? 'நிராகரிக்கப்பட்டவை' : 'Rejected'}:{' '}
                            <strong className="text-rose-700 font-bold">
                              {item.rejectedQty} pcs
                            </strong>
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-slate-400">
                          <Clock className="w-3 h-3" />
                          {new Date(item.clientEventAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {item.notes && (
                        <p className="mt-1 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">
                          "{item.notes}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isErrorItem && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          <AlertTriangle className="w-3 h-3" />
                          <span>{t.statusError}</span>
                        </span>
                      )}
                      {isSyncingItem && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 animate-pulse border border-blue-300">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>{t.statusSyncing}</span>
                        </span>
                      )}
                      {!isErrorItem && !isSyncingItem && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          <span>{t.statusQueued}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Error Banner with detailed server rejection cause */}
                  {isErrorItem && item.lastError && (
                    <div className="mt-2.5 p-2.5 bg-rose-100/80 border border-rose-300 rounded-lg text-xs font-semibold text-rose-900 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-bold text-rose-950">
                          {lang === 'ta' ? 'சர்வர் நிராகரிப்பு விவரம்:' : 'Server Validation Rejection:'}
                        </p>
                        <p className="mt-0.5">{item.lastError}</p>
                      </div>
                    </div>
                  )}

                  {/* Actions for Item */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-end gap-2">
                    {isErrorItem && (
                      <button
                        type="button"
                        onClick={() => handleRetryRecord(item.idempotencyKey)}
                        disabled={isSyncing || !isOnline}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-sky-700 hover:text-sky-900 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>{t.retryRecord}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDiscardRecord(item.idempotencyKey)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-rose-700 hover:text-rose-900 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3 text-rose-500" />
                      <span>{t.discardRecord}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              {t.close}
            </button>
            {pendingList.length > 0 && (
              <button
                type="button"
                onClick={handleDiscardAll}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-rose-700 hover:text-rose-900 hover:bg-rose-50 border border-rose-200 rounded-xl transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{lang === 'ta' ? 'அனைத்தையும் நீக்கு' : 'Discard All'}</span>
              </button>
            )}
          </div>

          {pendingList.length > 0 && isOnline && (
            <button
              type="button"
              onClick={handleSyncAll}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{t.syncAllNow}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
