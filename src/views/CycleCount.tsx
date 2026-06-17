import { lazy, Suspense, useRef, useState, useEffect, type FormEvent, type Key } from 'react';
import { useStore } from '../store';
import { Camera, CheckSquare, X, CalendarDays } from 'lucide-react';
import { calculateQty, toYMD, toMDY, formatDateShort, isToday } from '../lib/calc';
import { Product } from '../types';

const ScannerModal = lazy(() => import('../components/ScannerModal'));

interface ChipProps {
  key?: Key;
  label: string;
  selected: boolean;
  onClick: () => void;
  color: 'emerald' | 'indigo';
}

function Chip({ label, selected, onClick, color }: ChipProps) {
  const baseClass = selected
    ? color === 'emerald' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md' : 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-md'
    : 'bg-slate-100 text-slate-600 hover:bg-slate-200';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${baseClass}`}
    >
      {label}
    </button>
  );
}

export default function CycleCount() {
  const { products, addTransaction, dateCC, setDateCC, resetDateCC, user, notify } = useStore();
  const dateInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const [sku, setSku] = useState('');
  const [productName, setProductName] = useState('');
  const [batch, setBatch] = useState('');
  const [qtyRaw, setQtyRaw] = useState('');

  const [showDropdown, setShowDropdown] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Handle keyboard visibility on mobile
  useEffect(() => {
    const handleViewportChange = () => {
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const documentHeight = document.documentElement.clientHeight;
      const keyboardVisible = viewportHeight < documentHeight - 100;
      setIsKeyboardVisible(keyboardVisible);

      // Scroll input into view when keyboard shows
      if (keyboardVisible && qtyInputRef.current) {
        setTimeout(() => {
          qtyInputRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }, 100);
      }
    };

    window.visualViewport?.addEventListener('resize', handleViewportChange);
    window.addEventListener('resize', handleViewportChange);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, []);

  const filteredProducts = search.length >= 2
    ? products.filter((p: Product) =>
        String(p.product || '').toLowerCase().includes(search.toLowerCase()) ||
        String(p.sku || '').toLowerCase().includes(search.toLowerCase()) ||
        String(p.barcode || '').toLowerCase().includes(search.toLowerCase()))
    : [];

  const availableBatches = sku
    ? Array.from(new Set(products.filter((p: Product) => p.sku === sku).map((p: Product) => p.batch)))
    : [];

  const handleSelect = (p: Product) => {
    setSku(p.sku);
    setProductName(p.product);
    setBatch(p.batch);
    setSearch('');
    setShowDropdown(false);
  };

  const handleScan = (code: string) => {
    setIsScannerOpen(false);
    const found = products.find(p => p.barcode === code);
    if (found) {
      handleSelect(found);
    } else {
      setSearch(code);
      notify('error', 'Barcode tidak ditemukan di master, silakan isi data baru.');
    }
  };

  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') input.showPicker();
    else input.click();
  };

  const normalizeQtyInput = () => {
    const raw = qtyRaw.trim();
    if (!raw) {
      setQtyRaw('');
      return;
    }

    setQtyRaw(calculateQty(raw).toString());
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const finalQty = calculateQty(qtyRaw);
    if (!sku || !batch || finalQty <= 0) {
      notify('error', 'Pilih produk, isi batch, dan pastikan Qty valid.');
      return;
    }

    const realBarcode = products.find(p => p.sku === sku && p.batch === batch)?.barcode || `NEW-${sku}-${batch}`;

    setIsSaving(true);
    const result = await addTransaction({
      type: 'CC',
      date: dateCC,
      barcode: realBarcode,
      sku,
      product: productName,
      batch,
      qty: finalQty,
      user: user!
    });
    setIsSaving(false);

    if (!result.success) {
      notify('error', `Gagal sync: ${result.message}`);
      return;
    }

    setSku(''); setProductName(''); setBatch(''); setQtyRaw('');
    notify('success', 'Cycle Count berhasil disimpan.');
  };

  return (
    <div className="text-sm">
      {isScannerOpen && (
        <Suspense fallback={null}>
          <ScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScan={handleScan} />
        </Suspense>
      )}

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-base font-bold text-slate-900">Cycle Count</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={openDatePicker}
              className={`flex items-center gap-1.5 border text-slate-700 px-3 py-1.5 rounded-xl text-xs font-medium shadow-sm cursor-pointer transition-all ${
                isToday(dateCC)
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2"/>
                <path d="M16 2v4M8 2v4M3 10h18" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span className="font-medium">{formatDateShort(dateCC)}</span>
            </button>
            <input
              ref={dateInputRef}
              type="date"
              className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
              value={toYMD(dateCC)}
              onChange={(e) => {
                if (e.target.value) setDateCC(toMDY(e.target.value));
              }}
            />
          </div>
          {!isToday(dateCC) && (
            <button
              type="button"
              onClick={resetDateCC}
              className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white px-2.5 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition-all"
              title="Kembali ke hari ini"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Hari Ini</span>
            </button>
          )}
        </div>
      </div>

      <div className={`bg-white rounded-2xl p-5 border border-slate-200 shadow-sm ${isKeyboardVisible ? 'pb-28' : ''}`}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="relative">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Cari Product</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  className="w-full pl-3 pr-8 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                  placeholder="Ketik SKU atau Nama..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setShowDropdown(true);
                  }}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => { setSearch(''); setShowDropdown(false); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-3 rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all shadow-md flex items-center justify-center"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>

            {showDropdown && filteredProducts.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 shadow-lg rounded-xl max-h-52 overflow-y-auto z-50">
                {filteredProducts.map((p, idx) => (
                  <div
                    key={`${p.barcode}-${p.batch}-${idx}`}
                    className="px-4 py-3 border-b border-slate-100 cursor-pointer hover:bg-emerald-50 transition-colors"
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(p); }}
                  >
                    <div className="font-medium text-slate-900 text-sm">{p.product}</div>
                    <div className="text-xs text-slate-500 mt-0.5">SKU: {p.sku} · Batch: {p.batch}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Nama Product</label>
            <input
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 outline-none"
              value={productName}
              readOnly
              placeholder="-"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">SKU</label>
              <input
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 outline-none"
                value={sku}
                readOnly
                placeholder="-"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Batch</label>
              <input
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all font-medium"
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                placeholder="Ketik batch"
              />
            </div>
          </div>

          {availableBatches.length >= 1 && (
            <div className="flex flex-wrap gap-1.5">
              {availableBatches.map(b => (
                <Chip
                  key={b}
                  label={b}
                  selected={batch === b}
                  onClick={() => {
                    setBatch(b);
                    setTimeout(() => qtyInputRef.current?.focus(), 50);
                  }}
                  color="emerald"
                />
              ))}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              Qty Fisik <span className="text-slate-400 font-normal ml-1">10+5 atau 20*3</span>
            </label>
            <input
              ref={qtyInputRef}
              className="w-full px-4 py-3.5 border-2 border-dashed border-teal-300 rounded-2xl text-center text-2xl font-bold text-teal-600 bg-gradient-to-br from-teal-50/50 to-white focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              placeholder="0"
              value={qtyRaw}
              onChange={(e) => setQtyRaw(e.target.value)}
              onFocus={(e) => {
                if (qtyRaw === '0') setQtyRaw('');
                else e.currentTarget.select();
                // Scroll into view when focused
                setTimeout(() => {
                  qtyInputRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                  });
                }, 100);
              }}
              onBlur={normalizeQtyInput}
            />
          </div>

          {/* Sticky submit button - always visible above keyboard */}
          <div className={`${isKeyboardVisible ? 'fixed bottom-20 left-4 right-4 max-w-md mx-auto z-40 shadow-lg' : ''}`}>
            <button
              type="submit"
              disabled={isSaving}
              className={`w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-bold py-3.5 rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all shadow-md flex justify-center items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${isKeyboardVisible ? 'rounded-2xl' : ''}`}
            >
              <CheckSquare className="w-4 h-4" />
              {isSaving ? 'Menyimpan...' : 'Simpan Cycle Count'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
