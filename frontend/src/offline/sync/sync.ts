import { apiRequest } from '../../services/api';
import {
  getAllPendingUpdates,
  removePendingUpdate,
  updatePendingStatus,
  PendingUpdateRecord,
} from '../db';
import { isEffectiveOnline } from '../queue/queue';
import { blobToBase64 } from '../compression';

export interface SyncResult {
  total: number;
  synced: number;
  failed: number;
  errors: string[];
}

export interface NetworkQuality {
  isOnline: boolean;
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g' | 'unknown';
  isWeakSignal: boolean;
  downlinkMb?: number;
  rttMs?: number;
}

let isSyncing = false;
let autoRetryTimer: any = null;

/**
 * Determine network quality using Network Information API
 */
export function getNetworkQuality(): NetworkQuality {
  const isOnline = isEffectiveOnline();
  const conn =
    typeof navigator !== 'undefined'
      ? (navigator as any).connection ||
        (navigator as any).mozConnection ||
        (navigator as any).webkitConnection
      : null;

  if (!conn) {
    return {
      isOnline,
      effectiveType: 'unknown',
      isWeakSignal: false,
    };
  }

  const effectiveType = conn.effectiveType || '4g';
  const isWeakSignal = isOnline && (effectiveType === 'slow-2g' || effectiveType === '2g');

  return {
    isOnline,
    effectiveType,
    isWeakSignal,
    downlinkMb: conn.downlink,
    rttMs: conn.rtt,
  };
}

/**
 * Audio chime synthesizer for low-end mobile devices (Web Audio API)
 */
function playSyncSuccessChime() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Ignore audio errors on unsupported environments
  }
}

/**
 * Multi-pattern haptic pulse for floor supervisors
 */
function triggerSyncHaptics() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([45, 40, 45]);
    } catch {
      // Haptics not allowed
    }
  }
}

/**
 * Process a single offline record to the server
 */
