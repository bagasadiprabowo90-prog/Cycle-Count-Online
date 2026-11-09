<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { useStore } from '../store';
import { Product } from '../types';
import { calculateQty, toYMD, toMDY, formatDateShort, isToday } from '../lib/calc';
import {
  Camera,
  CalendarDays,
  Search,
  X,
  PackagePlus,
  Package,
  CheckCircle,
  Layers,
  Delete,
  Calculator,
} from 'lucide-vue-next';
import ScannerModal from '../components/ScannerModal.vue';
import BatchModal from '../components/BatchModal.vue';

const store = useStore();

const searchRef = ref<HTMLInputElement | null>(null);
const qtyInputRef = ref<HTMLInputElement | null>(null);
const dateInputRef = ref<HTMLInputElement | null>(null);

const search = ref('');
const sku = ref('');
const productName = ref('');
const batch = ref('');
const qtyRaw = ref('');
const showDropdown = ref(false);
const isScannerOpen = ref(false);
const isBatchModalOpen = ref(false);

const filteredProducts = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (q.length < 2) return [];
  return store.products.filter(
    (p: Product) =>
      String(p.product || '').toLowerCase().includes(q) ||
      String(p.sku || '').toLowerCase().includes(q) ||
      String(p.barcode || '').toLowerCase().includes(q)
  );
});

const availableBatches = computed(() => {
  if (!sku.value) return [];
  const list = store.products
    .filter((p) => p.sku === sku.value && p.batch)
    .map((p) => p.batch);
  return Array.from(new Set(list));
});

// Real-time calculation preview
const calculatedQty = computed(() => {
  if (!qtyRaw.value.trim()) return null;
  return calculateQty(qtyRaw.value);
});

const hasFormula = computed(() => {
  return /[+\-*x×÷/]/.test(qtyRaw.value);
});

// Auto-open batch modal when product is selected
const selectProduct = (p: Product, skipBatchModal = false) => {
  sku.value = p.sku;
  productName.value = p.product;
  batch.value = p.batch || '';
  search.value = '';
  showDropdown.value = false;

  const batches = store.products
    .filter((item) => item.sku === p.sku && item.batch)
    .map((item) => item.batch);
  const uniqueBatches = Array.from(new Set(batches));

  if (!skipBatchModal && uniqueBatches.length > 0) {
    isBatchModalOpen.value = true;
  } else {
    nextTick(() => {
      qtyInputRef.value?.focus();
    });
  }
};

const handleBatchSelected = (selectedB: string) => {
  batch.value = selectedB;
  isBatchModalOpen.value = false;
  nextTick(() => {
    qtyInputRef.value?.focus();
  });
};

const handleScanResult = (code: string) => {
  isScannerOpen.value = false;
  const found = store.products.find((p) => p.barcode === code);
  if (found) {
    selectProduct(found, false);
    store.notify('success', `Barcode terdeteksi: ${found.sku}`);
  } else {
    search.value = code;
    showDropdown.value = true;
    store.notify('info', 'Barcode baru. Silakan pilih produk terkait.');
  }
};

const openDatePicker = () => {
  const input = dateInputRef.value;
  if (!input) return;
  if (typeof (input as any).showPicker === 'function') {
    (input as any).showPicker();
  } else {
    input.click();
  }
};

const onDateChange = (e: Event) => {
  const val = (e.target as HTMLInputElement).value;
  if (val) store.setDateIN(toMDY(val));
};

// Math Operation Buttons (+, -, x)
const appendOperator = (op: '+' | '-' | '×') => {
  const current = qtyRaw.value.trim();
  const symbol = op === '×' ? '*' : op;

  if (!current) {
    if (op === '-') qtyRaw.value = '-';
    return;
  }

  // If last char is already an operator, replace it
  if (/[+\-*x×]$/.test(current)) {
    qtyRaw.value = current.slice(0, -1) + symbol;
  } else {
    qtyRaw.value = current + symbol;
  }
  qtyInputRef.value?.focus();
};

const clearQty = () => {
  qtyRaw.value = '';
  qtyInputRef.value?.focus();
};

const backspaceQty = () => {
  if (qtyRaw.value.length > 0) {
    qtyRaw.value = qtyRaw.value.slice(0, -1);
  }
  qtyInputRef.value?.focus();
};

const adjustQty = (amount: number) => {
  const current = calculateQty(qtyRaw.value);
  const next = Math.max(0, current + amount);
  qtyRaw.value = next > 0 ? String(next) : '';
  qtyInputRef.value?.focus();
};

