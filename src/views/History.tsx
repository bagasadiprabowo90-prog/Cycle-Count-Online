import { useRef, useState } from 'react';
import { useStore } from '../store';
import { Trash2, List, Save, X, Edit3, Search, CalendarDays, Loader2 } from 'lucide-react';
import { toYMD, toMDY, calculateQty, formatDateShort, isToday } from '../lib/calc';
import { Transaction } from '../types';

/** Shorten product name: "[CPPW03] COMPACT POWDER (Beige)" → "COMPACT POWDER (Beige)" */
function shortName(product: string) {
  return product.replace(/^\[.*?\]\s*/, '');
}

export default function History() {
  const { products, transactions, deleteTransaction, updateTransaction, dateHistory, setDateHistory, resetDateHistory, isSyncing, notify } = useStore();
  const dateInputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLDivElement>(null);

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
      return String(t.product || '').toLowerCase().includes(q) || String(t.sku || '').toLowerCase().includes(q) || String(t.batch || '').toLowerCase().includes(q);
    }
    return true;
  });

  const uniqueProducts = new Set(filtered.map(t => String(t.sku || t.product || '-'))).size;

  const totalIn = transactions.filter(t => t.type === 'IN').reduce((sum, t) => sum + t.qty, 0);
  const totalCC = transactions.filter(t => t.type === 'CC').reduce((sum, t) => sum + t.qty, 0);
  const countIn = transactions.filter(t => t.type === 'IN').length;
  const countCC = transactions.filter(t => t.type === 'CC').length;

  const tabBgClass = tab === 'IN' ? 'bg-gradient-to-r from-emerald-600 to-teal-600' : 'bg-gradient-to-r from-emerald-500 to-teal-500';
  const accentText = tab === 'IN' ? 'text-emerald-600' : 'text-emerald-600';

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

  const saveEdit = (t: Transaction) => {
    const finalQty = calculateQty(editQtyRaw);
    if (finalQty <= 0 || !editBatch) {
      notify('error', 'Batch dan Qty harus diisi dengan benar.');
      return;
    }
    const selectedProduct = products.find(p => p.sku === t.sku && p.batch === editBatch);
    
    // Close editing instantly
    setEditingId(null);

    // Update in background
    updateTransaction(t.id, t.type, {
      ...t,
      barcode: selectedProduct?.barcode || t.barcode,
      product: selectedProduct?.product || t.product,
      batch: editBatch,
      qty: finalQty
    }).then((result) => {
      if (!result.success) {
        notify('error', `Gagal update: ${result.message}`);
      } else {
        notify('success', 'Data berhasil diupdate.');
      }
    }).catch(() => {
      notify('error', 'Terjadi kesalahan saat mengupdate.');
    });
  };

  const handleDelete = (t: Transaction) => {
    // Hide confirmation dialog instantly
    setPendingDelete(null);

    // Delete in background
    deleteTransaction(t.id, t.type).then((result) => {
      if (!result.success) {
        notify('error', `Gagal hapus: ${result.message}`);
      } else {
        notify('success', 'Data berhasil dihapus.');
      }
    }).catch(() => {
      notify('error', 'Terjadi kesalahan saat menghapus.');
    });
  };

  return (
    <div className="text-sm pb-10">
      {/* Header row: title + date */}
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
          Riwayat
          {isSyncing && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
        </h2>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <button
              type="button"
              onClick={openDatePicker}
              className={`flex items-center gap-1 border px-2 py-1 rounded-lg text-[11px] font-medium cursor-pointer transition-all ${
                isToday(dateHistory)
                  ? 'bg-teal-50 border-teal-200 text-teal-700'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              <CalendarDays className="w-3 h-3" />
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
              className="bg-teal-500 text-white px-2 py-1 rounded-lg text-[11px] font-semibold"
            >
              Hari Ini
            </button>
          )}
        </div>
      </div>

      {/* Tab Switcher Cards */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <button
          onClick={() => switchTab('CC')}
          className={`rounded-lg px-3 py-2 text-left transition-all ${
            tab === 'CC'
              ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow ring-2 ring-emerald-200/60'
              : 'bg-white border border-slate-200'
          }`}
        >
          <div className={`text-[9px] font-bold uppercase tracking-wider ${tab === 'CC' ? 'text-emerald-100' : 'text-slate-400'}`}>Cycle Count</div>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className={`text-base font-black leading-none ${tab === 'CC' ? '' : 'text-slate-800'}`}>{totalCC.toLocaleString()}</span>
            <span className={`text-[9px] ${tab === 'CC' ? 'text-emerald-200' : 'text-slate-400'}`}>{countCC}x</span>
          </div>
        </button>
        <button
          onClick={() => switchTab('IN')}
          className={`rounded-lg px-3 py-2 text-left transition-all ${
            tab === 'IN'
              ? 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow ring-2 ring-emerald-200/60'
              : 'bg-white border border-slate-200'
          }`}
        >
          <div className={`text-[9px] font-bold uppercase tracking-wider ${tab === 'IN' ? 'text-emerald-100' : 'text-slate-400'}`}>Product In</div>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className={`text-base font-black leading-none ${tab === 'IN' ? '' : 'text-slate-800'}`}>{totalIn.toLocaleString()}</span>
            <span className={`text-[9px] ${tab === 'IN' ? 'text-emerald-200' : 'text-slate-400'}`}>{countIn}x</span>
          </div>
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-2">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 pointer-events-none" />
        <input
          type="text"
          placeholder="Cari produk, SKU, batch..."
          className="w-full bg-white border border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/20 outline-none rounded-lg pl-7 pr-3 py-1.5 text-[11px] text-slate-800 transition-all"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Counter */}
      {filtered.length > 0 && (
        <div className="mb-1.5 text-[10px] font-medium text-slate-400">
          {filtered.length} transaksi · {uniqueProducts} produk
        </div>
      )}

      {/* Loading skeleton */}
      {isSyncing && transactions.length === 0 && (
        <div className="space-y-1">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="bg-white rounded-lg border border-slate-100 px-3 py-2 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="h-3 bg-slate-200 rounded w-2/3 mb-1.5"></div>
                  <div className="h-2 bg-slate-100 rounded w-1/3"></div>
                </div>
                <div className="h-5 w-8 bg-slate-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isSyncing && filtered.length === 0 && (
        <div className="text-center py-8 text-slate-400">
          <List className="w-7 h-7 mx-auto mb-1.5 opacity-40" />
          <div className="text-xs font-medium">Tidak ada data</div>
        </div>
      )}

      {/* Dense Transaction List */}
      {filtered.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden divide-y divide-slate-100">
          {filtered.map(t => {
            const batchOptions = getBatchOptions(t);
            const isEditing = editingId === t.id;

            if (isEditing) {
              return (
                <div
                  key={t.id}
                  ref={editRef}
                  className="bg-emerald-50/80 px-3 py-2.5"
                >
                  <div className="text-[11px] font-semibold text-slate-800 truncate mb-1.5">
                    <span className="text-slate-400 font-medium">{t.sku}</span> {shortName(t.product)}
                  </div>
                  <div className="flex items-end gap-1.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Batch</div>
                      {t.type === 'CC' && batchOptions.length > 0 ? (
                        <select
                          className="w-full px-1.5 py-1 border border-slate-300 rounded text-[11px] font-medium bg-white focus:outline-none focus:border-emerald-400"
                          value={editBatch}
                          onChange={(e) => setEditBatch(e.target.value)}
                        >
                          {batchOptions.map(batch => (
                            <option key={batch} value={batch}>{batch}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="w-full px-1.5 py-1 border border-slate-300 rounded text-[11px] font-medium bg-white focus:outline-none focus:border-emerald-400"
                          value={editBatch}
                          onChange={(e) => setEditBatch(e.target.value)}
                        />
                      )}
                    </div>
                    <div className="w-16 shrink-0">
                      <div className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Qty</div>
                      <input
                        className={`w-full px-1.5 py-1 border border-slate-300 rounded text-[11px] font-bold text-right bg-white focus:outline-none focus:border-emerald-400 ${accentText}`}
                        value={editQtyRaw}
                        onChange={(e) => setEditQtyRaw(e.target.value)}
                        inputMode="numeric"
                        onFocus={(e) => e.target.select()}
                        onBlur={() => setEditQtyRaw(calculateQty(editQtyRaw).toString())}
                      />
                    </div>
                    <button
                      onClick={() => saveEdit(t)}
                      className={`px-2.5 py-1 text-white rounded text-[11px] font-semibold ${tabBgClass} flex items-center gap-1 shrink-0`}
                    >
                      <Save className="w-3 h-3" />
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1 bg-slate-200 text-slate-500 rounded shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={t.id} className="flex items-center px-3 py-1.5 hover:bg-slate-50/60 transition-colors">
                {/* Product + batch */}
                <div className="flex-1 min-w-0 mr-2">
                  <div className="text-[11px] font-semibold text-slate-800 truncate leading-tight">
                    {shortName(t.product)}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[9px] font-semibold text-slate-400">{t.sku}</span>
                    <span className="text-[9px] text-slate-300">·</span>
                    <span className="px-1 py-px bg-amber-50 text-amber-600 rounded text-[9px] font-semibold leading-none">{t.batch}</span>
                    <span className="text-[9px] text-slate-300">·</span>
                    <span className="text-[9px] text-slate-500 font-medium">{formatDateShort(t.date)}</span>
                  </div>
                </div>
                {/* Qty */}
                <span className={`text-sm font-black tabular-nums mr-1.5 ${accentText}`}>{t.qty}</span>
                {/* Actions */}
                <button
                  onClick={() => startEdit(t)}
                  className="p-1 text-slate-300 hover:text-emerald-500 rounded transition-colors"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setPendingDelete(t)}
                  className="p-1 text-slate-300 hover:text-red-500 rounded transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete modal */}
      {pendingDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl bg-white p-4 shadow-2xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">Hapus transaksi?</h3>
            <p className="mt-1.5 text-xs text-slate-600">
              <span className="font-bold">{pendingDelete.product}</span> batch <span className="font-bold">{pendingDelete.batch}</span> akan dihapus.
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setPendingDelete(null)}
                className="px-3 py-1.5 text-[11px] font-semibold bg-slate-100 text-slate-600 rounded-lg"
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(pendingDelete)}
                className="px-3 py-1.5 text-[11px] font-semibold bg-red-500 text-white rounded-lg"
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
