import { create } from 'zustand';
import { Product, Transaction } from './types';

interface MutationResult {
  success: boolean;
  message: string;
  id?: string;
}

export interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AppState {
  user: string | null;
  products: Product[];
  transactions: Transaction[];
  dateIN: string;
  dateCC: string;
  dateHistory: string;
  isSyncing: boolean;
  syncError: string | null;
  toasts: ToastMessage[];
  clearSyncError: () => void;
  notify: (type: ToastMessage['type'], message: string) => void;
  dismissToast: (id: number) => void;
  login: (username: string) => void;
  logout: () => void;
  fetchProducts: () => Promise<void>;
  syncCloud: () => Promise<void>;
  fetchTransactions: () => Promise<void>;
  addTransaction: (record: Omit<Transaction, 'id' | 'timestamp'>) => Promise<MutationResult>;
  updateTransaction: (id: string, type: 'IN' | 'CC', record: Partial<Transaction>) => Promise<MutationResult>;
  deleteTransaction: (id: string, type: 'IN' | 'CC') => Promise<MutationResult>;
  setDateIN: (date: string) => void;
  setDateCC: (date: string) => void;
  setDateHistory: (date: string) => void;
}

const getToday = () => {
  const d = new Date();
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

const getDateKey = (key: string, user: string | null) => user ? `${key}_${user}` : key;

const getSavedDate = (key: string, user: string | null) => localStorage.getItem(getDateKey(key, user)) || getToday();

const saveDate = (key: string, date: string) => {
  localStorage.setItem(key, date);
  return date;
};

const initialUser = localStorage.getItem('opname_user');

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
      message: json.message || 'Sinkronisasi ke Google Sheets gagal.'
    };
  }

  return {
    success: true,
    message: json.message || 'Sinkronisasi berhasil.',
    id: json.id ? String(json.id) : undefined
  };
};

const failedResult = (err: unknown): MutationResult => ({
  success: false,
  message: err instanceof Error ? err.message : 'Tidak bisa terhubung ke server sinkronisasi.'
});

export const useStore = create<AppState>((set, get) => ({
  user: initialUser,
  products: [],
  transactions: [],
  dateIN: getSavedDate('opname_date_in', initialUser),
  dateCC: getSavedDate('opname_date_cc', initialUser),
  dateHistory: getSavedDate('opname_date_history', initialUser),
  isSyncing: false,
  syncError: null,
  toasts: [],

  login: (username: string) => {
    localStorage.setItem('opname_user', username);
    set({
      user: username,
      dateIN: getSavedDate('opname_date_in', username),
      dateCC: getSavedDate('opname_date_cc', username),
      dateHistory: getSavedDate('opname_date_history', username)
    });
  },

  logout: () => {
    localStorage.removeItem('opname_user');
    set({ user: null });
  },

  clearSyncError: () => set({ syncError: null }),

  notify: (type, message) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    set(state => ({ toasts: [...state.toasts, { id, type, message }] }));
    window.setTimeout(() => {
      set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    }, 4500);
  },

  dismissToast: (id: number) => {
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
  },

  setDateIN: (date: string) => set({ dateIN: saveDate(getDateKey('opname_date_in', get().user), date) }),
  setDateCC: (date: string) => set({ dateCC: saveDate(getDateKey('opname_date_cc', get().user), date) }),
  setDateHistory: (date: string) => {
    set({ dateHistory: saveDate(getDateKey('opname_date_history', get().user), date) });
    get().fetchTransactions();
  },

  fetchProducts: async () => {
    try {
      const res = await fetch('/api/products');
      const json = await res.json();
      if (json.success) {
        set({ products: json.data, syncError: null });
      } else {
        set({ syncError: json.message || 'Gagal mengambil master product.' });
      }
    } catch (err) {
      set({ syncError: err instanceof Error ? err.message : 'Gagal mengambil master product.' });
    }
  },

  syncCloud: async () => {
    set({ isSyncing: true });
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const result = await readMutationResult(res);

      if (!result.success) {
        set({ syncError: result.message });
        return;
      }

      await get().fetchProducts();
      await get().fetchTransactions();
      set({ syncError: null });
    } catch (err) {
      set({ syncError: err instanceof Error ? err.message : 'Gagal sinkronisasi cloud.' });
    } finally {
      set({ isSyncing: false });
    }
  },

  fetchTransactions: async () => {
    set({ isSyncing: true });
    try {
      const date = get().dateHistory;
      const res = await fetch(`/api/transactions?date=${date}`);
      const json = await res.json();

      if (res.ok && json.success) {
        set({ transactions: json.data, syncError: null });
      } else {
        set({ syncError: json.message || 'Gagal mengambil riwayat transaksi.' });
      }
    } catch (err) {
      set({ syncError: err instanceof Error ? err.message : 'Gagal mengambil riwayat transaksi.' });
    } finally {
      set({ isSyncing: false });
    }
  },

  addTransaction: async (record) => {
    const optimisticId = "optimistic_" + Date.now();
    const newTx = { ...record, id: optimisticId, timestamp: Date.now() } as Transaction;
    const previousTransactions = get().transactions;
    set(state => ({ transactions: [newTx, ...state.transactions] }));

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record }),
      });
      const result = await readMutationResult(res);

      if (!result.success) {
        set({ transactions: previousTransactions, syncError: result.message });
        return result;
      }

      if (result.id) {
        set(state => ({
          transactions: state.transactions.map(t => t.id === optimisticId ? { ...t, id: result.id! } : t)
        }));
      }

      return result;
    } catch (err) {
      const result = failedResult(err);
      set({ transactions: previousTransactions, syncError: result.message });
      return result;
    }
  },

  updateTransaction: async (id: string, type: 'IN' | 'CC', record: any) => {
    const previousTransactions = get().transactions;
    set(state => ({
      transactions: state.transactions.map(t => t.id === id ? { ...t, ...record } : t)
    }));

    try {
      const res = await fetch(`/api/transactions/${id}?type=${type}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record }),
      });
      const result = await readMutationResult(res);

      if (!result.success) {
        set({ transactions: previousTransactions, syncError: result.message });
        return result;
      }

      return result;
    } catch (err) {
      const result = failedResult(err);
      set({ transactions: previousTransactions, syncError: result.message });
      return result;
    }
  },

  deleteTransaction: async (id: string, type: 'IN' | 'CC') => {
    const previousTransactions = get().transactions;
    set(state => ({ transactions: state.transactions.filter(t => t.id !== id) }));

    try {
      const res = await fetch(`/api/transactions/${id}?type=${type}`, { method: 'DELETE' });
      const result = await readMutationResult(res);

      if (!result.success) {
        set({ transactions: previousTransactions, syncError: result.message });
        return result;
      }

      return result;
    } catch (err) {
      const result = failedResult(err);
      set({ transactions: previousTransactions, syncError: result.message });
      return result;
    }
  }
}));
