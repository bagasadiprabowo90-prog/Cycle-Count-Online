<script setup lang="ts">
import { ref, computed } from 'vue';
import { useStore } from '../store';
import { Transaction } from '../types';
import { toYMD, toMDY, calculateQty, formatDateShort, isToday } from '../lib/calc';
import BatchModal from '../components/BatchModal.vue';
import {
  CalendarDays,
  Search,
  Trash2,
  Edit3,
  Save,
  X,
  Package,
  Layers,
  Clock,
  User,
  AlertTriangle,
  RefreshCw,
  Boxes,
  Barcode,
  Calculator,
} from 'lucide-vue-next';

const store = useStore();

const dateInputRef = ref<HTMLInputElement | null>(null);
const currentTab = ref<'CC' | 'IN'>('CC');
const searchQuery = ref('');

const editingId = ref<string | null>(null);
const editBatch = ref('');
const editQtyRaw = ref('');
const isBatchModalOpen = ref(false);
const pendingDelete = ref<Transaction | null>(null);

const editingTransaction = computed(
  () => store.transactions.find((item) => item.id === editingId.value) || null
);

const getAvailableBatches = (targetSku: string) => {
  if (!targetSku) return [];
  const list = store.products
    .filter((p) => p.sku === targetSku && p.batch)
    .map((p) => p.batch);
  return Array.from(new Set(list));
};

const handleBatchSelected = (selectedB: string) => {
  editBatch.value = selectedB;
  isBatchModalOpen.value = false;
};

const editCalculatedQty = computed(() => calculateQty(editQtyRaw.value));
const editHasFormula = computed(() => /[+\-*×/]/.test(editQtyRaw.value));

const filteredTransactions = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return store.transactions.filter((t) => {
    if (t.type !== currentTab.value) return false;
    if (!q) return true;
    return (
      String(t.product || '').toLowerCase().includes(q) ||
      String(t.sku || '').toLowerCase().includes(q) ||
      String(t.batch || '').toLowerCase().includes(q)
    );
  });
});

const stats = computed(() => {
  const currentItems = store.transactions.filter((t) => t.type === currentTab.value);
  const totalQty = currentItems.reduce((acc, t) => acc + (Number(t.qty) || 0), 0);
  const uniqueSkus = new Set(currentItems.map((t) => t.sku)).size;
  return {
    count: currentItems.length,
    totalQty,
    uniqueSkus,
  };
});

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
  if (val) store.setDateHistory(toMDY(val));
};

const startEdit = (t: Transaction) => {
  if (editingId.value === t.id) {
    editingId.value = null;
    isBatchModalOpen.value = false;
    return;
  }
  editingId.value = t.id;
  editBatch.value = t.batch || '';
  editQtyRaw.value = String(t.qty);
  isBatchModalOpen.value = false;
};

const cancelEdit = () => {
  editingId.value = null;
  isBatchModalOpen.value = false;
};

const saveEdit = async (t: Transaction) => {
  const finalQty = calculateQty(editQtyRaw.value);
  if (finalQty <= 0) {
    store.notify('error', 'Jumlah Qty harus valid.');
    return;
  }

  const finalBatch = editBatch.value.trim();
  const matched = store.products.find((p) => p.sku === t.sku && p.batch === finalBatch);

  editingId.value = null;
  isBatchModalOpen.value = false;

  try {
    const res = await store.updateTransaction(t.id, t.type, {
      ...t,
      barcode: matched?.barcode || t.barcode,
      product: matched?.product || t.product,
      batch: finalBatch,
      qty: finalQty,
    });

    if (res.success) {
      store.notify('success', 'Transaksi berhasil diperbarui.');
    } else {
      store.notify('error', `Gagal update: ${res.message}`);
    }
  } catch {
    store.notify('error', 'Terjadi kesalahan saat menyimpan perubahan.');
  }
};

const confirmDelete = async () => {
  if (!pendingDelete.value) return;
  const target = pendingDelete.value;
  pendingDelete.value = null;

  try {
    const res = await store.deleteTransaction(target.id, target.type);
    if (res.success) {
      store.notify('success', 'Transaksi berhasil dihapus.');
    } else {
      store.notify('error', `Gagal hapus: ${res.message}`);
    }
  } catch {
    store.notify('error', 'Terjadi kesalahan saat menghapus.');
  }
};
</script>

