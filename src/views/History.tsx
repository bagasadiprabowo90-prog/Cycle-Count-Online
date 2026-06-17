import { useRef, useState } from 'react';
import { useStore } from '../store';
import { Trash2, List, Save, X, Edit3, Search, CalendarDays, Loader2 } from 'lucide-react';
import { toYMD, toMDY, calculateQty, formatDateShort, isToday } from '../lib/calc';
import { Transaction } from '../types';

export default function History() {
  const { products, transactions, deleteTransaction, updateTransaction, dateHistory, setDateHistory, resetDateHistory, isSyncing, notify } = useStore();
  const dateInputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState<'IN' | 'CC'>('CC');
  const [searchQuery, setSearchQuery] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBatch, setEditBatch] = useState('');
  const [editQtyRaw, setEditQtyRaw] = useState('');
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);

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
  const countIn = transactions.filter(t => t.type === 'IN').length;
  const countCC = transactions.filter(t => t.type === 'CC').length;

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
    setTimeout(() => {
      editRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          Riwayat
          {isSyncing && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
        </h2>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <button
              type="button"
              onClick={openDatePicker}
              className={`flex items-center gap-1.5 border px-2.5 py-1.5 rounded-lg text-xs font-medium shadow-sm cursor-pointer transition-all ${
                isToday(dateHistory)
                  ? 'bg-teal-50 border-teal-200 text-teal-700'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>{formatDateShort(dateHistory)}</span>
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
              className="flex items-center gap-1 bg-teal-500 hover:bg-teal-600 text-white px-2 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all"
              title="Kembali ke hari ini"
            >
              Hari Ini
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards = Tab Switchers */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => switchTab('CC')}
          className={`flex-1 rounded-xl p-2.5 text-left transition-all ${
            tab === 'CC'
              ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md ring-2 ring-emerald-300'
              : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300'
          }`}
        >
          <div className={`text-[10px] font-semibold uppercase tracking-wide ${tab === 'CC' ? 'text-emerald-200' : 'text-slate-400'}`}>Cycle Count</div>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className={`text-lg font-black ${tab === 'CC' ? '' : 'text-slate-900'}`}>{totalCC.toLocaleString()}</span>
            <span className={`text-[10px] font-medium ${tab === 'CC' ? 'text-emerald-200' : 'text-slate-400'}`}>{countCC} rec</span>
          </div>
        </button>
        <button
          onClick={() => switchTab('IN')}
          className={`flex-1 rounded-xl p-2.5 text-left transition-all ${
            tab === 'IN'
              ? 'bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-md ring-2 ring-indigo-300'
              : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'
          }`}
        >
          <div className={`text-[10px] font-semibold uppercase tracking-wide ${tab === 'IN' ? 'text-indigo-200' : 'text-slate-400'}`}>Product In</div>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className={`text-lg font-black ${tab === 'IN' ? '' : 'text-slate-900'}`}>{totalIn.toLocaleString()}</span>
            <span className={`text-[10px] font-medium ${tab === 'IN' ? 'text-indigo-200' : 'text-slate-400'}`}>{countIn} rec</span>
          </div>
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Cari produk, SKU, batch..."
          className="w-full bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 outline-none rounded-lg pl-8 pr-3 py-2 text-xs text-slate-900 transition-all"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Counter */}
      {filtered.length > 0 && (
        <div className="mb-2 text-[11px] font-medium text-slate-400">
          {filtered.length} transaksi · {uniqueProducts} produk
        </div>
      )}

      {/* Loading skeleton */}
      {isSyncing && transactions.length === 0 && (
        <div className="space-y-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 p-3 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="h-3 bg-slate-200 rounded w-3/4 mb-2"></div>
                  <div className="h-2 bg-slate-100 rounded w-1/2"></div>
                </div>
                <div className="h-6 w-10 bg-slate-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isSyncing && filtered.length === 0 && (
        <div className="text-center py-10 text-slate-400">
          <List className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <div className="font-medium text-sm">Tidak ada data ditemukan</div>
        </div>
      )}

      {/* Transaction List - Card based */}
      {filtered.length > 0 && (
        <div className="space-y-1.5">
          {filtered.map(t => {
            const batchOptions = getBatchOptions(t);
            const isEditing = editingId === t.id;

            if (isEditing) {
              return (
                <div
                  key={t.id}
                  ref={editRef}
                  className="bg-indigo-50 rounded-xl border-2 border-indigo-200 p-3"
                >
                  <div className="font-semibold text-slate-900 text-xs leading-tight truncate mb-2">{t.product}</div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1 min-w-0">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5 block">Batch</label>
                      {t.type === 'CC' && batchOptions.length > 0 ? (
                        <select
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-medium bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                          value={editBatch}
                          onChange={(e) => setEditBatch(e.target.value)}
                        >
                          {batchOptions.map(batch => (
                            <option key={batch} value={batch}>{batch}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-medium bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                          value={editBatch}
                          onChange={(e) => setEditBatch(e.target.value)}
                        />
                      )}
                    </div>
                    <div className="w-[72px] shrink-0">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5 block">Qty</label>
                      <input
                        className={`w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-right bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 ${accentText}`}
                        value={editQtyRaw}
                        onChange={(e) => setEditQtyRaw(e.target.value)}
                        inputMode="numeric"
                        onFocus={(e) => e.target.select()}
                        onBlur={() => setEditQtyRaw(calculateQty(editQtyRaw).toString())}
                      />
                    </div>
                    <button
                      onClick={() => saveEdit(t)}
                      disabled={mutatingId === t.id}
                      className={`px-3 py-1.5 text-white rounded-lg text-xs font-semibold ${tabBgClass} hover:opacity-90 disabled:opacity-60 transition-all flex items-center gap-1 shrink-0`}
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      disabled={mutatingId === t.id}
                      className="p-1.5 bg-slate-200 text-slate-500 rounded-lg hover:bg-slate-300 disabled:opacity-60 transition-all shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={t.id}
                className="bg-white rounded-xl border border-slate-100 hover:border-slate-200 transition-all px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 text-xs leading-tight truncate">{t.product}</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="inline-block px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-semibold">{t.batch}</span>
                      <span className="text-[10px] text-slate-400 truncate">{t.user}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-base font-black tabular-nums ${accentText}`}>{t.qty}</span>
                    <button
                      onClick={() => startEdit(t)}
                      className="p-1 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setPendingDelete(t)}
                      disabled={mutatingId === t.id}
                      className="p-1 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-60"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation modal */}
      {pendingDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">Hapus transaksi?</h3>
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-bold">{pendingDelete.product}</span> batch <span className="font-bold">{pendingDelete.batch}</span> akan dihapus dari Google Sheets.
            </p>
            <div className="mt-4 flex justify-end gap-2">
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
