import { defineStore } from 'pinia';
import { Product, Transaction } from './types';
import { getCached, setCache, isOnline as checkOnline } from './lib/cache';
import {
  queueTransaction,
  startAutoSync,
  getPendingCount,
  onSyncStatusChange,
  forceSyncNow,
} from './lib/syncManager';

export interface MutationResult {
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

const getToday = () => {
  const d = new Date();
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
};

const getDateKey = (key: string, user: string | null) => (user ? `${key}_${user}` : key);
const getSavedDate = (key: string, user: string | null) =>
  (typeof window !== 'undefined' ? localStorage.getItem(getDateKey(key, user)) : null) || getToday();

const saveDate = (key: string, date: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, date);
  }
  return date;
};

const initialUser = typeof window !== 'undefined' ? localStorage.getItem('opname_user') : null;

const readMutationResult = async (res: Response): Promise<MutationResult> => {
  let json: any = {};
  try {
    json = await res.json();
  } catch {
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

export const useStore = defineStore('app', {
  state: () => ({
    user: initialUser as string | null,
    products: [] as Product[],
    transactions: [] as Transaction[],
    dateIN: getSavedDate('opname_date_in', initialUser),
    dateCC: getSavedDate('opname_date_cc', initialUser),
    dateHistory: getSavedDate('opname_date_history', initialUser),
    isSyncing: false,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pendingCount: 0,
    syncError: null as string | null,
    toasts: [] as ToastMessage[],
    isInitialized: false,
  }),

  actions: {
    initialize() {
      if (this.isInitialized) return;
      this.isInitialized = true;

      // Start auto sync background
      startAutoSync();

      // Listen for sync status changes
      onSyncStatusChange((status) => {
        this.isSyncing = status.syncing;
        this.pendingCount = status.pending;
      });

      // Listen for network connectivity changes
      if (typeof window !== 'undefined') {
        window.addEventListener('online', () => { this.isOnline = true; });
        window.addEventListener('offline', () => { this.isOnline = false; });
      }

      // Initial pending count
      getPendingCount().then((count) => {
        this.pendingCount = count;
      });
    },

    login(username: string) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('opname_user', username);
      }
      this.user = username;
      this.dateIN = getSavedDate('opname_date_in', username);
      this.dateCC = getSavedDate('opname_date_cc', username);
      this.dateHistory = getSavedDate('opname_date_history', username);
    },

    logout() {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('opname_user');
      }
      this.user = null;
      this.products = [];
      this.transactions = [];
    },

    clearSyncError() {
      this.syncError = null;
    },

    notify(type: ToastMessage['type'], message: string) {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      this.toasts.push({ id, type, message });
      if (typeof window !== 'undefined') {
        window.setTimeout(() => {
          this.dismissToast(id);
        }, 4000);
      }
    },

    dismissToast(id: number) {
      this.toasts = this.toasts.filter((t) => t.id !== id);
    },

    setDateIN(date: string) {
      this.dateIN = saveDate(getDateKey('opname_date_in', this.user), date);
    },

    setDateCC(date: string) {
      this.dateCC = saveDate(getDateKey('opname_date_cc', this.user), date);
    },

    setDateHistory(date: string) {
      this.dateHistory = saveDate(getDateKey('opname_date_history', this.user), date);
      this.fetchTransactions();
    },

    resetDateIN() {
      const today = getToday();
      saveDate(getDateKey('opname_date_in', this.user), today);
      this.dateIN = today;
    },

    resetDateCC() {
      const today = getToday();
      saveDate(getDateKey('opname_date_cc', this.user), today);
      this.dateCC = today;
    },

    resetDateHistory() {
      const today = getToday();
      saveDate(getDateKey('opname_date_history', this.user), today);
      this.dateHistory = today;
      this.fetchTransactions();
    },

    async fetchProducts(forceRefresh = false) {
      if (!forceRefresh) {
        const cached = await getCached('products', 'master');
        if (cached && cached.length > 0) {
          this.products = cached;
          this.syncError = null;
        }
      }

      try {
        const res = await fetch('/api/products');
        const json = await res.json();
        if (json.success) {
          const products = json.data || [];
          this.products = products;
          this.syncError = null;
          await setCache('products', 'master', products);
        } else {
          const cached = await getCached('products', 'master');
          if (cached && cached.length > 0) {
            this.products = cached;
          } else {
            this.syncError = json.message || 'Gagal mengambil master product.';
          }
        }
      } catch (err) {
        const cached = await getCached('products', 'master');
        if (cached && cached.length > 0) {
          this.products = cached;
        } else {
          this.syncError = err instanceof Error ? err.message : 'Gagal mengambil master product.';
        }
      }
    },

    async fetchTransactions(forceRefresh = false) {
      const date = this.dateHistory;
      const cacheKey = `tx_${date}`;

      if (!forceRefresh) {
        const cached = await getCached('transactions', cacheKey);
        if (cached && cached.length > 0) {
          this.transactions = cached;
          this.syncError = null;
        }
      }

      this.isSyncing = true;
      try {
        const res = await fetch(`/api/transactions?date=${encodeURIComponent(date)}`);
        const json = await res.json();

        if (res.ok && json.success) {
          const transactions = json.data || [];
          this.transactions = transactions;
          this.syncError = null;
          await setCache('transactions', cacheKey, transactions);
        } else {
          const cached = await getCached('transactions', cacheKey);
          if (cached && cached.length > 0) {
            this.transactions = cached;
          } else {
            this.syncError = json.message || 'Gagal mengambil riwayat transaksi.';
          }
        }
      } catch (err) {
        const cached = await getCached('transactions', cacheKey);
        if (cached && cached.length > 0) {
          this.transactions = cached;
        } else {
          this.syncError = err instanceof Error ? err.message : 'Gagal mengambil riwayat transaksi.';
        }
      } finally {
        this.isSyncing = false;
      }
    },

    async syncCloud() {
      this.isSyncing = true;
      try {
        await forceSyncNow();
        await this.fetchProducts(true);
        await this.fetchTransactions(true);
        this.syncError = null;
        this.notify('success', 'Sinkronisasi cloud selesai.');
      } catch (err) {
        this.syncError = err instanceof Error ? err.message : 'Gagal sinkronisasi cloud.';
        this.notify('error', this.syncError);
      } finally {
        this.isSyncing = false;
      }
    },

    async addTransaction(record: Omit<Transaction, 'id' | 'timestamp'>): Promise<MutationResult> {
      const optimisticId = 'optimistic_' + Date.now();
      const newTx = { ...record, id: optimisticId, timestamp: Date.now() } as Transaction;

      this.transactions.unshift(newTx);

      if (!checkOnline()) {
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
          this.transactions = this.transactions.filter((t) => t.id !== optimisticId);
          this.syncError = result.message;
          return result;
        }

        if (result.id) {
          this.transactions = this.transactions.map((t) =>
            t.id === optimisticId ? { ...t, id: result.id! } : t
          );
        }

        return result;
      } catch {
        await queueTransaction(record.type, 'create', record, optimisticId);
        return {
          success: true,
          message: 'Tersimpan offline. Akan disinkronkan saat online.',
          id: optimisticId,
          queued: true,
        };
      }
    },

    async updateTransaction(id: string, type: 'IN' | 'CC', record: Partial<Transaction>): Promise<MutationResult> {
      const previousTx = this.transactions.find((t) => t.id === id);
      if (!previousTx) return { success: false, message: 'Transaksi tidak ditemukan.' };

      this.transactions = this.transactions.map((t) => (t.id === id ? { ...t, ...record } : t));

      if (!checkOnline()) {
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
          this.transactions = this.transactions.map((t) => (t.id === id ? previousTx : t));
          this.syncError = result.message;
          return result;
        }

        return result;
      } catch {
        await queueTransaction(type, 'update', { ...record, id, type }, `update_${id}`);
        return {
          success: true,
          message: 'Update tersimpan offline.',
          queued: true,
        };
      }
    },

    async deleteTransaction(id: string, type: 'IN' | 'CC'): Promise<MutationResult> {
      const deletedTx = this.transactions.find((t) => t.id === id);
      if (!deletedTx) return { success: false, message: 'Transaksi tidak ditemukan.' };

      this.transactions = this.transactions.filter((t) => t.id !== id);

      if (!checkOnline()) {
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
          this.transactions.push(deletedTx);
          this.transactions.sort((a, b) => b.timestamp - a.timestamp);
          this.syncError = result.message;
          return result;
        }

        return result;
      } catch {
        await queueTransaction(type, 'delete', { id, type }, `delete_${id}`);
        return {
          success: true,
          message: 'Hapus tersimpan offline.',
          queued: true,
        };
      }
    },
  },
});