<template>
  <div class="space-y-3.5 pb-10">
    <!-- Batch Modal Bottom Sheet for Inline Edit -->
    <BatchModal
      :isOpen="isBatchModalOpen && Boolean(editingTransaction)"
      :sku="editingTransaction?.sku || ''"
      :productName="editingTransaction?.product || ''"
      :batches="editingTransaction ? getAvailableBatches(editingTransaction.sku) : []"
      :selectedBatch="editBatch"
      @close="isBatchModalOpen = false"
      @select="handleBatchSelected"
    />

    <!-- Top Date Filter & Refresh Row -->
    <div class="flex items-center justify-between gap-2 px-0.5">
      <div>
        <h2 class="text-base font-extrabold text-[#132327] tracking-tight leading-tight flex items-center gap-1.5">
          <Clock class="w-4 h-4 text-[#0D9488] stroke-[1.75]" />
          <span>Riwayat Transaksi</span>
        </h2>
        <p class="text-xs text-[#4A656B] font-medium mt-0.5">Log data tersimpan per tanggal</p>
      </div>

      <div class="flex items-center gap-1.5">
        <div class="relative">
          <button
            type="button"
            @click="openDatePicker"
            class="min-h-[44px] flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all duration-[180ms] active:scale-[0.98] cursor-pointer tabular-nums"
            :class="
              isToday(store.dateHistory)
                ? 'bg-[#CCFBF1]/80 text-[#0B4F54] border-[#5EEAD4]'
                : 'bg-white text-[#0F766E] border-slate-900/[0.08] hover:bg-[#EEF5F5]'
            "
          >
            <CalendarDays class="w-4 h-4 text-[#0D9488] stroke-[1.75]" />
            <span>{{ formatDateShort(store.dateHistory) }}</span>
          </button>
          <input
            ref="dateInputRef"
            type="date"
            class="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
            :value="toYMD(store.dateHistory)"
            @change="onDateChange"
          />
        </div>

        <button
          v-if="!isToday(store.dateHistory)"
          type="button"
          @click="store.resetDateHistory()"
          class="min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold bg-[#0D9488] text-white hover:bg-[#0F766E] transition-colors duration-[180ms] active:scale-[0.98] cursor-pointer"
        >
          Hari Ini
        </button>

        <button
          type="button"
          @click="store.fetchTransactions(true)"
          :disabled="store.isSyncing"
          class="min-w-[44px] min-h-[44px] flex items-center justify-center bg-white border border-slate-900/[0.08] rounded-xl text-[#0F766E] hover:bg-[#EEF5F5] transition-colors duration-[180ms] active:scale-[0.98] cursor-pointer disabled:opacity-60"
          title="Segarkan Riwayat"
        >
          <RefreshCw class="w-4 h-4 stroke-[1.75]" :class="{ 'animate-spin': store.isSyncing }" />
        </button>
      </div>
    </div>

    <!-- Segmented Tab Switcher -->
    <div class="p-1 bg-[#E4EFEF] border border-slate-900/[0.05] rounded-2xl flex gap-1">
      <button
        type="button"
        @click="currentTab = 'CC'; editingId = null; isBatchModalOpen = false"
        class="flex-1 min-h-[44px] py-2 rounded-xl text-xs font-bold transition-all duration-[180ms] flex items-center justify-center gap-1.5 cursor-pointer"
        :class="
          currentTab === 'CC'
            ? 'bg-white text-[#0B3B40] shadow-[0_2px_8px_-2px_rgba(11,59,64,0.1)]'
            : 'text-[#4A656B] hover:text-[#132327]'
        "
      >
        <Layers class="w-3.5 h-3.5 stroke-[1.75]" :class="currentTab === 'CC' ? 'text-[#0D9488]' : ''" />
        <span>Cycle Count</span>
      </button>

      <button
        type="button"
        @click="currentTab = 'IN'; editingId = null; isBatchModalOpen = false"
        class="flex-1 min-h-[44px] py-2 rounded-xl text-xs font-bold transition-all duration-[180ms] flex items-center justify-center gap-1.5 cursor-pointer"
        :class="
          currentTab === 'IN'
            ? 'bg-white text-[#0B3B40] shadow-[0_2px_8px_-2px_rgba(11,59,64,0.1)]'
            : 'text-[#4A656B] hover:text-[#132327]'
        "
      >
        <Package class="w-3.5 h-3.5 stroke-[1.75]" :class="currentTab === 'IN' ? 'text-[#0D9488]' : ''" />
        <span>Product In</span>
      </button>
    </div>

    <!-- KPI Summary Cards -->
    <div class="grid grid-cols-3 gap-2">
      <div class="bg-white rounded-2xl p-3 border border-slate-900/[0.06] shadow-[0_2px_10px_-4px_rgba(11,59,64,0.06)] text-center">
        <div class="text-xs font-semibold text-[#4A656B]">Item</div>
        <div class="text-base font-extrabold text-[#132327] mt-0.5 font-mono tabular-nums">{{ stats.count }}</div>
      </div>
      <div class="bg-white rounded-2xl p-3 border border-slate-900/[0.06] shadow-[0_2px_10px_-4px_rgba(11,59,64,0.06)] text-center">
        <div class="text-xs font-semibold text-[#4A656B]">Total Qty</div>
        <div class="text-base font-extrabold text-[#0D9488] mt-0.5 font-mono tabular-nums">{{ stats.totalQty }}</div>
      </div>
      <div class="bg-white rounded-2xl p-3 border border-slate-900/[0.06] shadow-[0_2px_10px_-4px_rgba(11,59,64,0.06)] text-center">
        <div class="text-xs font-semibold text-[#4A656B]">SKU Unik</div>
        <div class="text-base font-extrabold text-[#0891B2] mt-0.5 font-mono tabular-nums">{{ stats.uniqueSkus }}</div>
      </div>
    </div>

    <!-- Search / Filter Input -->
    <div class="relative">
      <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A656B]" />
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Filter nama produk, SKU, atau batch..."
        class="w-full min-h-[48px] pl-10 pr-11 py-2.5 bg-white border border-slate-900/[0.07] rounded-xl text-base text-[#132327] shadow-[0_2px_8px_-4px_rgba(11,59,64,0.05)] focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/40 focus:border-[#0D9488] transition-all font-medium"
      />
      <button
        v-if="searchQuery"
        type="button"
        @click="searchQuery = ''"
        class="absolute right-0.5 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#4A656B] hover:text-[#132327] rounded-xl cursor-pointer"
        title="Bersihkan"
      >
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- Loading Skeleton State -->
    <div v-if="store.isSyncing && filteredTransactions.length === 0" class="space-y-2.5">
      <div
        v-for="n in 3"
        :key="n"
        class="bg-white rounded-2xl p-4 border border-slate-900/[0.06] space-y-3 animate-pulse"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex-1 space-y-2">
            <div class="h-4 bg-[#E4EFEF] rounded-lg w-3/4"></div>
            <div class="h-3 bg-[#EEF5F5] rounded-lg w-1/2"></div>
          </div>
          <div class="h-8 w-16 bg-[#E4EFEF] rounded-xl shrink-0"></div>
        </div>
        <div class="flex gap-2">
          <div class="h-6 w-20 bg-[#EEF5F5] rounded-lg"></div>
          <div class="h-6 w-24 bg-[#EEF5F5] rounded-lg"></div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredTransactions.length === 0" class="bg-white rounded-2xl p-8 border border-slate-900/[0.06] shadow-[0_2px_12px_-4px_rgba(11,59,64,0.05)] text-center space-y-3">
      <div class="w-12 h-12 rounded-2xl bg-[#E6F7F6] text-[#0D9488] flex items-center justify-center mx-auto">
        <Boxes class="w-6 h-6 stroke-[1.75]" />
      </div>
      <div>
        <div class="text-sm font-bold text-[#132327]">Belum ada data transaksi</div>
        <p class="text-xs text-[#4A656B] mt-1 leading-relaxed">
          Tidak ada data untuk tanggal atau kata kunci filter yang dipilih.
        </p>
      </div>
      <div class="pt-1">
        <button
          type="button"
          @click="searchQuery ? (searchQuery = '') : store.fetchTransactions(true)"
          class="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold transition-all duration-[180ms] active:scale-[0.98] cursor-pointer inline-flex items-center gap-1.5"
        >
          <RefreshCw class="w-3.5 h-3.5 stroke-[2]" />
          <span>{{ searchQuery ? 'Reset Filter Pencarian' : 'Muat Ulang Data' }}</span>
        </button>
      </div>
    </div>

    <!-- List Items (Mobile First, Fully Expanded Text, Zero Truncation) -->
    <div v-else class="space-y-2.5">
      <div
        v-for="t in filteredTransactions"
        :key="t.id"
        class="bg-white rounded-2xl p-4 border shadow-[0_2px_12px_-4px_rgba(11,59,64,0.06)] transition-all space-y-3"
        :class="{
          'border-[#14B8A6] ring-2 ring-[#2DD4BF]/30': editingId === t.id,
          'border-slate-900/[0.06]': editingId !== t.id,
          'opacity-90': t.id.startsWith('optimistic_'),
        }"
      >
        <!-- Standard Row View -->
        <div v-if="editingId !== t.id" class="space-y-2.5">
          <!-- Top Row: Full Product Title + Qty Pill -->
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <!-- Full product name, wraps cleanly on mobile without line truncation -->
              <div class="text-sm font-bold text-[#132327] leading-snug break-words">
                {{ t.product || 'Tanpa Nama Produk' }}
              </div>
            </div>

            <!-- Prominent Qty Badge -->
            <div class="shrink-0 bg-[#E6F7F6] px-3 py-1.5 rounded-xl text-right">
              <div class="text-base font-extrabold font-mono text-[#0B4F54] leading-none tabular-nums">
                {{ t.qty }} <span class="text-xs font-medium text-[#4A656B]">pcs</span>
              </div>
              <div v-if="t.id.startsWith('optimistic_')" class="text-xs font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-md mt-1 text-center">
                pending
              </div>
            </div>
          </div>

          <!-- Middle Row: Metadata Badges (SKU, Batch, Operator) -->
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-[#E6F7F6] text-[#0D5C63] tabular-nums">
              {{ t.sku }}
            </span>
            <span v-if="t.batch" class="px-2.5 py-0.5 rounded-lg text-xs font-mono font-semibold bg-[#CCFBF1] text-[#0F4C52] tabular-nums">
              Batch: {{ t.batch }}
            </span>
            <span class="px-2.5 py-0.5 rounded-lg text-xs font-medium bg-[#F4F9F9] text-[#4A656B] flex items-center gap-1">
              <User class="w-3 h-3 text-[#4A656B]" />
              {{ t.user }}
            </span>
          </div>

          <!-- Bottom Row: Barcode & Action Buttons -->
          <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-900/[0.06]">
            <div class="text-xs font-mono text-[#4A656B] truncate min-w-0 flex items-center gap-1.5 tabular-nums">
              <Barcode class="w-3.5 h-3.5 shrink-0" />
              <span class="truncate">{{ t.barcode || t.sku }}</span>
            </div>

            <div class="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                @click="startEdit(t)"
                class="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold text-[#0F5257] bg-[#E6F7F6] hover:bg-[#CCFBF1] transition-colors duration-[180ms] active:scale-[0.98] flex items-center gap-1.5 cursor-pointer"
                title="Edit Transaksi"
              >
                <Edit3 class="w-3.5 h-3.5 stroke-[1.75]" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                @click="pendingDelete = t"
                class="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[#4A656B] hover:text-rose-600 hover:bg-rose-50 transition-colors duration-[180ms] active:scale-[0.98] cursor-pointer"
                title="Hapus Transaksi"
              >
                <Trash2 class="w-4 h-4 stroke-[1.75]" />
              </button>
            </div>
          </div>
        </div>

        <!-- Inline Edit Mode with Batch Chip Selector -->
        <div v-else class="space-y-3.5">
          <div class="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-900/[0.06]">
            <div class="min-w-0">
              <span class="text-xs font-bold text-[#0D9488] uppercase tracking-wider">Edit Transaksi</span>
              <div class="text-sm font-bold text-[#132327] leading-snug break-words mt-0.5">
                {{ t.product || t.sku }}
              </div>
              <span class="inline-block mt-1 px-2 py-0.5 rounded-lg text-xs font-mono font-bold bg-[#E6F7F6] text-[#0D5C63] tabular-nums">
                {{ t.sku }}
              </span>
            </div>
            <button
              type="button"
              @click="cancelEdit"
              class="min-w-[44px] min-h-[44px] -mr-2 -mt-1 flex items-center justify-center rounded-xl text-[#4A656B] hover:text-[#132327] hover:bg-[#EEF5F5] cursor-pointer shrink-0"
              title="Batal"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Batch Chip Selector Sub-Section -->
          <div>
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
            <div v-if="getAvailableBatches(t.sku).length > 0 || editBatch" class="flex flex-wrap gap-1.5 mb-2.5">
              <button
                v-for="b in getAvailableBatches(t.sku)"
                :key="b"
                type="button"
                @click="editBatch = b"
                class="min-h-[44px] px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all duration-[180ms] active:scale-[0.98] cursor-pointer border tabular-nums"
                :class="
                  editBatch === b
                    ? 'bg-[#0D9488] text-white border-[#0D9488]'
                    : 'bg-[#EEF5F5] text-[#0F5257] border-slate-900/[0.06] hover:bg-[#DDF2F0]'
                "
              >
                {{ b }}
              </button>
              <button
                type="button"
                @click="editBatch = ''"
                class="min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold transition-all duration-[180ms] active:scale-[0.98] cursor-pointer border"
                :class="
                  editBatch.trim() === ''
                    ? 'bg-[#0B3B40] text-[#CCFBF1] border-[#0B3B40]'
                    : 'bg-[#F4F9F9] text-[#4A656B] border-slate-900/[0.06] hover:bg-[#E6F5F4]'
                "
              >
                Tanpa Batch
              </button>
            </div>

            <input
              v-model="editBatch"
              type="text"
              placeholder="Ketik batch manual atau pilih chip di atas..."
              class="w-full min-h-[46px] px-3.5 py-2.5 bg-[#EEF5F5] border border-slate-900/[0.07] rounded-xl text-base font-mono font-bold text-[#132327] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/40 focus:border-[#0D9488] transition-all"
            />
          </div>

          <!-- Qty Input with Live Formula Preview -->
          <div>
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <label class="block text-xs font-bold text-[#4A656B] uppercase tracking-wider">Qty (Rumus OK)</label>
              <div
                v-if="editHasFormula && editCalculatedQty > 0"
                class="text-xs font-bold px-2 py-0.5 rounded-lg bg-[#CCFBF1] text-[#0B4F54] flex items-center gap-1 tabular-nums"
              >
                <Calculator class="w-3 h-3 text-[#0D9488]" />
                <span>= {{ editCalculatedQty }} pcs</span>
              </div>
            </div>
            <input
              v-model="editQtyRaw"
              type="text"
              inputmode="decimal"
              @keyup.enter="saveEdit(t)"
              class="w-full min-h-[48px] px-3.5 py-2.5 bg-[#EEF5F5] border border-slate-900/[0.07] rounded-xl text-base font-mono font-extrabold text-[#132327] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/40 focus:border-[#0D9488] tabular-nums transition-all"
            />
          </div>

          <div class="flex justify-end gap-2 pt-1">
            <button
              type="button"
              @click="cancelEdit"
              class="min-h-[44px] px-4 py-2 text-xs font-semibold text-[#4A656B] hover:bg-[#EEF5F5] rounded-xl cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              @click="saveEdit(t)"
              class="min-h-[44px] px-4 py-2 text-xs font-bold bg-[#0D9488] hover:bg-[#0F766E] text-white rounded-xl flex items-center gap-1.5 transition-all duration-[180ms] active:scale-[0.98] cursor-pointer shadow-[0_4px_12px_-3px_rgba(13,148,136,0.4)]"
            >
              <Save class="w-4 h-4 stroke-[1.75]" />
              <span>Simpan Perubahan</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Bottom Sheet -->
    <div
      v-if="pendingDelete"
      @click.self="pendingDelete = null"
      class="fixed inset-0 z-50 bg-[#0B3B40]/55 backdrop-blur-sm flex items-end justify-center"
    >
      <div class="bg-white rounded-t-3xl max-w-md w-full p-6 pt-3 pb-safe space-y-4 border-t border-slate-900/[0.06] shadow-[0_-10px_32px_-8px_rgba(11,59,64,0.2)]">
        <div class="flex justify-center pb-1">
          <div class="w-10 h-1 rounded-full bg-slate-300"></div>
        </div>

        <div class="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-500/20 flex items-center justify-center text-rose-600 mx-auto">
          <AlertTriangle class="w-6 h-6 stroke-[1.75]" />
        </div>

        <div class="text-center">
          <h3 class="text-base font-bold text-[#132327]">Hapus Transaksi?</h3>
          <p class="text-xs text-[#4A656B] mt-1 leading-relaxed tabular-nums">
            Data SKU <strong class="text-[#132327]">{{ pendingDelete.sku }}</strong> ({{ pendingDelete.qty }} pcs) akan dihapus dari sistem dan Google Sheets.
          </p>
        </div>

        <div class="flex gap-2.5 pt-1 pb-2">
          <button
            type="button"
            @click="pendingDelete = null"
            class="flex-1 min-h-[48px] py-2.5 rounded-xl bg-[#EEF5F5] hover:bg-[#DCEAEA] text-sm font-bold text-[#132327] transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            @click="confirmDelete"
            class="flex-1 min-h-[48px] py-2.5 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 transition-colors duration-[180ms] active:scale-[0.98] cursor-pointer"
          >
            Hapus Sekarang
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
