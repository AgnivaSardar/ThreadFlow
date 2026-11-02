import {
  enqueuePendingUpdate,
  getPendingQueueCount,
  getAllPendingUpdates,
  PendingUpdateRecord,
} from '../db';
import { compressImage } from '../compression';

const OFFLINE_SIMULATION_KEY = 'threadflow_offline_simulated';

/**
 * Generate RFC4122 version 4 compliant UUID
 */
export function generateUUIDv4(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Check if reviewer has manually simulated offline mode
 */
export function isOfflineSimulated(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(OFFLINE_SIMULATION_KEY) === 'true';
}

/**
 * Set reviewer simulation state and notify app components
 */
export function setOfflineSimulated(simulated: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(OFFLINE_SIMULATION_KEY, simulated ? 'true' : 'false');
  window.dispatchEvent(
    new CustomEvent('threadflow-network-change', {
      detail: { isOnline: isEffectiveOnline(), isSimulated: simulated },
    })
  );
}

/**
 * Effective network status considering browser status AND reviewer simulation switch
 */
export function isEffectiveOnline(): boolean {
  if (typeof window === 'undefined') return true;
  if (isOfflineSimulated()) return false;
  return navigator.onLine;
}

export interface EnqueueFloorParams {
  orderId: string;
  poNumber: string;
  style: string;
  milestoneId: string;
  stage: string;
  shift: 'DAY' | 'NIGHT';
  machineLine?: string | null;
  goodQty: number;
  rejectedQty: number;
  notes?: string | null;
  issueCategory?: string | null;
  photoFile?: File | null;
  clientEventAt?: string;
}

/**
 * Memory-safe enqueuing: compresses photo to WebP/JPEG Blob, generates UUIDv4, and persists in IndexedDB.
 */
export async function enqueueFloorUpdate(params: EnqueueFloorParams): Promise<PendingUpdateRecord> {
  const idempotencyKey = generateUUIDv4();
  const clientEventAt = params.clientEventAt || new Date().toISOString();

  // Compress photo client-side if attached (clamped to 1024px, ~85 KB)
  let photoBlob: Blob | null = null;
  if (params.photoFile) {
    try {
      photoBlob = await compressImage(params.photoFile, 1024, 0.72);
    } catch (err) {
      console.warn('[Queue] Photo compression failed, enqueuing without photo:', err);
    }
  }

  const record: PendingUpdateRecord = {
    idempotencyKey,
    orderId: params.orderId,
    poNumber: params.poNumber,
    style: params.style,
    milestoneId: params.milestoneId,
    stage: params.stage,
    shift: params.shift,
    machineLine: params.machineLine || null,
    goodQty: params.goodQty,
    rejectedQty: params.rejectedQty,
    notes: params.notes || null,
    issueCategory: params.issueCategory || null,
    photoBlob,
    clientEventAt,
    status: 'QUEUED',
    retryCount: 0,
    createdAt: Date.now(),
  };

  await enqueuePendingUpdate(record);

  // Notify header pills and UI badges
  window.dispatchEvent(
    new CustomEvent('threadflow-queue-changed', {
      detail: { idempotencyKey, orderId: params.orderId, count: await getPendingQueueCount() },
    })
  );

  return record;
}

/**
 * Get count of pending offline updates
 */
export async function getPendingOfflineCount(): Promise<number> {
  return getPendingQueueCount();
}

/**
 * Get all pending queue records
 */
export async function getPendingQueueList(): Promise<PendingUpdateRecord[]> {
  return getAllPendingUpdates();
}
