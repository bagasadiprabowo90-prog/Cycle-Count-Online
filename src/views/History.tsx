import { useRef, useState, useEffect } from 'react';
import { useStore } from '../store';
import { Trash2, List, Save, X, Edit3, Search, CalendarDays } from 'lucide-react';
import { toYMD, toMDY, calculateQty, formatDateShort, isToday } from '../lib/calc';
import { Transaction } from '../types';

export default function History() {
  const { products, transactions, deleteTransaction, updateTransaction, dateHistory, setDateHistory, resetDateHistory, isSyncing, notify } = useStore();
  const dateInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const [tab, setTab] = useState<'IN' | 'CC'>('CC');
  const [searchQuery, setSearchQuery] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBatch, setEditBatch] = useState('');
  const [editQtyRaw, setEditQtyRaw] = useState('');
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);

  // Handle keyboard visibility on mobile
  useEffect(() => {
    const handleViewportChange = () => {
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const documentHeight = document.documentElement.clientHeight;
      const keyboardVisible = viewportHeight < documentHeight - 100;
      setIsKeyboardVisible(keyboardVisible);
    };

    window.visualViewport?.addEventListener('resize', handleViewportChange);
    window.addEventListener('resize', handleViewportChange);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, []);

  const filtered = transactions.filter(t => {
    if (t.type !== tab) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return String(t.product || '').toLowerCase().includes(q) || String(t.sku || '').toLowerCase().includes(q) || String(t.batch || '').toLowerCase().includes(q);
    }
    return true;
  });

  const uniqueProducts = new Set(filtered.map(t => String(t.sku || t.product || '-'))).size;

  const totalIn = transactions.filter(t => t.type === 'IN').reduce((sum, t) => sum + t.qty, 0);
  const totalCC = transactions.filter(t => t.type === 'CC').reduce((sum, t) => sum + t.qty, 0);

  const tabBgClass = tab === 'IN' ? 'bg-gradient-to-r from-indigo-500 to-blue-500' : 'bg-gradient-to-r from-emerald-500 to-teal-500';
  const accentText = tab === 'IN' ? 'text-indigo-600' : 'text-emerald-600';

  const switchTab = (next: 'IN' | 'CC') => {
    setTab(next);
    setEditingId(null);
  };

  const startEdit = (t: Transaction) => {
    setEditingId(t.id);
    setEditBatch(t.batch);
    setEditQtyRaw(t.qty.toString());
    // Scroll the table into view when editing starts on mobile
    setTimeout(() => {
      tableRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 100);
  };

  const getBatchOptions = (t: Transaction) => {
    const batchOptions = products
      .filter(p => p.sku === t.sku && p.batch)
      .map(p => p.batch);
    const uniqueBatches = Array.from(new Set(batchOptions));

    if (t.batch && !uniqueBatches.includes(t.batch)) {
      return [t.batch, ...uniqueBatches];
    }

    return uniqueBatches;
  };

  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') input.showPicker();
    else input.click();
  };

  const saveEdit = async (t: Transaction) => {
    const finalQty = calculateQty(editQtyRaw);
    if (finalQty <= 0 || !editBatch) {
      notify('error', 'Batch dan Qty harus diisi dengan benar.');
      return;
    }

    const selectedProduct = products.find(p => p.sku === t.sku && p.batch === editBatch);

    setMutatingId(t.id);
    const result = await updateTransaction(t.id, t.type, {
      ...t,
      barcode: selectedProduct?.barcode || t.barcode,
      product: selectedProduct?.product || t.product,
      batch: editBatch,
      qty: finalQty
    });
    setMutatingId(null);

    if (!result.success) {
      notify('error', `Gagal update: ${result.message}`);
      return;
    }

    setEditingId(null);
    notify('success', 'Data berhasil diupdate.');
  };

  const handleDelete = async (t: Transaction) => {
    setMutatingId(t.id);
    const result = await deleteTransaction(t.id, t.type);
    setMutatingId(null);
    setPendingDelete(null);

    if (!result.success) {
      notify('error', `Gagal hapus: ${result.message}`);
      return;
    }

    notify('success', 'Data berhasil dihapus.');
  };

  return (
    <div className="text-sm pb-10">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          Riwayat
          {isSyncing && <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />}
        </h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={openDatePicker}
              className={`flex items-center gap-1.5 border text-slate-700 px-3 py-1.5 rounded-xl text-xs font-medium shadow-sm cursor-pointer transition-all ${
                isToday(dateHistory)
                  ? 'bg-teal-50 border-teal-200 text-teal-700'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2"/>
                <path d="M16 2v4M8 2v4M3 10h18" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span className="font-medium">{formatDateShort(dateHistory)}</span>
            </button>
            <input
              ref={dateInputRef}
              type="date"
              className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
              value={toYMD(dateHistory)}
              onChange={(e) => {
                if (e.target.value) setDateHistory(toMDY(e.target.value));
              }}
            />
          </div>
          {!isToday(dateHistory) && (
            <button
              type="button"
              onClick={resetDateHistory}
              className="flex items-center gap-1 bg-teal-500 hover:bg-teal-600 text-white px-2.5 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition-all"
              title="Kembali ke hari ini"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Hari Ini</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="flex-1 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-3 text-white shadow-md">
          <div className="text-[10px] font-semibold text-emerald-200 uppercase tracking-wide">Cycle Count</div>
          <div className="text-lg font-black mt-0.5">{totalCC.toLocaleString()}</div>
        </div>
        <div className="flex-1 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl p-3 text-white shadow-md">
          <div className="text-[10px] font-semibold text-indigo-200 uppercase tracking-wide">Product In</div>
          <div className="text-lg font-black mt-0.5">{totalIn.toLocaleString()}</div>
        </div>
      </div>

      <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-xl">
        <button
          onClick={() => switchTab('CC')}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
            tab === 'CC'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Cycle Count
        </button>
        <button
          onClick={() => switchTab('IN')}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
            tab === 'IN'
              ? 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-md'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Product In
        </button>
      </div>

      <div className="relative mb-3">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <Search className="w-4 h-4 text-slate-400" />
        </div>
        <input
          type="text"
          placeholder="Cari nama produk, SKU, atau Batch..."
          className="w-full bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 outline-none rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-900 transition-all"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {filtered.length > 0 && (
        <div className="mb-3 text-xs font-medium text-slate-500">
          {filtered.length} transaksi · {uniqueProducts} produk
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-10 text-slate-400">
          <List className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <div className="font-medium text-sm">Tidak ada data ditemukan</div>
        </div>
      ) : (
        <div ref={tableRef} className={`bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm ${isKeyboardVisible ? 'pb-32' : ''}`}>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <th className="text-left px-3 py-2.5 font-semibold">Produk</th>
                <th className="text-left px-2 py-2.5 font-semibold">Batch</th>
                <th className="text-right px-2 py-2.5 font-semibold">Qty</th>
                <th className="px-2 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(t => {
                const batchOptions = getBatchOptions(t);

                return editingId === t.id ? (
                  <tr key={t.id} className="bg-slate-50">
                    <td className="px-3 py-2.5 align-top">
                      <div className="font-semibold text-slate-900 leading-tight">{t.product}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{t.sku}</div>
                    </td>
                    <td className="px-2 py-2.5 align-top">
                      {t.type === 'CC' && batchOptions.length > 0 ? (
                        <select
                          className="w-24 px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-medium bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                          value={editBatch}
                          onChange={(e) => setEditBatch(e.target.value)}
                        >
                          {batchOptions.map(batch => (
                            <option key={batch} value={batch}>{batch}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="w-24 px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-medium bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                          value={editBatch}
                          onChange={(e) => setEditBatch(e.target.value)}
                        />
                      )}
                    </td>
                    <td className="px-2 py-2.5 align-top text-right">
                      <input
                        className={`w-20 px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-right bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all ${accentText}`}
                        value={editQtyRaw}
                        onChange={(e) => setEditQtyRaw(e.target.value)}
                        onFocus={() => {
                          // Scroll into view when focused on mobile
                          setTimeout(() => {
                            tableRef.current?.scrollIntoView({
                              behavior: 'smooth',
                              block: 'center',
                            });
                          }, 100);
                        }}
                        onBlur={() => setEditQtyRaw(calculateQty(editQtyRaw).toString())}
                      />
                    </td>
                    <td className="px-2 py-2.5 align-top">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => saveEdit(t)}
                          disabled={mutatingId === t.id}
                          className={`p-1.5 text-white rounded-lg ${tabBgClass} hover:opacity-90 disabled:opacity-60 transition-all`}
                          title="Simpan"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          disabled={mutatingId === t.id}
                          className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 disabled:opacity-60 transition-all"
                          title="Batal"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-900 leading-tight">{t.product}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{t.sku} · {t.user} · {formatDateShort(t.date)}</div>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="inline-block px-2 py-1 bg-amber-100 text-amber-700 rounded-md text-[10px] font-semibold whitespace-nowrap">{t.batch}</span>
                    </td>
                    <td className={`px-2 py-2.5 text-right text-base font-black ${accentText}`}>{t.qty}</td>
                    <td className="px-2 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => startEdit(t)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setPendingDelete(t)}
                          disabled={mutatingId === t.id}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-60"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">Hapus transaksi?</h3>
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-bold">{pendingDelete.product}</span> batch <span className="font-bold">{pendingDelete.batch}</span> akan dihapus dari Google Sheets.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setPendingDelete(null)}
                disabled={mutatingId === pendingDelete.id}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 disabled:opacity-60"
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(pendingDelete)}
                disabled={mutatingId === pendingDelete.id}
                className="px-4 py-2 text-xs font-semibold bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:opacity-60 shadow-md"
              >
                {mutatingId === pendingDelete.id ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
