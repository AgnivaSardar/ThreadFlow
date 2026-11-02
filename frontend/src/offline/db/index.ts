/**
 * Native IndexedDB Store: `pending_updates`
 * ThreadFlow Offline Production Intelligence
 * 
 * Stores un-synced floor updates with binary photo blobs directly in IndexedDB.
 * Zero main-thread blocking, handles low-memory budgets without OOM crashes.
 */

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
 * Remove record on successful synchronization (HTTP 200/201)
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
