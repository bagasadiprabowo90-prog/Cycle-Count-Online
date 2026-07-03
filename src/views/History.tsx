import { useRef, useState } from 'react';
import { useStore } from '../store';
import { Trash2, List, Save, X, Edit3, Search, CalendarDays, Loader2, User } from 'lucide-react';
import { toYMD, toMDY, calculateQty, formatDateShort, isToday } from '../lib/calc';
import { Transaction } from '../types';

/** Shorten product name: "[CPPW03] COMPACT POWDER (Beige)" → "COMPACT POWDER (Beige)" */
function shortName(product: string) {
  return product.replace(/^\[.*?\]\s*/, '');
}

export default function History() {
  const { products, transactions, deleteTransaction, updateTransaction, dateHistory, setDateHistory, resetDateHistory, isSyncing, notify } = useStore();
  const dateInputRef = useRef<HTMLInputElement>(null);
  const editBatchRef = useRef<HTMLInputElement>(null);
  const editQtyRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<'IN' | 'CC'>('CC');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBatch, setEditBatch] = useState('');
  const [editQtyRaw, setEditQtyRaw] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);

  const filtered = transactions.filter(t => {
    if (t.type !== tab) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        String(t.product || '').toLowerCase().includes(q) ||
        String(t.sku || '').toLowerCase().includes(q) ||
        String(t.batch || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const uniqueProducts = new Set(filtered.map(t => String(t.sku || t.product || '-'))).size;
  const totalIn = transactions.filter(t => t.type === 'IN').reduce((s, t) => s + t.qty, 0);
  const totalCC = transactions.filter(t => t.type === 'CC').reduce((s, t) => s + t.qty, 0);
  const countIn = transactions.filter(t => t.type === 'IN').length;
  const countCC = transactions.filter(t => t.type === 'CC').length;

  const switchTab = (next: 'IN' | 'CC') => {
    setTab(next);
    setEditingId(null);
  };

  const startEdit = (t: Transaction) => {
    if (editingId === t.id) {
      setEditingId(null);
      return;
    }
    setEditingId(t.id);
    setEditBatch(t.batch);
    setEditQtyRaw(t.qty.toString());
    setTimeout(() => editQtyRef.current?.focus(), 200);
  };

  const getBatchOptions = (t: Transaction) => {
    const opts = products.filter(p => p.sku === t.sku).map(p => p.batch || '');
    const unique = Array.from(new Set(opts));
    if (t.batch && !unique.includes(t.batch)) return [t.batch, ...unique];
    return unique;
  };

  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') input.showPicker();
    else input.click();
  };

  const saveEdit = (t: Transaction) => {
    const finalQty = calculateQty(editQtyRaw);
    if (finalQty <= 0) {
      notify('error', 'Qty harus diisi dengan benar.');
      return;
    }
    const finalBatch = editBatch || '';
    const selectedProduct = products.find(p => p.sku === t.sku && p.batch === finalBatch);
    setEditingId(null);
    updateTransaction(t.id, t.type, {
      ...t,
      barcode: selectedProduct?.barcode || t.barcode,
      product: selectedProduct?.product || t.product,
      batch: finalBatch,
      qty: finalQty,
    }).then(result => {
      if (!result.success) notify('error', `Gagal update: ${result.message}`);
      else notify('success', 'Data berhasil diupdate.');
    }).catch(() => notify('error', 'Terjadi kesalahan saat mengupdate.'));
  };

  const handleDelete = (t: Transaction) => {
    setPendingDelete(null);
    deleteTransaction(t.id, t.type).then(result => {
      if (!result.success) notify('error', `Gagal hapus: ${result.message}`);
      else notify('success', 'Data berhasil dihapus.');
    }).catch(() => notify('error', 'Terjadi kesalahan saat menghapus.'));
  };

  return (
    <div className="text-sm pb-10">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
          Riwayat
          {isSyncing && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
        </h2>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <button
              type="button"
              onClick={openDatePicker}
              className={`flex items-center gap-1.5 border px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-all ${
                isToday(dateHistory)
                  ? 'bg-teal-50 border-teal-200 text-teal-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              {formatDateShort(dateHistory)}
            </button>
            <input
              ref={dateInputRef}
              type="date"
              className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
              value={toYMD(dateHistory)}
              onChange={(e) => { if (e.target.value) setDateHistory(toMDY(e.target.value)); }}
            />
          </div>
          {!isToday(dateHistory) && (
            <button
              type="button"
              onClick={resetDateHistory}
              className="bg-teal-500 hover:bg-teal-600 text-white px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
            >
              Hari Ini
            </button>
          )}
        </div>
      </div>

      {/* Tab summary cards */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          onClick={() => switchTab('CC')}
          className={`rounded-xl px-3 py-2.5 text-left transition-all ${
            tab === 'CC'
              ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md ring-2 ring-emerald-200/60'
              : 'bg-white border border-slate-200 hover:border-emerald-200'
          }`}
        >
          <div className={`text-[9px] font-bold uppercase tracking-wider mb-1 ${tab === 'CC' ? 'text-emerald-100' : 'text-slate-400'}`}>
            Cycle Count
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-xl font-black leading-none ${tab === 'CC' ? 'text-white' : 'text-slate-800'}`}>
              {totalCC.toLocaleString()}
            </span>
            <span className={`text-[10px] font-semibold ${tab === 'CC' ? 'text-emerald-100' : 'text-slate-400'}`}>
              {countCC}x
            </span>
          </div>
        </button>
        <button
          onClick={() => switchTab('IN')}
          className={`rounded-xl px-3 py-2.5 text-left transition-all ${
            tab === 'IN'
              ? 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-md ring-2 ring-emerald-200/60'
              : 'bg-white border border-slate-200 hover:border-emerald-200'
          }`}
        >
          <div className={`text-[9px] font-bold uppercase tracking-wider mb-1 ${tab === 'IN' ? 'text-emerald-100' : 'text-slate-400'}`}>
            Product In
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-xl font-black leading-none ${tab === 'IN' ? 'text-white' : 'text-slate-800'}`}>
              {totalIn.toLocaleString()}
            </span>
            <span className={`text-[10px] font-semibold ${tab === 'IN' ? 'text-emerald-100' : 'text-slate-400'}`}>
              {countIn}x
            </span>
          </div>
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 pointer-events-none" />
        <input
          type="text"
          placeholder="Cari produk, SKU, atau batch..."
          className="w-full bg-white border border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/20 outline-none rounded-xl pl-9 pr-8 py-2 text-xs text-slate-800 transition-all"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
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
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 px-4 py-3.5 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="h-3.5 bg-slate-200 rounded w-3/4 mb-2" />
                  <div className="flex gap-1.5">
                    <div className="h-4 bg-slate-100 rounded w-14" />
                    <div className="h-4 bg-slate-100 rounded w-10" />
                  </div>
                </div>
                <div className="h-8 w-12 bg-slate-200 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isSyncing && filtered.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <List className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <div className="text-xs font-medium">Tidak ada data</div>
        </div>
      )}

      {/* Transaction list */}
      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map(t => {
            const batchOptions = getBatchOptions(t);
            const isEditing = editingId === t.id;

            return (
              <div
                key={t.id}
                className={`bg-white rounded-xl border overflow-hidden transition-all ${
                  isEditing
                    ? 'border-emerald-300 shadow-md shadow-emerald-100/50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Main row – spacious padding for easy reading */}
                <div className={`flex items-center px-3.5 py-3 gap-3 ${isEditing ? 'bg-emerald-50/30' : ''}`}>
                  {/* Product info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-1.5">
                      <span className="text-[13px] font-bold text-slate-800 leading-snug line-clamp-2">
                        {shortName(t.product)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex text-[10px] font-mono font-semibold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                        {t.sku}
                      </span>
                      {t.batch && (
                        <span className="inline-flex text-[10px] font-semibold bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-100/80">
                          {t.batch}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400">{formatDateShort(t.date)}</span>
                      {t.user && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400">
                          <User className="w-2.5 h-2.5" />
                          {t.user}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Qty badge – large and prominent */}
                  <div className="shrink-0">
                    <span className="inline-flex items-center justify-center min-w-[2.75rem] px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200/60 text-lg font-black tabular-nums text-emerald-600">
                      {t.qty}
                    </span>
                  </div>

                  {/* Action buttons – rounded pill, large touch targets */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => startEdit(t)}
                      className={`p-2.5 rounded-full transition-all active:scale-95 ${
                        isEditing
                          ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200'
                          : 'bg-blue-50 text-blue-500 hover:bg-blue-100 active:bg-blue-200'
                      }`}
                      title="Edit"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPendingDelete(t)}
                      className="p-2.5 rounded-full bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-500 active:bg-red-200 transition-all active:scale-95"
                      title="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Edit panel – slide-down accordion below the row */}
                {isEditing && (
                  <div className="px-3.5 pb-3.5 bg-gradient-to-b from-emerald-50/40 to-emerald-50/20 border-t border-emerald-100">
                    <div className="bg-white rounded-xl border border-emerald-200/70 p-4 shadow-sm mt-3">
                      <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-3">
                        Edit Transaksi
                      </div>
                      <div className="space-y-3">
                        {/* Batch */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Batch</label>
                          {t.type === 'CC' && batchOptions.length > 0 ? (
                            <select
                              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400 transition-all"
                              value={editBatch}
                              onChange={(e) => setEditBatch(e.target.value)}
                            >
                              {batchOptions.map(b => (
                                <option key={b} value={b}>{b || '(Tanpa Batch)'}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              ref={editBatchRef}
                              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400 transition-all"
                              value={editBatch}
                              onChange={(e) => setEditBatch(e.target.value)}
                              placeholder="Batch (opsional)"
                            />
                          )}
                        </div>

                        {/* Qty */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                            Qty <span className="font-normal text-slate-400 ml-1">10+5 atau 20*3</span>
                          </label>
                          <input
                            ref={editQtyRef}
                            className="w-full px-3 py-3.5 border-2 border-dashed border-emerald-300 rounded-xl text-center text-2xl font-black text-emerald-600 bg-emerald-50/40 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 transition-all"
                            value={editQtyRaw}
                            onChange={(e) => setEditQtyRaw(e.target.value)}
                            inputMode="numeric"
                            onFocus={(e) => e.target.select()}
                            onBlur={() => setEditQtyRaw(calculateQty(editQtyRaw).toString())}
                          />
                        </div>

                        {/* Buttons – full-width stacked */}
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => saveEdit(t)}
                            className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold py-3.5 rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98]"
                          >
                            <Save className="w-3.5 h-3.5" />
                            Simpan Perubahan
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-5 py-3.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-200 transition-all active:scale-[0.98]"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation modal */}
      {pendingDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-red-100 rounded-xl shrink-0">
                <Trash2 className="w-4 h-4 text-red-500" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Hapus transaksi?</h3>
            </div>
            <p className="text-xs text-slate-600 mb-1 leading-relaxed">
              <span className="font-bold text-slate-800">{shortName(pendingDelete.product)}</span>
              {pendingDelete.batch ? (
                <> · <span className="font-semibold text-amber-600">{pendingDelete.batch}</span></>
              ) : ''}
            </p>
            <p className="text-xs text-slate-500 mb-4">
              Qty <span className="font-bold text-emerald-600">{pendingDelete.qty}</span> akan dihapus permanen.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPendingDelete(null)}
                className="flex-1 px-3 py-2.5 text-xs font-semibold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all"
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(pendingDelete)}
                className="flex-1 px-3 py-2.5 text-xs font-bold bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
