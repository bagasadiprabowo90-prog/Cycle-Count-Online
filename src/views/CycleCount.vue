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
        <h2 class="text-base font-extrabold text-[#132327] tracking-tight leading-tight flex items-center gap-1.5">
          <Layers class="w-4 h-4 text-[#0D9488] stroke-[1.75]" />
          <span>Cycle Count</span>
        </h2>
        <p class="text-xs text-[#4A656B] font-medium mt-0.5">Validasi fisik stok opname gudang</p>
      </div>

      <div class="flex items-center gap-1.5">
        <div class="relative">
          <button
            type="button"
            @click="openDatePicker"
            class="min-h-[44px] flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all duration-[180ms] active:scale-[0.98] cursor-pointer tabular-nums"
            :class="
              isToday(store.dateCC)
                ? 'bg-[#CCFBF1]/80 text-[#0B4F54] border-[#5EEAD4]'
                : 'bg-white text-[#0F766E] border-slate-900/[0.08] hover:bg-[#EEF5F5]'
            "
          >
            <CalendarDays class="w-4 h-4 text-[#0D9488] stroke-[1.75]" />
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
          class="min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold bg-[#0D9488] text-white hover:bg-[#0F766E] transition-colors duration-[180ms] active:scale-[0.98] cursor-pointer"
        >
          Hari Ini
        </button>
      </div>
    </div>

    <!-- SECTION 1: SEARCH & SCAN BARCODE -->
    <div class="bg-white rounded-2xl p-4 border border-slate-900/[0.06] shadow-[0_2px_12px_-4px_rgba(11,59,64,0.06)] relative">
      <label class="block text-xs font-bold text-[#4A656B] uppercase tracking-wider mb-2">
        1. Cari atau Scan Produk
      </label>

      <div class="flex gap-2">
        <div class="relative flex-1 min-w-0">
          <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A656B]" />
          <input
            ref="searchRef"
            v-model="search"
            @focus="showDropdown = true"
            type="text"
            placeholder="Ketik SKU, Nama, atau Barcode..."
            class="w-full min-h-[48px] pl-10 pr-11 py-2.5 bg-[#EEF5F5] border border-slate-900/[0.07] rounded-xl text-base text-[#132327] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/40 focus:border-[#0D9488] transition-all font-medium"
          />
          <button
            v-if="search"
            type="button"
            @click="search = ''; showDropdown = false"
            class="absolute right-0.5 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#4A656B] hover:text-[#132327] rounded-xl cursor-pointer"
            title="Bersihkan"
          >
            <X class="w-4 h-4" />
          </button>

          <!-- AUTOCOMPLETE DROPDOWN: Mobile Full-View (No Text Truncation) -->
          <div
            v-if="showDropdown && filteredProducts.length > 0"
            class="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-900/[0.08] rounded-2xl shadow-[0_14px_34px_-8px_rgba(11,59,64,0.16)] z-40 max-h-72 overflow-y-auto divide-y divide-slate-900/[0.06]"
          >
            <button
              v-for="p in filteredProducts"
              :key="p.sku + (p.batch || '')"
              type="button"
              @click="selectProduct(p)"
              class="w-full min-h-[52px] p-3.5 text-left hover:bg-[#F0FAFA] active:bg-[#E0F7F6] transition-colors flex flex-col gap-1.5 cursor-pointer"
            >
              <!-- Full product name, completely visible on mobile without line clamp -->
              <div class="text-sm font-bold text-[#132327] leading-snug break-words">
                {{ p.product }}
              </div>

              <!-- Badges Row: SKU, Batch, Barcode neatly wrapped -->
              <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span class="bg-[#E6F7F6] text-[#0D5C63] px-2 py-0.5 rounded-lg text-xs font-mono font-bold tabular-nums">
                  {{ p.sku }}
                </span>
                <span v-if="p.batch" class="bg-[#CCFBF1] text-[#0F4C52] px-2 py-0.5 rounded-lg text-xs font-mono font-semibold tabular-nums">
                  Batch: {{ p.batch }}
                </span>
                <span v-if="p.barcode" class="bg-[#F4F9F9] text-[#4A656B] px-2 py-0.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1 tabular-nums">
                  <Barcode class="w-3 h-3 text-[#4A656B]" />
                  {{ p.barcode }}
                </span>
              </div>
            </button>
          </div>
        </div>

        <button
          type="button"
          @click="isScannerOpen = true"
          class="min-w-[48px] min-h-[48px] px-4 bg-[#06B6D4] hover:bg-[#0891B2] text-white font-bold rounded-xl shadow-[0_2px_10px_-3px_rgba(6,182,212,0.45)] active:scale-[0.98] transition-all duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] flex items-center justify-center cursor-pointer shrink-0"
          title="Scan Barcode Kamera"
        >
          <Camera class="w-5 h-5 stroke-[1.75]" />
        </button>
      </div>
    </div>

    <!-- SECTION 2: SELECTED PRODUCT & BATCH BADGE -->
    <div v-if="sku" class="bg-white rounded-2xl p-4 border border-[#14B8A6]/60 shadow-[0_2px_12px_-4px_rgba(13,148,136,0.12)] space-y-3.5">
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-start gap-3 min-w-0">
          <div class="w-10 h-10 rounded-xl bg-[#CCFBF1] text-[#0D9488] flex items-center justify-center shrink-0">
            <Package class="w-4 h-4 stroke-[1.75]" />
          </div>
          <div class="min-w-0">
            <div class="text-xs font-semibold text-[#4A656B]">Produk Terpilih</div>
            <!-- Full Product Name: Mobile Friendly, Zero Truncation -->
            <div class="text-sm font-bold text-[#132327] leading-snug break-words mt-0.5">
              {{ productName }}
            </div>
            <div class="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span class="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-[#E6F7F6] text-[#0D5C63] tabular-nums">
                {{ sku }}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          @click="sku = ''; productName = ''; batch = '';"
          class="min-w-[44px] min-h-[44px] -mr-1.5 -mt-1.5 flex items-center justify-center text-[#4A656B] hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
          title="Ganti Produk"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Batch Selector Sub-Card -->
      <div class="pt-3 border-t border-slate-900/[0.06]">
        <div class="flex items-center justify-between mb-2">
          <label class="text-xs font-bold text-[#4A656B] uppercase tracking-wider flex items-center gap-1.5">
            <Layers class="w-3.5 h-3.5 text-[#0D9488]" />
            <span>Nomor Batch</span>
          </label>
          <button
            type="button"
            @click="isBatchModalOpen = true"
            class="min-h-[36px] text-xs font-bold text-[#0F766E] hover:bg-[#CCFBF1] flex items-center gap-1 cursor-pointer bg-[#E6F7F6] px-3 py-1.5 rounded-lg transition-colors"
          >
            <span>Pilih Pop-up</span>
          </button>
        </div>

        <!-- Horizontal Batch Chips -->
        <div v-if="availableBatches.length > 0" class="flex flex-wrap gap-1.5 mb-2.5">
          <button
            v-for="b in availableBatches"
            :key="b"
            type="button"
            @click="batch = b"
            class="min-h-[44px] px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all duration-[180ms] active:scale-[0.98] cursor-pointer border tabular-nums"
            :class="
              batch === b
                ? 'bg-[#0D9488] text-white border-[#0D9488]'
                : 'bg-[#EEF5F5] text-[#0F5257] border-slate-900/[0.06] hover:bg-[#DDF2F0]'
            "
          >
            {{ b }}
          </button>
        </div>

        <input
          v-model="batch"
          type="text"
          placeholder="Ketik batch manual atau pilih di atas..."
          class="w-full min-h-[46px] px-3.5 py-2.5 bg-[#EEF5F5] border border-slate-900/[0.07] rounded-xl text-base font-mono font-bold text-[#132327] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/40 focus:border-[#0D9488] transition-all"
        />
      </div>
    </div>

    <!-- SECTION 3: QUANTITY & MATH CALCULATOR -->
    <div class="bg-white rounded-2xl p-4 border border-slate-900/[0.06] shadow-[0_2px_12px_-4px_rgba(11,59,64,0.06)] space-y-3">
      <div class="flex items-center justify-between gap-2">
        <label class="block text-xs font-bold text-[#4A656B] uppercase tracking-wider">
          2. Jumlah Qty Fisik
        </label>

        <!-- Live Result Evaluator Badge -->
        <div
          v-if="hasFormula && calculatedQty !== null"
          class="text-xs font-bold px-2.5 py-1 rounded-lg bg-[#CCFBF1] text-[#0B4F54] flex items-center gap-1 tabular-nums"
        >
          <Calculator class="w-3.5 h-3.5 text-[#0D9488]" />
          <span>= {{ calculatedQty }} pcs</span>
        </div>
        <span v-else class="text-xs text-[#4A656B] font-medium">Bisa rumus matematika</span>
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
            class="w-full min-h-[52px] px-4 py-3 bg-[#EEF5F5] border border-slate-900/[0.07] rounded-xl text-xl font-mono font-extrabold text-[#132327] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/40 focus:border-[#0D9488] transition-all text-center tracking-wider tabular-nums"
          />
        </div>

        <!-- Operator Keypad (+, -, x, ⌫, C) -->
        <div class="grid grid-cols-5 gap-2">
          <button
            type="button"
            @click="appendOperator('+')"
            class="min-h-[48px] rounded-xl text-lg font-bold bg-[#E6F5F4] hover:bg-[#D4EEEC] active:scale-[0.97] text-[#0F2A2E] border border-slate-900/[0.06] transition-all duration-[150ms] flex items-center justify-center cursor-pointer tabular-nums"
            title="Tambah (+)"
          >
            +
          </button>
          <button
            type="button"
            @click="appendOperator('-')"
            class="min-h-[48px] rounded-xl text-lg font-bold bg-[#E6F5F4] hover:bg-[#D4EEEC] active:scale-[0.97] text-[#0F2A2E] border border-slate-900/[0.06] transition-all duration-[150ms] flex items-center justify-center cursor-pointer tabular-nums"
            title="Kurang (-)"
          >
            −
          </button>
          <button
            type="button"
            @click="appendOperator('×')"
            class="min-h-[48px] rounded-xl text-lg font-bold bg-[#E6F5F4] hover:bg-[#D4EEEC] active:scale-[0.97] text-[#0F2A2E] border border-slate-900/[0.06] transition-all duration-[150ms] flex items-center justify-center cursor-pointer tabular-nums"
            title="Kali (×)"
          >
            ×
          </button>
          <button
            type="button"
            @click="backspaceQty"
            class="min-h-[48px] rounded-xl text-sm font-bold bg-[#EEF5F5] hover:bg-[#DCEAEA] active:scale-[0.97] text-[#0F766E] border border-slate-900/[0.06] transition-all duration-[150ms] flex items-center justify-center cursor-pointer"
            title="Hapus 1 karakter"
          >
            <Delete class="w-4 h-4 stroke-[1.75]" />
          </button>
          <button
            type="button"
            @click="clearQty"
            class="min-h-[48px] rounded-xl text-sm font-bold bg-rose-50 hover:bg-rose-100 active:scale-[0.97] text-rose-700 border border-rose-500/15 transition-all duration-[150ms] flex items-center justify-center cursor-pointer"
            title="Clear semua"
          >
            C
          </button>
        </div>
      </div>
    </div>

    <!-- SECTION 4: SAVE ACTION BUTTON -->
    <div ref="saveButtonRef" class="pt-1 pb-6">
      <button
        type="button"
        @click="handleSave"
        :disabled="isSaving"
        class="w-full min-h-[52px] py-3.5 px-4 bg-[#0D9488] hover:bg-[#0F766E] text-white font-bold text-base rounded-2xl shadow-[0_6px_18px_-4px_rgba(13,148,136,0.45)] active:scale-[0.98] transition-all duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 touch-manipulation"
      >
        <CheckCircle class="w-5 h-5 stroke-[2] text-white" />
        <span>{{ isSaving ? 'Tersimpan...' : 'Simpan Cycle Count' }}</span>
      </button>
    </div>
  </div>
</template>
