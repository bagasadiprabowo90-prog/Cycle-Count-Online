/**
 * Sync Manager - Batch sync dengan offline queue
 * Mengelola sinkronisasi background dan retry logic
 */

import {
  getPendingQueue,
  addToPendingQueue,
  removeFromPendingQueue,
  updatePendingQueueRetry,
  isOnline,
  onConnectivityChange,
  setCache,
  getCached,
} from './cache';

const SYNC_INTERVAL = 30000; // 30 detik
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 detik

interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  message?: string;
}

let syncIntervalId: number | null = null;
let isSyncing = false;
let listeners: ((status: { syncing: boolean; pending: number }) => void)[] = [];

/**
 * Generate unique ID for queue items
 */
function generateQueueId(): string {
  return `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Add transaction to offline queue
 */
export async function queueTransaction(
  type: 'IN' | 'CC',
  action: 'create' | 'update' | 'delete',
  record: any,
  transactionId?: string
): Promise<string> {
  const queueId = transactionId || generateQueueId();

  await addToPendingQueue({
    id: queueId,
    type,
    action,
    record,
    timestamp: Date.now(),
    retries: 0,
  });

  notifyListeners();

  // Try immediate sync if online
  if (isOnline()) {
    scheduleImmediateSync();
  }

  return queueId;
}

/**
 * Schedule immediate sync (debounced)
 */
let syncTimeoutId: number | null = null;
function scheduleImmediateSync() {
  if (syncTimeoutId) {
    clearTimeout(syncTimeoutId);
  }
  // Minimum 2 detik delay untuk debounce
  syncTimeoutId = window.setTimeout(() => {
    processQueue();
  }, 2000);
}

/**
 * Process all pending queue items
 */
export async function processQueue(): Promise<SyncResult> {
  if (isSyncing || !isOnline()) {
    return { success: false, synced: 0, failed: 0, message: 'Sync already in progress or offline' };
  }

  isSyncing = true;
  notifyListeners();

  const result: SyncResult = { success: true, synced: 0, failed: 0 };

  try {
    const pending = await getPendingQueue();

    if (pending.length === 0) {
      isSyncing = false;
      notifyListeners();
      return { success: true, synced: 0, failed: 0, message: 'No pending items' };
    }

    // Sort by timestamp (oldest first)
    pending.sort((a, b) => a.timestamp - b.timestamp);

    for (const item of pending) {
      try {
        await syncQueueItem(item);
        await removeFromPendingQueue(item.id);
        result.synced++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Increment retry count
        if (item.retries < MAX_RETRIES) {
          await updatePendingQueueRetry(item.id, item.retries + 1);

          // Schedule retry with delay
          setTimeout(() => {
            processQueue();
          }, RETRY_DELAY * (item.retries + 1));
        } else {
          // Max retries reached, remove from queue
          console.error(`Max retries reached for queue item ${item.id}:`, errorMessage);
          await removeFromPendingQueue(item.id);
        }

        result.failed++;
      }
    }

    result.success = result.failed === 0;
    result.message = `Synced: ${result.synced}, Failed: ${result.failed}`;

  } catch (error) {
    result.success = false;
    result.message = error instanceof Error ? error.message : 'Queue processing failed';
  } finally {
    isSyncing = false;
    notifyListeners();
  }

  return result;
}

/**
 * Sync single queue item to server
 */
async function syncQueueItem(item: {
  id: string;
  type: 'IN' | 'CC';
  action: 'create' | 'update' | 'delete';
  record: any;
}): Promise<void> {
  const endpoint = `/api/transactions/${item.action === 'delete' ? item.id : ''}`;
  const method = item.action === 'create' ? 'POST' : item.action === 'update' ? 'PUT' : 'DELETE';

  const url = item.action === 'delete'
    ? `${endpoint}?type=${item.type}`
    : endpoint;

  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (item.action !== 'delete') {
    options.body = JSON.stringify({
      record: item.record,
      type: item.type,
    });
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }
}

/**
 * Start automatic sync
 */
export function startAutoSync(): void {
  if (syncIntervalId !== null) return;

  // Initial sync
  if (isOnline()) {
    processQueue();
  }

  // Periodic sync
  syncIntervalId = window.setInterval(() => {
    if (isOnline()) {
      processQueue();
    }
  }, SYNC_INTERVAL);

  // Listen for connectivity changes
  const unsubscribe = onConnectivityChange((online) => {
    if (online) {
      console.log('Back online, processing queue...');
      processQueue();
    }
  });

  // Store unsubscribe for cleanup
  (window as any).__syncCleanup = unsubscribe;
}

/**
 * Stop automatic sync
 */
export function stopAutoSync(): void {
  if (syncIntervalId !== null) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }

  if ((window as any).__syncCleanup) {
    (window as any).__syncCleanup();
  }
}

/**
 * Get pending count
 */
export async function getPendingCount(): Promise<number> {
  const pending = await getPendingQueue();
  return pending.length;
}

/**
 * Subscribe to sync status changes
 */
export function onSyncStatusChange(callback: (status: { syncing: boolean; pending: number }) => void): () => void {
  listeners.push(callback);

  // Immediately notify with current status
  getPendingCount().then((pending) => {
    callback({ syncing: isSyncing, pending });
  });

  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
}

function notifyListeners(): void {
  getPendingCount().then((pending) => {
    listeners.forEach((l) => l({ syncing: isSyncing, pending }));
  });
}

/**
 * Force sync now
 */
export async function forceSyncNow(): Promise<SyncResult> {
  return processQueue();
}

/**
 * Clear all pending items (use with caution!)
 */
export async function clearPendingQueue(): Promise<void> {
  const pending = await getPendingQueue();
  for (const item of pending) {
    await removeFromPendingQueue(item.id);
  }
  notifyListeners();
}
