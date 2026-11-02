export interface QueuedProductionUpdate {
  idempotencyKey: string;
  orderId: string;
  poNumber: string;
  style: string;
  milestoneId: string;
  stage: string;
  shift: 'DAY' | 'NIGHT';
  machineLine?: string | null;
  goodQuantity: number;
  rejectedQuantity: number;
  notes?: string | null;
  issueCategory?: string | null;
  compressedPhotoBase64?: string | null;
  clientEventAt: string;
  status: 'QUEUED' | 'SYNCING' | 'FAILED';
  retryCount: number;
  lastError?: string | null;
  createdAt: number;
}

const DB_NAME = 'threadflow_offline_store';
const DB_VERSION = 1;
const QUEUE_STORE = 'production_queue';
const CACHE_STORE = 'cached_supervisor_work';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const queueStore = db.createObjectStore(QUEUE_STORE, {
          keyPath: 'idempotencyKey',
        });
        queueStore.createIndex('status', 'status', { unique: false });
        queueStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: 'cacheKey' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

export async function addQueueItem(item: QueuedProductionUpdate): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE);
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getAllQueueItems(): Promise<QueuedProductionUpdate[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readonly');
    const store = tx.objectStore(QUEUE_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function removeQueueItem(idempotencyKey: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE);
    const req = store.delete(idempotencyKey);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function updateQueueStatus(
  idempotencyKey: string,
  status: 'QUEUED' | 'SYNCING' | 'FAILED',
  lastError?: string
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE);
    const getReq = store.get(idempotencyKey);

    getReq.onsuccess = () => {
      const record = getReq.result as QueuedProductionUpdate | undefined;
      if (!record) return resolve();

      record.status = status;
      if (status === 'FAILED') {
        record.retryCount = (record.retryCount || 0) + 1;
        record.lastError = lastError || null;
      }
      const putReq = store.put(record);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

export async function getPendingQueueCount(): Promise<number> {
  try {
    const items = await getAllQueueItems();
    return items.filter((i) => i.status === 'QUEUED' || i.status === 'FAILED').length;
  } catch {
    return 0;
  }
}

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

export async function getCachedSupervisorWork(cacheKey: string): Promise<any | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readonly');
      const store = tx.objectStore(CACHE_STORE);
      const req = store.get(cacheKey);
      req.onsuccess = () => resolve(req.result ? req.result.data : null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}
