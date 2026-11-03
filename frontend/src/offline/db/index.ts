/**
 * Native IndexedDB Store: `pending_updates`
 * ThreadFlow Offline Production Intelligence
 * 
 * Stores un-synced floor updates with binary photo blobs directly in IndexedDB.
 * Zero main-thread blocking, handles low-memory budgets without OOM crashes.
 */

import { formatByteSize } from '../compression';

export type PendingUpdateStatus = 'QUEUED' | 'SYNCING' | 'SYNCED' | 'ERROR';

export interface PendingUpdateRecord {
  idempotencyKey: string; // RFC4122 UUIDv4
  orderId: string;
  milestoneId: string;
  goodQty: number;
  rejectedQty: number;
  notes?: string | null;
  photoBlob?: Blob | null; // Stored as native binary Blob (saves 33% memory over base64)
  clientEventAt: string; // ISO-8601 floor timestamp
  status: PendingUpdateStatus;
  retryCount: number;
  lastError?: string | null;
  createdAt: number;

  // Auxiliary fields for rich floor UI cards & supervisor visibility
  poNumber: string;
  style: string;
  stage: string;
  shift: 'DAY' | 'NIGHT';
  machineLine?: string | null;
  issueCategory?: string | null;
  sizeBreakdownLines?: {
    orderLineId: string;
    goodQuantity: number;
    rejectedQuantity: number;
  }[];
}

export interface StorageQuotaInfo {
  usedBytes: number;
  quotaBytes: number;
  percentUsed: number;
  isLowStorage: boolean;
  usedLabel: string;
  quotaLabel: string;
}

const DB_NAME = 'threadflow_offline_store';
const DB_VERSION = 2; // Incremented for pending_updates schema
export const STORE_NAME = 'pending_updates';
export const CACHE_STORE = 'cached_supervisor_work';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Primary Offline Queue Store
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'idempotencyKey',
        });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('orderId', 'orderId', { unique: false });
      }

      // Cached Supervisor Work Store (for offline floor bootstrap)
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: 'cacheKey' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

/**
 * Enqueue a new floor update into IndexedDB `pending_updates`
 */
export async function enqueuePendingUpdate(item: PendingUpdateRecord): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(item);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('Failed to enqueue pending update'));
  });
}

/**
 * Retrieve all records from `pending_updates`
 */
export async function getAllPendingUpdates(): Promise<PendingUpdateRecord[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error || new Error('Failed to fetch pending updates'));
  });
}

/**
 * Update status and retry counters for a specific record
 */
export async function updatePendingStatus(
  idempotencyKey: string,
  status: PendingUpdateStatus,
  errorMsg?: string | null
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(idempotencyKey);

    getReq.onsuccess = () => {
      const record: PendingUpdateRecord | undefined = getReq.result;
      if (!record) return resolve();

      record.status = status;
      if (status === 'ERROR') {
        record.retryCount = (record.retryCount || 0) + 1;
        record.lastError = errorMsg || 'Unknown sync error';
      } else if (status === 'SYNCING') {
        record.lastError = null;
      }

      const putReq = store.put(record);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Reset pending record back to QUEUED for retry
 */
export async function resetPendingStatus(idempotencyKey: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(idempotencyKey);

    getReq.onsuccess = () => {
      const record: PendingUpdateRecord | undefined = getReq.result;
      if (!record) return resolve();

      record.status = 'QUEUED';
      record.lastError = null;

      const putReq = store.put(record);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Remove record on successful synchronization (HTTP 200/201) or discard
 */
export async function removePendingUpdate(idempotencyKey: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(idempotencyKey);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('Failed to remove pending update'));
  });
}

/**
 * Alias for explicit user discard action
 */
export async function deletePendingUpdate(idempotencyKey: string): Promise<void> {
  return removePendingUpdate(idempotencyKey);
}

/**
 * Get count of pending items waiting to sync
 */
export async function getPendingQueueCount(): Promise<number> {
  try {
    const items = await getAllPendingUpdates();
    return items.filter((i) => i.status === 'QUEUED' || i.status === 'ERROR' || i.status === 'SYNCING').length;
  } catch {
    return 0;
  }
}

/**
 * Query browser storage quota and memory usage estimate
 */
export async function getStorageQuotaInfo(): Promise<StorageQuotaInfo | null> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const percentUsed = quota > 0 ? Math.round((used / quota) * 100) : 0;
      return {
        usedBytes: used,
        quotaBytes: quota,
        percentUsed,
        isLowStorage: percentUsed > 85,
        usedLabel: formatByteSize(used),
        quotaLabel: formatByteSize(quota),
      };
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Cache supervisor work orders for zero-network bootstrap
 */
export async function cacheSupervisorWork(cacheKey: string, data: any): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readwrite');
      const store = tx.objectStore(CACHE_STORE);
      const req = store.put({ cacheKey, data, cachedAt: Date.now() });

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to cache supervisor work in IndexedDB:', err);
  }
}

/**
 * Retrieve cached supervisor work orders from IndexedDB
 */
export async function getCachedSupervisorWork(cacheKey: string): Promise<any | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readonly');
      const store = tx.objectStore(CACHE_STORE);
      const req = store.get(cacheKey);

      req.onsuccess = () => resolve(req.result?.data || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/**
 * Apply optimistic update to local cached work data for 0ms floor latency
 */
export async function applyOptimisticFloorUpdate(
  cacheKey: string,
  update: {
    orderId: string;
    goodQty: number;
    rejectedQty: number;
    sizeBreakdownLines?: { orderLineId: string; goodQuantity: number }[];
  }
): Promise<any | null> {
  try {
    const cached = await getCachedSupervisorWork(cacheKey);
    if (!cached || !Array.isArray(cached.orders)) return null;

    const order = cached.orders.find((o: any) => o.orderId === update.orderId);
    if (order && order.activeMilestone) {
      order.activeMilestone.completedQuantity += update.goodQty;
      order.activeMilestone.remainingQuantity = Math.max(
        0,
        order.activeMilestone.targetQuantity - order.activeMilestone.completedQuantity
      );
      order.activeMilestone.progressPct = Math.min(
        100,
        Math.round(
          (order.activeMilestone.completedQuantity /
            Math.max(1, order.activeMilestone.targetQuantity)) *
            100
        )
      );

      // Optimistically update order lines if size breakdown provided
      if (update.sizeBreakdownLines && Array.isArray(order.orderLines)) {
        update.sizeBreakdownLines.forEach((line) => {
          const matchLine = order.orderLines.find((ol: any) => ol.id === line.orderLineId);
          if (matchLine) {
            matchLine.completedQty += line.goodQuantity;
          }
        });
      }

      // Mark order with optimistic sync indicator
      order.hasOptimisticPending = true;
      order.optimisticPendingQty = (order.optimisticPendingQty || 0) + update.goodQty;

      await cacheSupervisorWork(cacheKey, cached);
      return cached;
    }
    return cached;
  } catch (err) {
    console.warn('[DB] Failed to apply optimistic update:', err);
    return null;
  }
}
