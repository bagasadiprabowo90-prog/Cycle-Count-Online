/**
 * IndexedDB Cache Manager untuk Stock Opname Pro
 * Cache data master products dan transactions untuk performa instant
 */

const DB_NAME = 'stock-opname-cache';
const DB_VERSION = 1;

interface DBSchema {
  products: {
    key: string;
    value: any;
    timestamp: number;
  };
  transactions: {
    key: string;
    value: any[];
    timestamp: number;
  };
  pendingQueue: {
    key: string;
    value: {
      id: string;
      type: 'IN' | 'CC';
      action: 'create' | 'update' | 'delete';
      record: any;
      timestamp: number;
      retries: number;
    };
    timestamp: number;
  };
}

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Store untuk products
      if (!db.objectStoreNames.contains('products')) {
        db.createObjectStore('products', { keyPath: 'key' });
      }

      // Store untuk transactions
      if (!db.objectStoreNames.contains('transactions')) {
        db.createObjectStore('transactions', { keyPath: 'key' });
      }

      // Store untuk offline queue
      if (!db.objectStoreNames.contains('pendingQueue')) {
        db.createObjectStore('pendingQueue', { keyPath: 'key' });
      }
    };
  });
}

// Cache TTL dalam milliseconds
const CACHE_TTL = {
  PRODUCTS: 5 * 60 * 1000, // 5 menit
  TRANSACTIONS: 1 * 60 * 1000, // 1 menit
};

/**
 * Get cached data dengan validasi TTL
 */
export async function getCached<T extends keyof DBSchema>(
  store: T,
  key: string
): Promise<DBSchema[T]['value'] | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const objectStore = tx.objectStore(store);
      const request = objectStore.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          resolve(null);
          return;
        }

        // Validasi TTL
        const ttl = store === 'products' ? CACHE_TTL.PRODUCTS : CACHE_TTL.TRANSACTIONS;
        if (Date.now() - result.timestamp > ttl) {
          // Cache expired, hapus
          deleteCache(store, key);
          resolve(null);
          return;
        }

        resolve(result.value);
      };
    });
  } catch (error) {
    console.warn(`Cache get error (${store}/${key}):`, error);
    return null;
  }
}

/**
 * Set cached data
 */
export async function setCache<T extends keyof DBSchema>(
  store: T,
  key: string,
  value: DBSchema[T]['value']
): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const objectStore = tx.objectStore(store);
      const request = objectStore.put({
        key,
        value,
        timestamp: Date.now(),
      });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.warn(`Cache set error (${store}/${key}):`, error);
  }
}

/**
 * Delete specific cache
 */
export async function deleteCache<T extends keyof DBSchema>(
  store: T,
  key: string
): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const objectStore = tx.objectStore(store);
      const request = objectStore.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.warn(`Cache delete error (${store}/${key}):`, error);
  }
}

/**
 * Clear all cache
 */
export async function clearAllCache(): Promise<void> {
  try {
    const db = await openDB();
    const stores: (keyof DBSchema)[] = ['products', 'transactions', 'pendingQueue'];

    for (const store of stores) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        const objectStore = tx.objectStore(store);
        const request = objectStore.clear();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    }
  } catch (error) {
    console.warn('Clear all cache error:', error);
  }
}

/**
 * Get all pending queue items
 */
export async function getPendingQueue(): Promise<DBSchema['pendingQueue']['value'][]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pendingQueue', 'readonly');
      const objectStore = tx.objectStore('pendingQueue');
      const request = objectStore.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  } catch (error) {
    console.warn('Get pending queue error:', error);
    return [];
  }
}

/**
 * Add to pending queue
 */
export async function addToPendingQueue(item: DBSchema['pendingQueue']['value']): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pendingQueue', 'readwrite');
      const objectStore = tx.objectStore('pendingQueue');
      const request = objectStore.put({
        key: item.id,
        ...item,
        timestamp: Date.now(),
      });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.warn('Add to pending queue error:', error);
  }
}

/**
 * Remove from pending queue
 */
export async function removeFromPendingQueue(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pendingQueue', 'readwrite');
      const objectStore = tx.objectStore('pendingQueue');
      const request = objectStore.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.warn('Remove from pending queue error:', error);
  }
}

/**
 * Update retry count in pending queue
 */
export async function updatePendingQueueRetry(id: string, retries: number): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pendingQueue', 'readwrite');
      const objectStore = tx.objectStore('pendingQueue');
      const getRequest = objectStore.get(id);

      getRequest.onerror = () => reject(getRequest.error);
      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (item) {
          item.retries = retries;
          const putRequest = objectStore.put(item);
          putRequest.onerror = () => reject(putRequest.error);
          putRequest.onsuccess = () => resolve();
        } else {
          resolve();
        }
      };
    });
  } catch (error) {
    console.warn('Update pending queue retry error:', error);
  }
}

/**
 * Check if online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Listen for online/offline events
 */
export function onConnectivityChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
