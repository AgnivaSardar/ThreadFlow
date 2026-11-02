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

let isSyncing = false;

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
      navigator.vibrate([45, 40, 45]); // double tap feedback
    } catch {
      // Haptics not allowed
    }
  }
}

/**
 * Flush all queued updates from IndexedDB `pending_updates` to the server
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

  for (const item of pendingItems) {
    try {
      await updatePendingStatus(item.idempotencyKey, 'SYNCING');

      // Convert stored Blob to Base64 for the API transport
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
      };

      await apiRequest('/production/updates', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // On HTTP 200/201 (or idempotent replay), remove from queue
      await removePendingUpdate(item.idempotencyKey);
      result.synced++;
    } catch (err: any) {
      console.error(`[Sync] Failed to sync update ${item.idempotencyKey}:`, err);
      const errorMsg = err.message || 'Network synchronization error';
      result.failed++;
      result.errors.push(errorMsg);

      // If business rule violation (e.g. stage tolerance error), mark as ERROR
      await updatePendingStatus(item.idempotencyKey, 'ERROR', errorMsg);
    }
  }

  isSyncing = false;

  // Dispatch queue synced event for UI refresh
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
}

/**
 * Register automatic background sync listeners
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

  window.addEventListener('online', handleOnline);
  window.addEventListener('threadflow-network-change', handleCustomNetwork);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('threadflow-network-change', handleCustomNetwork);
  };
}