async function syncSingleRecord(item: PendingUpdateRecord): Promise<{ success: boolean; error?: string }> {
  await updatePendingStatus(item.idempotencyKey, 'SYNCING');

  let photoBase64: string | null = null;
  if (item.photoBlob) {
    try {
      photoBase64 = await blobToBase64(item.photoBlob);
    } catch (convErr) {
      console.warn('[Sync] Failed to convert photo blob:', convErr);
    }
  }

  const payload = {
    idempotencyKey: item.idempotencyKey,
    orderId: item.orderId,
    milestoneId: item.milestoneId,
    stage: item.stage,
    shift: item.shift,
    machineLine: item.machineLine || null,
    goodQuantity: item.goodQty,
    rejectedQuantity: item.rejectedQty,
    notes: item.notes || null,
    issueCategory: item.issueCategory || null,
    compressedPhotoBase64: photoBase64,
    clientEventAt: item.clientEventAt,
    sizeBreakdownLines: item.sizeBreakdownLines,
  };

  try {
    await apiRequest('/production/updates', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    await removePendingUpdate(item.idempotencyKey);
    return { success: true };
  } catch (err: any) {
    const errorMsg = err.message || 'Synchronization failure';
    console.error(`[Sync] Failed to sync update ${item.idempotencyKey}:`, err);
    await updatePendingStatus(item.idempotencyKey, 'ERROR', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Flush all queued updates from IndexedDB `pending_updates` to the server.
 * Prioritizes bulk batch ingestion (`POST /production/updates/bulk`) to minimize network roundtrips.
 */
export async function syncOfflineQueue(): Promise<SyncResult> {
  const result: SyncResult = {
    total: 0,
    synced: 0,
    failed: 0,
    errors: [],
  };

  if (isSyncing) {
    return result;
  }

  if (!isEffectiveOnline()) {
    return result;
  }

  const items = await getAllPendingUpdates();
  const pendingItems = items.filter(
    (i) => i.status === 'QUEUED' || i.status === 'ERROR'
  );

  if (pendingItems.length === 0) {
    return result;
  }

  isSyncing = true;
  result.total = pendingItems.length;

  // Optimization: If multiple items exist, use the Bulk Batch Ingestion endpoint
  if (pendingItems.length > 1) {
    try {
      const bulkPayload = await Promise.all(
        pendingItems.map(async (item) => {
          let photoBase64: string | null = null;
          if (item.photoBlob) {
            try {
              photoBase64 = await blobToBase64(item.photoBlob);
            } catch (convErr) {
              console.warn('[Sync] Failed to convert photo blob:', convErr);
            }
          }
          return {
            idempotencyKey: item.idempotencyKey,
            orderId: item.orderId,
            milestoneId: item.milestoneId,
            stage: item.stage,
            shift: item.shift,
            machineLine: item.machineLine || null,
            goodQuantity: item.goodQty,
            rejectedQuantity: item.rejectedQty,
            notes: item.notes || null,
            issueCategory: item.issueCategory || null,
            compressedPhotoBase64: photoBase64,
            clientEventAt: item.clientEventAt,
            sizeBreakdownLines: item.sizeBreakdownLines,
          };
        })
      );

      const bulkRes = await apiRequest<{
        data: {
          total: number;
          processed: number;
          duplicates: number;
          failed: number;
          errors: { index: number; idempotencyKey: string; error: string }[];
        };
      }>('/production/updates/bulk', {
        method: 'POST',
        body: JSON.stringify({ updates: bulkPayload }),
      });

      const errorKeys = new Set(bulkRes.data.errors.map((e) => e.idempotencyKey));

      for (const item of pendingItems) {
        if (errorKeys.has(item.idempotencyKey)) {
          const errObj = bulkRes.data.errors.find((e) => e.idempotencyKey === item.idempotencyKey);
          await updatePendingStatus(item.idempotencyKey, 'ERROR', errObj?.error);
          result.failed++;
          if (errObj?.error) result.errors.push(errObj.error);
        } else {
          await removePendingUpdate(item.idempotencyKey);
          result.synced++;
        }
      }

      isSyncing = false;

      window.dispatchEvent(
        new CustomEvent('threadflow-queue-synced', {
          detail: result,
        })
      );

      if (result.synced > 0) {
        playSyncSuccessChime();
        triggerSyncHaptics();
      }

      return result;
    } catch (bulkErr) {
      console.warn('[Sync] Bulk sync endpoint failed, falling back to concurrent worker:', bulkErr);
    }
  }

  // Fallback: Concurrency-clamped individual requests
  const CONCURRENCY_LIMIT = 2;
  const queue = [...pendingItems];

  const workers = Array.from({ length: Math.min(CONCURRENCY_LIMIT, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;

      const res = await syncSingleRecord(item);
      if (res.success) {
        result.synced++;
      } else {
        result.failed++;
        if (res.error) result.errors.push(res.error);
      }
    }
  });

  await Promise.all(workers);

  isSyncing = false;

  window.dispatchEvent(
    new CustomEvent('threadflow-queue-synced', {
      detail: result,
    })
  );

  if (result.synced > 0) {
    playSyncSuccessChime();
    triggerSyncHaptics();
  }

  if (result.failed > 0 && isEffectiveOnline()) {
    if (autoRetryTimer) clearTimeout(autoRetryTimer);
    const delay = Math.min(30000, 3000 * Math.pow(1.8, Math.min(4, result.failed)));
    autoRetryTimer = setTimeout(() => {
      if (isEffectiveOnline()) {
        syncOfflineQueue();
      }
    }, delay);
  }

  return result;
}

/**
 * Register automatic background sync listeners and network quality changes
 */
export function registerOfflineSyncListeners(): () => void {
  const handleOnline = () => {
    if (isEffectiveOnline()) {
      syncOfflineQueue();
    }
  };

  const handleCustomNetwork = (e: any) => {
    if (e.detail?.isOnline) {
      syncOfflineQueue();
    }
  };

  const handleConnChange = () => {
    window.dispatchEvent(
      new CustomEvent('threadflow-quality-changed', {
        detail: getNetworkQuality(),
      })
    );
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('threadflow-network-change', handleCustomNetwork);

  const conn =
    typeof navigator !== 'undefined'
      ? (navigator as any).connection ||
        (navigator as any).mozConnection ||
        (navigator as any).webkitConnection
      : null;

  if (conn && conn.addEventListener) {
    conn.addEventListener('change', handleConnChange);
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('threadflow-network-change', handleCustomNetwork);
    if (conn && conn.removeEventListener) {
      conn.removeEventListener('change', handleConnChange);
    }
    if (autoRetryTimer) {
      clearTimeout(autoRetryTimer);
    }
  };
}