const handleSave = async () => {
  const finalQty = calculateQty(qtyRaw.value);
  if (!sku.value) {
    store.notify('error', 'Silakan pilih produk terlebih dahulu.');
    return;
  }
  if (finalQty <= 0) {
    store.notify('error', 'Masukkan jumlah Qty barang masuk yang valid.');
    qtyInputRef.value?.focus();
    return;
  }

  const finalBatch = batch.value.trim();
  const realBarcode =
    store.products.find((p) => p.sku === sku.value && p.batch === finalBatch)?.barcode ||
    `NEW-${sku.value}-${finalBatch || 'NOBATCH'}`;

  try {
    const res = await store.addTransaction({
      type: 'IN',
      date: store.dateIN,
      barcode: realBarcode,
      sku: sku.value,
      product: productName.value,
      batch: finalBatch,
      qty: finalQty,
      status: 'IN',
      user: store.user || 'Operator',
    });

    if (res.success) {
      store.notify('success', `Product In disimpan: ${sku.value} (+${finalQty} pcs)`);
    } else {
      store.notify('error', `Gagal sync: ${res.message}`);
    }
  } catch {
    store.notify('error', 'Gagal menyimpan transaksi Product In.');
  }

  // Reset form
  sku.value = '';
  productName.value = '';
  batch.value = '';
  qtyRaw.value = '';
  search.value = '';
  nextTick(() => {
    searchRef.value?.focus();
  });
};
</script>

