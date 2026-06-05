import { useRef, useState } from 'react';
import { useStore } from '../store';
import { Trash2, List, Save, X, Edit3, Search } from 'lucide-react';
import { toYMD, toMDY, calculateQty, formatDateShort } from '../lib/calc';
import { Transaction } from '../types';

export default function History() {
  const { transactions, deleteTransaction, updateTransaction, dateHistory, setDateHistory, isSyncing, notify } = useStore();
  const dateInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<'IN' | 'CC'>('IN');
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

  const totalIn = transactions.filter(t => t.type === 'IN').reduce((sum, t) => sum + t.qty, 0);
  const totalCC = transactions.filter(t => t.type === 'CC').reduce((sum, t) => sum + t.qty, 0);

  const tabBgClass = tab === 'IN' ? 'bg-gradient-to-r from-indigo-500 to-blue-500' : 'bg-gradient-to-r from-emerald-500 to-teal-500';

  const startEdit = (t: Transaction) => {
    setEditingId(t.id);
    setEditBatch(t.batch);
    setEditQtyRaw(t.qty.toString());
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

    setMutatingId(t.id);
    const result = await updateTransaction(t.id, t.type, { ...t, batch: editBatch, qty: finalQty });
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
        <div className="relative">
          <button
            type="button"
            onClick={openDatePicker}
            className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-medium shadow-sm cursor-pointer"
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
      </div>

      <div className="flex gap-3 mb-4">
        <div className="flex-1 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl p-3 text-white shadow-md">
          <div className="text-[10px] font-semibold text-indigo-200 uppercase tracking-wide">Product In</div>
          <div className="text-lg font-black mt-0.5">{totalIn.toLocaleString()}</div>
        </div>
        <div className="flex-1 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-3 text-white shadow-md">
          <div className="text-[10px] font-semibold text-emerald-200 uppercase tracking-wide">Cycle Count</div>
          <div className="text-lg font-black mt-0.5">{totalCC.toLocaleString()}</div>
        </div>
      </div>

      <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-xl">
        <button
          onClick={() => setTab('IN')}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
            tab === 'IN'
              ? 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-md'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Product In
        </button>
        <button
          onClick={() => setTab('CC')}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
            tab === 'CC'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Cycle Count
        </button>
      </div>

      <div className="relative mb-4">
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

      <div className="space-y-3 mt-4">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <List className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <div className="font-medium text-sm">Tidak ada data ditemukan</div>
          </div>
        ) : (
          filtered.map(t => (
            <div
              key={t.id}
              className={`bg-white rounded-xl p-4 border-l-4 border-r border border-slate-200 transition-all hover:shadow-md ${
                t.type === 'IN' ? 'border-l-indigo-500' : 'border-l-emerald-500'
              }`}
            >
              {editingId === t.id ? (
                <div>
                  <div className="font-bold text-slate-900 mb-3">{t.product}</div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Batch</label>
                      <input
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        value={editBatch}
                        onChange={(e) => setEditBatch(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Qty</label>
                      <input
                        className={`w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all ${t.type === 'IN' ? 'text-indigo-600' : 'text-emerald-600'}`}
                        value={editQtyRaw}
                        onChange={(e) => setEditQtyRaw(e.target.value)}
                        onBlur={() => setEditQtyRaw(calculateQty(editQtyRaw).toString())}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setEditingId(null)}
                      disabled={mutatingId === t.id}
                      className="px-3 py-1.5 flex items-center gap-1 text-xs font-semibold bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 disabled:opacity-60"
                    >
                      <X className="w-3 h-3" /> Batal
                    </button>
                    <button
                      onClick={() => saveEdit(t)}
                      disabled={mutatingId === t.id}
                      className={`px-3 py-1.5 flex items-center gap-1 text-xs font-semibold text-white rounded-lg ${tabBgClass} hover:opacity-90 disabled:opacity-60`}
                    >
                      <Save className="w-3 h-3" />
                      {mutatingId === t.id ? 'Sync...' : 'Simpan'}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-bold text-slate-900">{t.product}</div>
                    <div className={`text-xl font-black ${t.type === 'IN' ? 'text-indigo-600' : 'text-emerald-600'}`}>{t.qty}</div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold text-white ${tabBgClass}`}>
                      {t.type === 'IN' ? 'PRODUCT IN' : 'CYCLE COUNT'}
                    </span>
                    <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-md text-[10px] font-semibold">Batch {t.batch}</span>
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] font-semibold">{t.user}</span>
                    <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-md text-[10px] font-medium">{formatDateShort(t.date)}</span>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-slate-100 gap-3">
                    <button
                      onClick={() => startEdit(t)}
                      className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors py-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => setPendingDelete(t)}
                      disabled={mutatingId === t.id}
                      className="flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700 transition-colors py-1 disabled:opacity-60"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {mutatingId === t.id ? 'Sync...' : 'Hapus'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

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
