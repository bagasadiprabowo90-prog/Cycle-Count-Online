<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import { useStore } from '../store';
import { Product } from '../types';
import { calculateQty, toYMD, toMDY, formatDateShort, isToday } from '../lib/calc';
import {
  Camera,
  CalendarDays,
  Search,
  X,
  CheckCircle,
  Package,
  Layers,
  Delete,
  Calculator,
  Barcode,
} from 'lucide-vue-next';
import ScannerModal from '../components/ScannerModal.vue';
import BatchModal from '../components/BatchModal.vue';

const store = useStore();

const searchRef = ref<HTMLInputElement | null>(null);
const qtyInputRef = ref<HTMLInputElement | null>(null);
const dateInputRef = ref<HTMLInputElement | null>(null);
const saveButtonRef = ref<HTMLElement | null>(null);
const isSaving = ref(false);

let scrollTimer: ReturnType<typeof setTimeout> | null = null;
let saveCooldownTimer: ReturnType<typeof setTimeout> | null = null;

const scrollToSaveButton = () => {
  if (scrollTimer) clearTimeout(scrollTimer);
  nextTick(() => {
    scrollTimer = setTimeout(() => {
      const el = saveButtonRef.value;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
      if (!isVisible) {
        el.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
      scrollTimer = null;
    }, 120);
  });
};

onBeforeUnmount(() => {
  if (scrollTimer) clearTimeout(scrollTimer);
  if (saveCooldownTimer) clearTimeout(saveCooldownTimer);
});

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

// Auto-scroll to save button when Qty is modified
watch(qtyRaw, (val) => {
  if (val && val.trim().length > 0) {
    scrollToSaveButton();
  }
});

// Auto-open batch modal when product is selected
const selectProduct = (p: Product, skipBatchModal = false) => {
  if (saveCooldownTimer) {
    clearTimeout(saveCooldownTimer);
    saveCooldownTimer = null;
  }
  isSaving.value = false;

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
    scrollToSaveButton();
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
    store.notify('info', 'Barcode baru. Silakan pilih atau lengkapi data.');
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
  if (val) store.setDateCC(toMDY(val));
};

// Math Operation Buttons (+, -, x)
const appendOperator = (op: '+' | '-' | '×') => {
  const current = qtyRaw.value.trim();
  const symbol = op === '×' ? '*' : op;

  if (!current) {
    if (op === '-') qtyRaw.value = '-';
    return;
  }

  if (/[+\-*x×]$/.test(current)) {
    qtyRaw.value = current.slice(0, -1) + symbol;
  } else {
    qtyRaw.value = current + symbol;
  }
  qtyInputRef.value?.focus();
  scrollToSaveButton();
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
  scrollToSaveButton();
};

const adjustQty = (amount: number) => {
  const current = calculateQty(qtyRaw.value);
  const next = Math.max(0, current + amount);
  qtyRaw.value = next > 0 ? String(next) : '';
  qtyInputRef.value?.focus();
  scrollToSaveButton();
};

const handleSave = () => {
  if (isSaving.value) return;

  const finalQty = calculateQty(qtyRaw.value);
  if (!sku.value) {
    store.notify('error', 'Silakan cari & pilih produk terlebih dahulu.');
    searchRef.value?.focus();
    return;
  }
  if (finalQty <= 0) {
    store.notify('error', 'Masukkan jumlah Qty yang valid (> 0).');
    qtyInputRef.value?.focus();
    return;
  }

  isSaving.value = true;

  const finalBatch = batch.value.trim();
  const realBarcode =
    store.products.find((p) => p.sku === sku.value && p.batch === finalBatch)?.barcode ||
    `NEW-${sku.value}-${finalBatch || 'NOBATCH'}`;

  const payload = {
    type: 'CC' as const,
    date: store.dateCC,
    barcode: realBarcode,
    sku: sku.value,
    product: productName.value,
    batch: finalBatch,
    qty: finalQty,
    user: store.user || 'Operator',
  };

  // Instant reset form for next item so button & form respond immediately
  sku.value = '';
  productName.value = '';
  batch.value = '';
  qtyRaw.value = '';
  search.value = '';
  showDropdown.value = false;

  store.notify('success', `Cycle Count tersimpan: ${payload.sku} (${finalQty} pcs)`);

  nextTick(() => {
    searchRef.value?.focus();
  });

  // Cooldown prevents accidental double-tap from triggering a duplicate save or empty-form error
  if (saveCooldownTimer) clearTimeout(saveCooldownTimer);
  saveCooldownTimer = setTimeout(() => {
    isSaving.value = false;
    saveCooldownTimer = null;
  }, 400);

  // Sync to backend in background without blocking the form
  store
    .addTransaction(payload)
    .then((res) => {
      if (!res.success) {
        store.notify('error', `Gagal sync ${payload.sku}: ${res.message}`);
      }
    })
    .catch(() => {
      store.notify('error', `Gagal menyimpan transaksi ${payload.sku}.`);
    });
};
</script>

<template>
  <div class="space-y-3.5 pb-20">
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
    <div class="flex items-center justify-between gap-2 px-0.5">
      <div>
        <h2 class="text-sm font-extrabold text-[#172D26] tracking-tight flex items-center gap-1.5">
          <Layers class="w-4 h-4 text-[#447764]" />
          <span>Cycle Count</span>
        </h2>
        <p class="text-[11px] text-[#5C796E] font-medium">Validasi fisik stok opname gudang</p>
      </div>

      <div class="flex items-center gap-1.5">
        <div class="relative">
          <button
            type="button"
            @click="openDatePicker"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-xs cursor-pointer"
            :class="
              isToday(store.dateCC)
                ? 'bg-[#C8D5B9]/40 text-[#1E352E] border-[#8FC0A9]/60'
                : 'bg-white text-[#2D5347] border-[#C8D5B9] hover:bg-[#F4F7F4]'
            "
          >
            <CalendarDays class="w-3.5 h-3.5 text-[#3D6E5C]" />
            <span>{{ formatDateShort(store.dateCC) }}</span>
          </button>
          <input
            ref="dateInputRef"
            type="date"
            class="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
            :value="toYMD(store.dateCC)"
            @change="onDateChange"
          />
        </div>

        <button
          v-if="!isToday(store.dateCC)"
          type="button"
          @click="store.resetDateCC()"
          class="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-[#8FC0A9] text-[#172D26] shadow-xs hover:bg-[#7EB39B] transition-colors"
        >
          Hari Ini
        </button>
      </div>
    </div>

    <!-- SECTION 1: SEARCH & SCAN BARCODE (Separated, Not Merged) -->
    <div class="bg-white rounded-2xl p-4 border border-[#8FC0A9]/40 shadow-xs relative">
      <label class="block text-[11px] font-bold text-[#4F685F] uppercase tracking-wider mb-2">
        1. Cari atau Scan Produk
      </label>

      <div class="flex gap-2">
        <div class="relative flex-1">
          <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A958B]" />
          <input
            ref="searchRef"
            v-model="search"
            @focus="showDropdown = true"
            type="text"
            placeholder="Ketik SKU, Nama, atau Barcode..."
            class="w-full pl-9 pr-8 py-2.5 bg-[#FAFBF9] border border-[#C8D5B9] rounded-xl text-xs sm:text-sm text-[#172D26] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#8FC0A9]/40 focus:border-[#8FC0A9] transition-all font-medium"
          />
          <button
            v-if="search"
            type="button"
            @click="search = ''; showDropdown = false"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7A958B] hover:text-[#172D26] p-1"
          >
            <X class="w-4 h-4" />
          </button>

          <!-- AUTOCOMPLETE DROPDOWN: Mobile Full-View (No Text Truncation) -->
          <div
            v-if="showDropdown && filteredProducts.length > 0"
            class="absolute left-0 right-0 top-full mt-1.5 bg-white border-2 border-[#8FC0A9] rounded-2xl shadow-2xl z-40 max-h-72 overflow-y-auto divide-y divide-[#C8D5B9]/40"
          >
            <button
              v-for="p in filteredProducts"
              :key="p.sku + (p.batch || '')"
              type="button"
              @click="selectProduct(p)"
              class="w-full p-3.5 text-left hover:bg-[#C8D5B9]/20 active:bg-[#C8D5B9]/40 transition-colors flex flex-col gap-1.5 cursor-pointer"
            >
              <!-- Full product name, completely visible on mobile without line clamp -->
              <div class="text-xs font-extrabold text-[#172D26] leading-relaxed break-words">
                {{ p.product }}
              </div>

              <!-- Badges Row: SKU, Batch, Barcode neatly wrapped -->
              <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span class="bg-[#C8D5B9]/50 text-[#172D26] px-2 py-0.5 rounded-md text-[10px] font-mono font-extrabold border border-[#C8D5B9]">
                  {{ p.sku }}
                </span>
                <span v-if="p.batch" class="bg-[#8FC0A9]/30 text-[#1E352E] px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border border-[#8FC0A9]/50">
                  Batch: {{ p.batch }}
                </span>
                <span v-if="p.barcode" class="bg-[#FAFBF9] text-[#5C796E] px-2 py-0.5 rounded-md text-[10px] font-mono font-medium border border-slate-200 flex items-center gap-1">
                  <Barcode class="w-3 h-3 text-[#7A958B]" />
                  {{ p.barcode }}
                </span>
              </div>
            </button>
          </div>
        </div>

        <button
          type="button"
          @click="isScannerOpen = true"
          class="px-4 py-2.5 bg-gradient-to-r from-[#8FC0A9] to-[#68A68C] hover:from-[#7EB39B] hover:to-[#5B987F] text-[#13251F] font-extrabold rounded-xl shadow-md shadow-[#8FC0A9]/25 active:scale-95 transition-all flex items-center justify-center cursor-pointer shrink-0"
          title="Scan Barcode Kamera"
        >
          <Camera class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!-- SECTION 2: SELECTED PRODUCT & BATCH BADGE (Distinct Card) -->
    <div v-if="sku" class="bg-white rounded-2xl p-4 border-2 border-[#8FC0A9] shadow-xs space-y-3">
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-start gap-2.5 min-w-0">
          <div class="p-2 rounded-xl bg-[#8FC0A9] text-[#13251F] shrink-0 mt-0.5 shadow-xs font-bold">
            <Package class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] uppercase font-bold text-[#4F685F] tracking-wider">Produk Terpilih</div>
            <!-- Full Product Name: Mobile Friendly, Zero Truncation -->
            <div class="text-xs font-extrabold text-[#172D26] leading-snug break-words mt-0.5">
              {{ productName }}
            </div>
            <div class="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span class="px-2 py-0.5 rounded-md text-[10px] font-mono font-extrabold bg-[#C8D5B9]/40 text-[#172D26] border border-[#C8D5B9]">
                {{ sku }}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          @click="sku = ''; productName = ''; batch = '';"
          class="text-[#7A958B] hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors shrink-0"
          title="Ganti Produk"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Batch Selector Sub-Card -->
      <div class="pt-3 border-t border-[#C8D5B9]/40">
        <div class="flex items-center justify-between mb-2">
          <label class="text-[11px] font-bold text-[#4F685F] uppercase tracking-wider flex items-center gap-1">
            <Layers class="w-3.5 h-3.5 text-[#3D6E5C]" />
            <span>Nomor Batch</span>
          </label>
          <button
            type="button"
            @click="isBatchModalOpen = true"
            class="text-[11px] font-extrabold text-[#235342] hover:underline flex items-center gap-1 cursor-pointer bg-[#C8D5B9]/30 px-2 py-1 rounded-lg"
          >
            <span>Pilih Pop-up</span>
          </button>
        </div>

        <!-- Horizontal Batch Chips -->
        <div v-if="availableBatches.length > 0" class="flex flex-wrap gap-1.5 mb-2">
          <button
            v-for="b in availableBatches"
            :key="b"
            type="button"
            @click="batch = b"
            class="px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer border"
            :class="
              batch === b
                ? 'bg-[#8FC0A9] text-[#13251F] border-[#8FC0A9] shadow-xs'
                : 'bg-[#FAFBF9] text-[#3D6E5C] border-[#C8D5B9] hover:bg-[#C8D5B9]/30'
            "
          >
            {{ b }}
          </button>
        </div>

        <input
          v-model="batch"
          type="text"
          placeholder="Ketik batch manual atau pilih di atas..."
          class="w-full px-3.5 py-2.5 bg-[#FAFBF9] border border-[#C8D5B9] rounded-xl text-xs font-mono font-bold text-[#172D26] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#8FC0A9]/40 focus:border-[#8FC0A9] transition-all"
        />
      </div>
    </div>

    <!-- SECTION 3: QUANTITY & MATH CALCULATOR (Distinct Card) -->
    <div class="bg-white rounded-2xl p-4 border border-[#8FC0A9]/40 shadow-xs space-y-3">
      <div class="flex items-center justify-between">
        <label class="block text-[11px] font-bold text-[#4F685F] uppercase tracking-wider">
          2. Jumlah Qty Fisik
        </label>

        <!-- Live Result Evaluator Badge -->
        <div
          v-if="hasFormula && calculatedQty !== null"
          class="text-[11px] font-extrabold px-2.5 py-0.5 rounded-lg bg-[#8FC0A9]/30 text-[#172D26] border border-[#8FC0A9] flex items-center gap-1 animate-in fade-in"
        >
          <Calculator class="w-3.5 h-3.5 text-[#2D5347]" />
          <span>= {{ calculatedQty }} pcs</span>
        </div>
        <span v-else class="text-[10px] text-[#7A958B] font-medium">Bisa rumus matematika</span>
      </div>

      <div class="space-y-2.5">
        <div class="relative">
          <input
            ref="qtyInputRef"
            v-model="qtyRaw"
            type="text"
            inputmode="decimal"
            placeholder="0 (cth: 12*5)"
            @focus="scrollToSaveButton"
            @keyup.enter="handleSave"
            class="w-full px-4 py-3 bg-[#FAFBF9] border border-[#C8D5B9] rounded-xl text-lg font-mono font-extrabold text-[#172D26] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#8FC0A9]/40 focus:border-[#8FC0A9] transition-all text-center tracking-wider"
          />
        </div>

        <!-- Operator Keypad (+, -, x, ⌫, C) -->
        <div class="grid grid-cols-5 gap-1.5">
          <button
            type="button"
            @click="appendOperator('+')"
            class="py-2.5 rounded-xl text-base font-extrabold bg-[#C8D5B9]/40 hover:bg-[#C8D5B9]/70 active:scale-95 text-[#172D26] border border-[#C8D5B9] transition-all flex items-center justify-center cursor-pointer shadow-xs"
            title="Tambah (+)"
          >
            +
          </button>
          <button
            type="button"
            @click="appendOperator('-')"
            class="py-2.5 rounded-xl text-base font-extrabold bg-[#C8D5B9]/40 hover:bg-[#C8D5B9]/70 active:scale-95 text-[#172D26] border border-[#C8D5B9] transition-all flex items-center justify-center cursor-pointer shadow-xs"
            title="Kurang (-)"
          >
            −
          </button>
          <button
            type="button"
            @click="appendOperator('×')"
            class="py-2.5 rounded-xl text-base font-extrabold bg-[#C8D5B9]/40 hover:bg-[#C8D5B9]/70 active:scale-95 text-[#172D26] border border-[#C8D5B9] transition-all flex items-center justify-center cursor-pointer shadow-xs"
            title="Kali (×)"
          >
            ×
          </button>
          <button
            type="button"
            @click="backspaceQty"
            class="py-2.5 rounded-xl text-xs font-bold bg-[#FAFBF9] hover:bg-slate-200 active:scale-95 text-[#3D6E5C] border border-[#C8D5B9]/70 transition-all flex items-center justify-center cursor-pointer shadow-xs"
            title="Hapus 1 karakter"
          >
            <Delete class="w-4 h-4" />
          </button>
          <button
            type="button"
            @click="clearQty"
            class="py-2.5 rounded-xl text-xs font-extrabold bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200 transition-all flex items-center justify-center cursor-pointer shadow-xs"
            title="Clear semua"
          >
            C
          </button>
        </div>

        <!-- Quick Increment Chips (+1, +5, +10, +24, +50) -->
        <div class="grid grid-cols-5 gap-1.5">
          <button
            v-for="val in [1, 5, 10, 24, 50]"
            :key="val"
            type="button"
            @click="adjustQty(val)"
            class="py-1.5 rounded-lg text-xs font-bold bg-[#FAFBF9] hover:bg-[#C8D5B9]/30 active:scale-95 text-[#2D5347] border border-[#C8D5B9]/60 transition-all"
          >
            +{{ val }}
          </button>
        </div>
      </div>
    </div>

    <!-- SECTION 4: SAVE ACTION BUTTON (Prominent, Tactile, Well Clear of Bottom Bar) -->
    <div ref="saveButtonRef" class="pt-2 pb-8">
      <button
        type="button"
        @click="handleSave"
        :disabled="isSaving"
        class="w-full py-4 px-4 bg-gradient-to-r from-[#8FC0A9] to-[#68A68C] hover:from-[#7EB39B] hover:to-[#5B987F] text-[#13251F] font-extrabold text-sm sm:text-base rounded-2xl shadow-xl shadow-[#8FC0A9]/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer border border-[#8FC0A9] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 touch-manipulation"
      >
        <CheckCircle class="w-5 h-5 font-bold text-[#13251F]" />
        <span>{{ isSaving ? 'Tersimpan...' : 'Simpan Cycle Count' }}</span>
      </button>
    </div>
  </div>
</template>