<template>
  <div class="space-y-4">
    <!-- Scanner Modal -->
    <ScannerModal
      v-if="isScannerOpen"
      :is-open="isScannerOpen"
      @close="isScannerOpen = false"
      @scan="handleScanResult"
    />

    <!-- Batch Selection Modal (Centered Chips Popup) -->
    <BatchModal
      :is-open="isBatchModalOpen"
      :sku="sku"
      :product-name="productName"
      :batches="availableBatches"
      :selected-batch="batch"
      @close="isBatchModalOpen = false"
      @select="handleBatchSelected"
    />

    <!-- Header & Date Bar -->
    <div class="flex items-center justify-between gap-2">
      <div>
        <h2 class="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
          <PackagePlus class="w-4 h-4 text-teal-600" />
          <span>Product In</span>
        </h2>
        <p class="text-[11px] text-slate-500 font-medium">Pencatatan penerimaan barang masuk</p>
      </div>

      <div class="flex items-center gap-1.5">
        <div class="relative">
          <button
            type="button"
            @click="openDatePicker"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold border transition-all shadow-sm"
            :class="
              isToday(store.dateIN)
                ? 'bg-teal-50 text-teal-800 border-teal-200'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            "
          >
            <CalendarDays class="w-3.5 h-3.5 text-teal-600" />
            <span>{{ formatDateShort(store.dateIN) }}</span>
          </button>
          <input
            ref="dateInputRef"
            type="date"
            class="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
            :value="toYMD(store.dateIN)"
            @change="onDateChange"
          />
        </div>

        <button
          v-if="!isToday(store.dateIN)"
          type="button"
          @click="store.resetDateIN()"
          class="px-2.5 py-1.5 rounded-2xl text-[11px] font-bold bg-teal-600 text-white shadow-sm hover:bg-teal-700 transition-colors"
        >
          Hari Ini
        </button>
      </div>
    </div>

    <!-- Main Card Container -->
    <div class="neo-card p-5 space-y-4">
      <!-- Search & Barcode Trigger Row -->
      <div>
        <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
          Cari atau Scan Produk
        </label>
        <div class="flex gap-2">
          <div class="relative flex-1">
            <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              ref="searchRef"
              v-model="search"
              @focus="showDropdown = true"
              type="text"
              placeholder="Ketik SKU, Nama, atau Barcode..."
              class="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium"
            />
            <button
              v-if="search"
              type="button"
              @click="search = ''; showDropdown = false"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              <X class="w-4 h-4" />
            </button>

            <!-- Autocomplete Dropdown -->
            <div
              v-if="showDropdown && filteredProducts.length > 0"
              class="absolute left-0 right-0 top-full mt-2 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl z-30 max-h-56 overflow-y-auto divide-y divide-slate-100"
            >
              <button
                v-for="p in filteredProducts"
                :key="p.sku + (p.batch || '')"
                type="button"
                @click="selectProduct(p)"
                class="w-full px-4 py-2.5 text-left hover:bg-teal-50/70 transition-colors flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <div class="text-xs font-bold text-slate-900 group-hover:text-teal-700">
                    {{ p.product }}
                  </div>
                  <div class="text-[11px] font-mono text-slate-500 flex items-center gap-2 mt-0.5">
                    <span class="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-semibold">{{ p.sku }}</span>
                    <span v-if="p.batch" class="text-teal-600 font-medium">Batch: {{ p.batch }}</span>
                  </div>
                </div>
                <div class="text-[11px] font-mono text-slate-400">
                  {{ p.barcode }}
                </div>
              </button>
            </div>
          </div>

          <button
            type="button"
            @click="isScannerOpen = true"
            class="px-4 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white rounded-2xl shadow-lg shadow-teal-600/20 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
            title="Scan Barcode Kamera"
          >
            <Camera class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- Selected Product Badge -->
      <div v-if="sku" class="p-3.5 rounded-2xl bg-gradient-to-br from-teal-50/80 to-cyan-50/50 border border-teal-200/80">
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-start gap-2.5">
            <div class="p-2 rounded-xl bg-teal-600 text-white shadow-sm mt-0.5">
              <Package class="w-4 h-4" />
            </div>
            <div>
              <div class="text-xs font-bold text-slate-900 leading-snug">{{ productName }}</div>
              <div class="flex flex-wrap items-center gap-1.5 mt-1">
                <span class="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-white text-teal-800 border border-teal-200 shadow-xs">
                  {{ sku }}
                </span>
                <!-- Clickable Batch Pill that triggers Modal -->
                <button
                  type="button"
                  @click="isBatchModalOpen = true"
                  class="px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                  :class="batch ? 'bg-teal-600 text-white shadow-xs' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'"
                >
                  <Layers class="w-3 h-3" />
                  <span>{{ batch ? 'Batch: ' + batch : '+ Pilih Batch' }}</span>
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            @click="sku = ''; productName = ''; batch = '';"
            class="text-slate-400 hover:text-slate-600 p-1"
            title="Ganti Produk"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Batch Selector Quick Bar (With Pop-up Trigger) -->
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Nomor Batch
          </label>
          <button
            v-if="sku"
            type="button"
            @click="isBatchModalOpen = true"
            class="text-[11px] font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1 cursor-pointer"
          >
            <Layers class="w-3.5 h-3.5" />
            <span>Buka Pop-up Batch</span>
          </button>
        </div>

        <div class="space-y-2">
          <!-- Horizontal Chips for existing batches -->
          <div v-if="availableBatches.length > 0" class="flex flex-wrap gap-1.5">
            <button
              v-for="b in availableBatches"
              :key="b"
              type="button"
              @click="batch = b"
              class="px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              :class="
                batch === b
                  ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              "
            >
              {{ b }}
            </button>
          </div>

          <input
            v-model="batch"
            type="text"
            placeholder="Ketik batch manual atau klik pop-up..."
            class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-mono font-medium"
          />
        </div>
      </div>

      <!-- Quantity Stepper & Math Operator Toolbar (+, -, x) -->
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Jumlah Qty Masuk
          </label>

          <!-- Live Result Evaluator Badge -->
          <div
            v-if="hasFormula && calculatedQty !== null"
            class="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-teal-100 text-teal-800 flex items-center gap-1 animate-in fade-in"
          >
            <Calculator class="w-3 h-3 text-teal-600" />
            <span>= {{ calculatedQty }} pcs</span>
          </div>
          <span v-else class="text-[11px] text-slate-400 font-medium">Bisa hitung karton (cth: 24*10)</span>
        </div>

        <div class="space-y-2">
          <div class="relative">
            <input
              ref="qtyInputRef"
              v-model="qtyRaw"
              type="text"
              inputmode="decimal"
              placeholder="0 (cth: 24*5)"
              @keyup.enter="handleSave"
              class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-base sm:text-lg font-bold font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-center tracking-wider"
            />
          </div>

          <!-- Operator Keypad (+, -, x, C, ⌫) -->
          <div class="grid grid-cols-5 gap-1.5">
            <button
              type="button"
              @click="appendOperator('+')"
              class="py-2.5 rounded-xl text-base font-extrabold bg-teal-50 hover:bg-teal-100 active:scale-95 text-teal-800 border border-teal-200/60 transition-all flex items-center justify-center cursor-pointer shadow-xs"
              title="Tambah (+)"
            >
              +
            </button>
            <button
              type="button"
              @click="appendOperator('-')"
              class="py-2.5 rounded-xl text-base font-extrabold bg-teal-50 hover:bg-teal-100 active:scale-95 text-teal-800 border border-teal-200/60 transition-all flex items-center justify-center cursor-pointer shadow-xs"
              title="Kurang (-)"
            >
              −
            </button>
            <button
              type="button"
              @click="appendOperator('×')"
              class="py-2.5 rounded-xl text-base font-extrabold bg-teal-50 hover:bg-teal-100 active:scale-95 text-teal-800 border border-teal-200/60 transition-all flex items-center justify-center cursor-pointer shadow-xs"
              title="Kali (×)"
            >
              ×
            </button>
            <button
              type="button"
              @click="backspaceQty"
              class="py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 transition-all flex items-center justify-center cursor-pointer"
              title="Hapus 1 karakter"
            >
              <Delete class="w-4 h-4" />
            </button>
            <button
              type="button"
              @click="clearQty"
              class="py-2.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200/60 transition-all flex items-center justify-center cursor-pointer"
              title="Clear semua"
            >
              C
            </button>
          </div>

          <!-- Quick Increment Chips (+1, +5, +12, +24, +48) -->
          <div class="grid grid-cols-5 gap-1.5">
            <button
              v-for="val in [1, 5, 12, 24, 48]"
              :key="val"
              type="button"
              @click="adjustQty(val)"
              class="py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 transition-all"
            >
              +{{ val }}
            </button>
          </div>
        </div>
      </div>

      <!-- Submit Action Button -->
      <button
        type="button"
        @click="handleSave"
        class="w-full py-3.5 px-4 bg-gradient-to-r from-teal-600 via-cyan-600 to-teal-700 hover:from-teal-500 hover:to-cyan-500 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-teal-600/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
      >
        <CheckCircle class="w-4 h-4" />
        <span>Simpan Product In</span>
      </button>
    </div>
  </div>
</template>
