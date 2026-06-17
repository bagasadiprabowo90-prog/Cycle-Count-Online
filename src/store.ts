import { create } from 'zustand';
import { Product, Transaction } from './types';
import { getCached, setCache, isOnline } from './lib/cache';
import {
  queueTransaction,
  startAutoSync,
  stopAutoSync,
  getPendingCount,
  onSyncStatusChange,
  forceSyncNow,
} from './lib/syncManager';

interface MutationResult {
  success: boolean;
  message: string;
  id?: string;
  queued?: boolean;
}

export interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AppState {
  // User state
  user: string | null;

  // Data state
  products: Product[];
  transactions: Transaction[];

  // Date state
  dateIN: string;
  dateCC: string;
  dateHistory: string;

  // Sync state
  isSyncing: boolean;
  isOnline: boolean;
  pendingCount: number;
  syncError: string | null;

  // Toast state
  toasts: ToastMessage[];

  // Actions
  clearSyncError: () => void;
  notify: (type: ToastMessage['type'], message: string) => void;
  dismissToast: (id: number) => void;
  login: (username: string) => void;
  logout: () => void;

  // Data fetching
  fetchProducts: (forceRefresh?: boolean) => Promise<void>;
  fetchTransactions: (forceRefresh?: boolean) => Promise<void>;

  // Sync
  syncCloud: () => Promise<void>;
  setDateIN: (date: string) => void;
  setDateCC: (date: string) => void;
  setDateHistory: (date: string) => void;
  resetDateIN: () => void;
  resetDateCC: () => void;
  resetDateHistory: () => void;

  // Transactions
  addTransaction: (record: Omit<Transaction, 'id' | 'timestamp'>) => Promise<MutationResult>;
  updateTransaction: (id: string, type: 'IN' | 'CC', record: Partial<Transaction>) => Promise<MutationResult>;
  deleteTransaction: (id: string, type: 'IN' | 'CC') => Promise<MutationResult>;

  // Init
  initialize: () => void;
}

const getToday = () => {
  const d = new Date();
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
};

const getDateKey = (key: string, user: string | null) => (user ? `${key}_${user}` : key);
const getSavedDate = (key: string, user: string | null) =>
  localStorage.getItem(getDateKey(key, user)) || getToday();

const saveDate = (key: string, date: string) => {
  localStorage.setItem(key, date);
  return date;
};

const initialUser = localStorage.getItem('opname_user');

// Read mutation result from response
const readMutationResult = async (res: Response): Promise<MutationResult> => {
  let json: any = {};
  try {
    json = await res.json();
  } catch (err) {
    return { success: false, message: 'Server mengirim respons yang tidak valid.' };
  }

  if (!res.ok || json.success !== true) {
    return {
      success: false,
      message: json.message || 'Sinkronisasi ke Google Sheets gagal.',
    };
  }

  return {
    success: true,
    message: json.message || 'Sinkronisasi berhasil.',
    id: json.id ? String(json.id) : undefined,
  };
};

