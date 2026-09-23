/**
 * IndexedDB Native Wrapper for Technician PWA Offline Storage & Background Sync
 */

const DB_NAME = 'PestControlTechDB';
const DB_VERSION = 1;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;

      // 1. Cached Jobs Store
      if (!db.objectStoreNames.contains('jobs')) {
        db.createObjectStore('jobs', { keyPath: 'id' });
      }

      // 2. Pending Offline Mutations Queue
      if (!db.objectStoreNames.contains('offline_mutations')) {
        const mutationStore = db.createObjectStore('offline_mutations', { keyPath: 'id', autoIncrement: true });
        mutationStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 3. Persistent 1-Time Session Store
      if (!db.objectStoreNames.contains('tech_session')) {
        db.createObjectStore('tech_session', { keyPath: 'key' });
      }
    };

    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });

  return dbPromise;
}

// ==========================================
// JOBS OFFLINE CACHE
// ==========================================

export async function saveJobsOffline(jobsList) {
  if (!Array.isArray(jobsList)) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('jobs', 'readwrite');
    const store = tx.objectStore('jobs');
    // Clear and put latest
    store.clear();
    for (const job of jobsList) {
      store.put(job);
    }
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getJobsOffline() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('jobs', 'readonly');
    const store = tx.objectStore('jobs');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function getJobOffline(jobId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('jobs', 'readonly');
    const store = tx.objectStore('jobs');
    const req = store.get(parseInt(jobId, 10));
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function updateCachedJobLocally(jobId, updates) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('jobs', 'readwrite');
    const store = tx.objectStore('jobs');
    const getReq = store.get(parseInt(jobId, 10));
    getReq.onsuccess = () => {
      const existing = getReq.result;
      if (existing) {
        const merged = { ...existing, ...updates };
        store.put(merged);
        resolve(merged);
      } else {
        resolve(null);
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

// ==========================================
// OFFLINE MUTATIONS QUEUE
// ==========================================

export async function queueOfflineMutation(actionType, jobId, payload) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_mutations', 'readwrite');
    const store = tx.objectStore('offline_mutations');
    const record = {
      actionType,
      jobId: parseInt(jobId, 10),
      payload,
      createdAt: new Date().toISOString()
    };
    const req = store.add(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingMutations() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_mutations', 'readonly');
    const store = tx.objectStore('offline_mutations');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function removeMutation(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_mutations', 'readwrite');
    const store = tx.objectStore('offline_mutations');
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// ==========================================
// 1-TIME PERSISTENT SESSION
// ==========================================

export async function saveTechSession(sessionData) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tech_session', 'readwrite');
    const store = tx.objectStore('tech_session');
    store.put({ key: 'current_session', ...sessionData, savedAt: new Date().toISOString() });
    tx.oncomplete = () => {
      // Also mirror to localStorage for synchronous instant boot
      try {
        localStorage.setItem('tech_session_v1', JSON.stringify(sessionData));
        if (sessionData.technician?.id) {
          localStorage.setItem('tech_preferred_id', String(sessionData.technician.id));
        }
      } catch (e) {}
      resolve(true);
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getTechSession() {
  // Check localStorage first for instant rendering
  try {
    const raw = localStorage.getItem('tech_session_v1');
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('tech_session', 'readonly');
      const store = tx.objectStore('tech_session');
      const req = store.get('current_session');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

export async function clearTechSession() {
  try {
    localStorage.removeItem('tech_session_v1');
  } catch (e) {}

  try {
    const db = await openDB();
    const tx = db.transaction('tech_session', 'readwrite');
    tx.objectStore('tech_session').delete('current_session');
  } catch (e) {}
}

// Convenience Aliases
export const cacheJobs = saveJobsOffline;
export const getCachedJobs = getJobsOffline;
export const getPersistentTechSession = getTechSession;
export const savePersistentTechSession = saveTechSession;
export const clearPersistentTechSession = clearTechSession;
export const enqueueOfflineMutation = async (mutation) => {
  return queueOfflineMutation(
    mutation.type || mutation.actionType,
    mutation.jobId,
    mutation.data || mutation.payload || {}
  );
};
