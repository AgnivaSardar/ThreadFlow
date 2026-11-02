import {
  addQueueItem,
  getAllQueueItems,
  getPendingQueueCount,
  removeQueueItem,
  updateQueueStatus,
  QueuedProductionUpdate,
} from '../db';

/**
 * Generate a cryptographically strong RFC4122 UUID v4 for client idempotency keys.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older Android webviews
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const OFFLINE_SIMULATION_KEY = 'threadflow_offline_simulated';

export function isOfflineSimulated(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(OFFLINE_SIMULATION_KEY) === 'true';
}

export function setOfflineSimulated(simulated: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(OFFLINE_SIMULATION_KEY, simulated ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent('threadflow-network-change', { detail: { simulated } }));
}

export function isEffectiveOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  if (isOfflineSimulated()) return false;
  return navigator.onLine;
}

export interface EnqueueProductionUpdateInput {
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
  clientEventAt?: string;
}

export async function queueProductionUpdate(
  input: EnqueueProductionUpdateInput
): Promise<QueuedProductionUpdate> {
  const item: QueuedProductionUpdate = {
    ...input,
    idempotencyKey: generateUUID(),
    clientEventAt: input.clientEventAt || new Date().toISOString(),
    status: 'QUEUED',
    retryCount: 0,
    createdAt: Date.now(),
  };

  await addQueueItem(item);
  window.dispatchEvent(new CustomEvent('threadflow-queue-changed'));
  return item;
}

export async function getOfflineQueue(): Promise<QueuedProductionUpdate[]> {
  return getAllQueueItems();
}

export async function getPendingOfflineCount(): Promise<number> {
  return getPendingQueueCount();
}

export { removeQueueItem, updateQueueStatus };
