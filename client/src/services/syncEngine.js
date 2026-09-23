import { getPendingMutations, removeMutation } from './offlineStorage';
import { startJob, completeJob, postponeJob } from '../api';

const listeners = new Set();
let isSyncing = false;

function notifyListeners(status) {
  for (const fn of listeners) {
    try {
      fn(status);
    } catch (e) {
      console.error(e);
    }
  }
}

/**
 * Subscribe to connectivity & sync status updates
 */
export function subscribeSyncStatus(callback) {
  listeners.add(callback);
  // Initial check
  checkSyncStatus().then(callback);

  return () => listeners.delete(callback);
}

export async function checkSyncStatus() {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  let pendingCount = 0;
  try {
    const pending = await getPendingMutations();
    pendingCount = pending.length;
  } catch (e) {}

  return {
    isOnline,
    pendingCount,
    isSyncing,
    statusText: !isOnline
      ? 'OFFLINE MODE'
      : pendingCount > 0
        ? `WAITING FOR SYNC (${pendingCount} pending)`
        : 'SYNCED ✓'
  };
}

/**
 * Drain and upload all queued offline mutations to backend
 */
export async function syncPendingMutations() {
  if (isSyncing) return { success: false, reason: 'Already syncing' };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { success: false, reason: 'Currently offline' };
  }

  isSyncing = true;
  notifyListeners({ isOnline: true, pendingCount: 1, isSyncing: true, statusText: 'SYNCING DATA...' });

  let syncedCount = 0;
  let failedCount = 0;

  try {
    const pending = await getPendingMutations();

    for (const item of pending) {
      try {
        if (item.actionType === 'START_JOB') {
          await startJob(item.jobId);
        } else if (item.actionType === 'COMPLETE_JOB') {
          await completeJob(item.jobId, item.payload);
        } else if (item.actionType === 'POSTPONE_JOB') {
          await postponeJob(item.jobId, item.payload);
        }

        await removeMutation(item.id);
        syncedCount++;
      } catch (err) {
        console.warn(`[SyncEngine] Failed syncing mutation #${item.id}:`, err.message);
        failedCount++;
      }
    }
  } catch (err) {
    console.error('[SyncEngine] Error during sync:', err);
  } finally {
    isSyncing = false;
    const finalStatus = await checkSyncStatus();
    notifyListeners(finalStatus);
  }

  return { success: true, syncedCount, failedCount };
}

// Auto-sync whenever internet connectivity is restored
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[SyncEngine] Connection restored! Triggering automatic background sync...');
    syncPendingMutations();
  });

  window.addEventListener('offline', () => {
    console.log('[SyncEngine] Device went offline. Actions will be queued in IndexedDB.');
    checkSyncStatus().then(notifyListeners);
  });
}

// Convenience Aliases
export const triggerSync = syncPendingMutations;
export const onSyncStatusChange = subscribeSyncStatus;
