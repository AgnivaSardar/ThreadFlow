import { apiRequest } from '../../services/api';
import {
  getAllQueueItems,
  removeQueueItem,
  updateQueueStatus,
  QueuedProductionUpdate,
} from '../db';
import { isEffectiveOnline } from '../queue/queue';

export interface SyncResult {
  total: number;
  synced: number;
  failed: number;
  errors: string[];
}

let isSyncing = false;

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

  const items = await getAllQueueItems();
  const pendingItems = items.filter((i) => i.status === 'QUEUED' || i.status === 'FAILED');

  if (pendingItems.length === 0) {
    return result;
  }

  isSyncing = true;
  result.total = pendingItems.length;

  for (const item of pendingItems) {
    try {
      await updateQueueStatus(item.idempotencyKey, 'SYNCING');

      const payload = {
        idempotencyKey: item.idempotencyKey,
        orderId: item.orderId,
        milestoneId: item.milestoneId,
        stage: item.stage,
        shift: item.shift,
        machineLine: item.machineLine,
        goodQuantity: item.goodQuantity,
        rejectedQuantity: item.rejectedQuantity,
        notes: item.notes,
        issueCategory: item.issueCategory,
        compressedPhotoBase64: item.compressedPhotoBase64,
        clientEventAt: item.clientEventAt,
      };

      await apiRequest('/production/updates', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      await removeQueueItem(item.idempotencyKey);
      result.synced++;
    } catch (err: any) {
      console.warn(`Failed to sync update ${item.idempotencyKey}:`, err);
      const errorMsg = err.message || 'Network sync error';
      await updateQueueStatus(item.idempotencyKey, 'FAILED', errorMsg);
      result.failed++;
      result.errors.push(`${item.poNumber} (${item.stage}): ${errorMsg}`);
    }
  }

  isSyncing = false;
  window.dispatchEvent(
    new CustomEvent('threadflow-queue-synced', { detail: result })
  );
  window.dispatchEvent(new CustomEvent('threadflow-queue-changed'));

  return result;
}

export function registerOfflineSyncListeners(): () => void {
  const handleOnline = () => {
    syncOfflineQueue();
  };

  const handleNetworkChange = () => {
    if (isEffectiveOnline()) {
      syncOfflineQueue();
    }
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('threadflow-network-change', handleNetworkChange);

  // Initial check
  if (isEffectiveOnline()) {
    syncOfflineQueue();
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('threadflow-network-change', handleNetworkChange);
  };
}