export const useStore = create<AppState>((set, get) => ({
  user: initialUser,
  products: [],
  transactions: [],
  dateIN: getSavedDate('opname_date_in', initialUser),
  dateCC: getSavedDate('opname_date_cc', initialUser),
  dateHistory: getSavedDate('opname_date_history', initialUser),
  isSyncing: false,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  pendingCount: 0,
  syncError: null,
  toasts: [],

  initialize: () => {
    // Start auto sync
    startAutoSync();

    // Listen for sync status
    onSyncStatusChange((status) => {
      set({
        isSyncing: status.syncing,
        pendingCount: status.pending,
      });
    });

    // Listen for online/offline
    const handleOnline = () => set({ isOnline: true });
    const handleOffline = () => set({ isOnline: false });

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    // Initial pending count
    getPendingCount().then((count) => set({ pendingCount: count }));
  },

  login: (username: string) => {
    localStorage.setItem('opname_user', username);
    set({
      user: username,
      dateIN: getSavedDate('opname_date_in', username),
      dateCC: getSavedDate('opname_date_cc', username),
      dateHistory: getSavedDate('opname_date_history', username),
    });
  },

  logout: () => {
    localStorage.removeItem('opname_user');
    set({ user: null, products: [], transactions: [] });
  },

  clearSyncError: () => set({ syncError: null }),

  notify: (type, message) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));
    window.setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4500);
  },

  dismissToast: (id: number) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  setDateIN: (date: string) =>
    set({ dateIN: saveDate(getDateKey('opname_date_in', get().user), date) }),

  setDateCC: (date: string) =>
    set({ dateCC: saveDate(getDateKey('opname_date_cc', get().user), date) }),

  setDateHistory: (date: string) => {
    set({ dateHistory: saveDate(getDateKey('opname_date_history', get().user), date) });
    get().fetchTransactions();
  },

  resetDateIN: () => {
    const today = getToday();
    saveDate(getDateKey('opname_date_in', get().user), today);
    set({ dateIN: today });
  },

  resetDateCC: () => {
    const today = getToday();
    saveDate(getDateKey('opname_date_cc', get().user), today);
    set({ dateCC: today });
  },

  resetDateHistory: () => {
    const today = getToday();
    saveDate(getDateKey('opname_date_history', get().user), today);
    set({ dateHistory: today });
    get().fetchTransactions();
  },

  fetchProducts: async (forceRefresh = false) => {
    // Try cache first if not forcing refresh
    if (!forceRefresh) {
      const cached = await getCached('products', 'master');
      if (cached && cached.length > 0) {
        set({ products: cached, syncError: null });
        // Still fetch in background for freshness
      }
    }

    try {
      const res = await fetch('/api/products');
      const json = await res.json();
      if (json.success) {
        const products = json.data || [];
        set({ products, syncError: null });
        // Update cache
        await setCache('products', 'master', products);
      } else {
        // If API fails but we have cache, use it
        const cached = await getCached('products', 'master');
        if (cached && cached.length > 0) {
          set({ products: cached, syncError: null });
        } else {
          set({ syncError: json.message || 'Gagal mengambil master product.' });
        }
      }
    } catch (err) {
      // Network error - use cache
      const cached = await getCached('products', 'master');
      if (cached && cached.length > 0) {
        set({ products: cached, syncError: null });
      } else {
        set({
          syncError: err instanceof Error ? err.message : 'Gagal mengambil master product.',
        });
      }
    }
  },

  fetchTransactions: async (forceRefresh = false) => {
    const date = get().dateHistory;
    const cacheKey = `tx_${date}`;

    // Try cache first
    if (!forceRefresh) {
      const cached = await getCached('transactions', cacheKey);
      if (cached && cached.length > 0) {
        set({ transactions: cached, syncError: null });
      }
    }

    set({ isSyncing: true });
    try {
      const res = await fetch(`/api/transactions?date=${encodeURIComponent(date)}`);
      const json = await res.json();

      if (res.ok && json.success) {
        const transactions = json.data || [];
        set({ transactions, syncError: null });
        await setCache('transactions', cacheKey, transactions);
      } else {
        const cached = await getCached('transactions', cacheKey);
        if (cached && cached.length > 0) {
          set({ transactions: cached, syncError: null });
        } else {
          set({ syncError: json.message || 'Gagal mengambil riwayat transaksi.' });
        }
      }
    } catch (err) {
      const cached = await getCached('transactions', cacheKey);
      if (cached && cached.length > 0) {
        set({ transactions: cached, syncError: null });
      } else {
        set({ syncError: err instanceof Error ? err.message : 'Gagal mengambil riwayat transaksi.' });
      }
    } finally {
      set({ isSyncing: false });
    }
  },

  syncCloud: async () => {
    set({ isSyncing: true });
    try {
      // Force sync pending queue first
      await forceSyncNow();

      // Then refresh data
      await get().fetchProducts(true);
      await get().fetchTransactions(true);
      set({ syncError: null });
    } catch (err) {
      set({ syncError: err instanceof Error ? err.message : 'Gagal sinkronisasi cloud.' });
    } finally {
      set({ isSyncing: false });
    }
  },

  addTransaction: async (record) => {
    const optimisticId = 'optimistic_' + Date.now();
    const newTx = { ...record, id: optimisticId, timestamp: Date.now() } as Transaction;

    // Optimistic update
    set((state) => ({ transactions: [newTx, ...state.transactions] }));

    // If offline, queue it
    if (!isOnline()) {
      await queueTransaction(record.type, 'create', record, optimisticId);
      return {
        success: true,
        message: 'Tersimpan offline. Akan disinkronkan saat online.',
        id: optimisticId,
        queued: true,
      };
    }

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record }),
      });
      const result = await readMutationResult(res);

      if (!result.success) {
        // Rollback only this transaction
        set((state) => ({
          transactions: state.transactions.filter((t) => t.id !== optimisticId),
          syncError: result.message
        }));
        return result;
      }

      // Update with real ID
      if (result.id) {
        set((state) => ({
          transactions: state.transactions.map((t) =>
            t.id === optimisticId ? { ...t, id: result.id! } : t
          ),
        }));
      }

      return result;
    } catch (err) {
      // Network error - queue it
      await queueTransaction(record.type, 'create', record, optimisticId);
      return {
        success: true,
        message: 'Tersimpan offline. Akan disinkronkan saat online.',
        id: optimisticId,
        queued: true,
      };
    }
  },

  updateTransaction: async (id, type, record) => {
    const previousTx = get().transactions.find((t) => t.id === id);
    if (!previousTx) return { success: false, message: 'Transaksi tidak ditemukan.' };

    // Optimistic update
    set((state) => ({
      transactions: state.transactions.map((t) => (t.id === id ? { ...t, ...record } : t)),
    }));

    if (!isOnline()) {
      await queueTransaction(type, 'update', { ...record, id, type }, `update_${id}`);
      return {
        success: true,
        message: 'Update tersimpan offline.',
        queued: true,
      };
    }

    try {
      const res = await fetch(`/api/transactions/${id}?type=${type}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record }),
      });
      const result = await readMutationResult(res);

      if (!result.success) {
        // Rollback only this transaction
        set((state) => ({
          transactions: state.transactions.map((t) => (t.id === id ? previousTx : t)),
          syncError: result.message
        }));
        return result;
      }

      return result;
    } catch (err) {
      await queueTransaction(type, 'update', { ...record, id, type }, `update_${id}`);
      return {
        success: true,
        message: 'Update tersimpan offline.',
        queued: true,
      };
    }
  },

  deleteTransaction: async (id, type) => {
    const deletedTx = get().transactions.find((t) => t.id === id);
    if (!deletedTx) return { success: false, message: 'Transaksi tidak ditemukan.' };

    // Optimistic update
    set((state) => ({ transactions: state.transactions.filter((t) => t.id !== id) }));

    if (!isOnline()) {
      await queueTransaction(type, 'delete', { id, type }, `delete_${id}`);
      return {
        success: true,
        message: 'Hapus tersimpan offline.',
        queued: true,
      };
    }

    try {
      const res = await fetch(`/api/transactions/${id}?type=${type}`, {
        method: 'DELETE',
      });
      const result = await readMutationResult(res);

      if (!result.success) {
        // Rollback: put the deleted transaction back and sort by timestamp desc
        set((state) => ({
          transactions: [...state.transactions, deletedTx].sort((a, b) => b.timestamp - a.timestamp),
          syncError: result.message
        }));
        return result;
      }

      return result;
    } catch (err) {
      await queueTransaction(type, 'delete', { id, type }, `delete_${id}`);
      return {
        success: true,
        message: 'Hapus tersimpan offline.',
        queued: true,
      };
    }
  },
}));
