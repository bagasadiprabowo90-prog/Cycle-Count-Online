<script setup lang="ts">
import { ref, computed } from 'vue';
import { useStore } from '../store';
import { Transaction } from '../types';
import { toYMD, toMDY, calculateQty, formatDateShort, isToday } from '../lib/calc';
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
  Hash,
  Boxes,
} from 'lucide-vue-next';

const store = useStore();

const dateInputRef = ref<HTMLInputElement | null>(null);
const currentTab = ref<'CC' | 'IN'>('CC');
const searchQuery = ref('');

const editingId = ref<string | null>(null);
const editBatch = ref('');
const editQtyRaw = ref('');
const pendingDelete = ref<Transaction | null>(null);

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
    return;
  }
  editingId.value = t.id;
  editBatch.value = t.batch || '';
  editQtyRaw.value = String(t.qty);
};

const cancelEdit = () => {
  editingId.value = null;
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

const getBatchOptions = (skuCode: string, currentB: string) => {
  const opts = store.products.filter((p) => p.sku === skuCode).map((p) => p.batch || '');
  const unique = Array.from(new Set(opts));
  if (currentB && !unique.includes(currentB)) unique.unshift(currentB);
  return unique;
};
</script>

<template>
  <div class="space-y-4">
    <!-- Top Date Filter & Refresh Row -->
    <div class="flex items-center justify-between gap-2">
      <div>
        <h2 class="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
          <Clock class="w-4 h-4 text-cyan-600" />
          <span>Riwayat Transaksi</span>
        </h2>
        <p class="text-[11px] text-slate-500 font-medium">Log data tersimpan per tanggal</p>
      </div>

      <div class="flex items-center gap-1.5">
        <div class="relative">
          <button
            type="button"
            @click="openDatePicker"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold border transition-all shadow-sm"
            :class="
              isToday(store.dateHistory)
                ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            "
          >
            <CalendarDays class="w-3.5 h-3.5 text-cyan-600" />
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
          class="px-2.5 py-1.5 rounded-2xl text-[11px] font-bold bg-cyan-600 text-white shadow-sm hover:bg-cyan-700 transition-colors"
        >
          Hari Ini
        </button>

        <button
          type="button"
          @click="store.fetchTransactions(true)"
          :disabled="store.isSyncing"
          class="p-2 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:text-slate-900 shadow-sm transition-all"
          title="Segarkan Riwayat"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': store.isSyncing }" />
        </button>
      </div>
    </div>

    <!-- 2026 Segmented Control (Tabs) -->
    <div class="p-1 bg-slate-200/80 rounded-2xl flex gap-1">
      <button
        type="button"
        @click="currentTab = 'CC'; editingId = null"
        class="flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        :class="
          currentTab === 'CC'
            ? 'bg-white text-emerald-800 shadow-sm'
            : 'text-slate-600 hover:text-slate-900'
        "
      >
        <Layers class="w-3.5 h-3.5" />
        <span>Cycle Count</span>
      </button>

      <button
        type="button"
        @click="currentTab = 'IN'; editingId = null"
        class="flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        :class="
          currentTab === 'IN'
            ? 'bg-white text-teal-800 shadow-sm'
            : 'text-slate-600 hover:text-slate-900'
        "
      >
        <Package class="w-3.5 h-3.5" />
        <span>Product In</span>
      </button>
    </div>

    <!-- Summary KPI Cards -->
    <div class="grid grid-cols-3 gap-2">
      <div class="neo-card p-3 text-center">
        <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Item</div>
        <div class="text-base font-extrabold text-slate-900 mt-0.5 font-mono">{{ stats.count }}</div>
      </div>
      <div class="neo-card p-3 text-center">
        <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Qty</div>
        <div class="text-base font-extrabold text-emerald-600 mt-0.5 font-mono">{{ stats.totalQty }}</div>
      </div>
      <div class="neo-card p-3 text-center">
        <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SKU Unik</div>
        <div class="text-base font-extrabold text-cyan-600 mt-0.5 font-mono">{{ stats.uniqueSkus }}</div>
      </div>
    </div>

    <!-- Search Input -->
    <div class="relative">
      <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Filter nama, SKU, atau batch..."
        class="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all font-medium"
      />
      <button
        v-if="searchQuery"
        type="button"
        @click="searchQuery = ''"
        class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
      >
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- List Items -->
    <div v-if="filteredTransactions.length === 0" class="neo-card p-8 text-center">
      <Boxes class="w-10 h-10 text-slate-300 mx-auto mb-2" />
      <div class="text-sm font-bold text-slate-700">Belum ada transaksi</div>
      <p class="text-xs text-slate-400 mt-0.5">Tidak ada data untuk tanggal atau filter ini.</p>
    </div>

    <div v-else class="space-y-2.5">
      <div
        v-for="t in filteredTransactions"
        :key="t.id"
        class="neo-card p-4 transition-all"
        :class="{
          'ring-2 ring-emerald-500/30 border-emerald-300': editingId === t.id,
          'opacity-90': t.id.startsWith('optimistic_'),
        }"
      >
        <!-- Standard Row View -->
        <div v-if="editingId !== t.id">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <div class="text-xs font-bold text-slate-900 leading-snug line-clamp-1">
                {{ t.product || 'Tanpa Nama Produk' }}
              </div>

              <div class="flex flex-wrap items-center gap-1.5 mt-1.5">
                <span class="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-800">
                  {{ t.sku }}
                </span>
                <span v-if="t.batch" class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/50">
                  B: {{ t.batch }}
                </span>
                <span class="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-50 text-slate-500 flex items-center gap-1">
                  <User class="w-2.5 h-2.5" />
                  {{ t.user }}
                </span>
              </div>
            </div>

            <!-- Qty Badge -->
            <div class="text-right shrink-0">
              <div class="text-base font-extrabold font-mono text-slate-900">
                {{ t.qty }} <span class="text-[11px] font-normal text-slate-500">pcs</span>
              </div>
              <div v-if="t.id.startsWith('optimistic_')" class="text-[9px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded mt-0.5">
                pending sync
              </div>
            </div>
          </div>

          <!-- Bottom Action Buttons -->
          <div class="flex items-center justify-between pt-3 mt-3 border-t border-slate-100">
            <div class="text-[10px] font-mono text-slate-400">
              {{ t.barcode || t.sku }}
            </div>

            <div class="flex items-center gap-1">
              <button
                type="button"
                @click="startEdit(t)"
                class="p-1.5 rounded-xl text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                title="Edit Transaksi"
              >
                <Edit3 class="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                @click="pendingDelete = t"
                class="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title="Hapus Transaksi"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <!-- Inline Edit Mode -->
        <div v-else class="space-y-3">
          <div class="flex items-center justify-between pb-2 border-b border-slate-100">
            <span class="text-xs font-bold text-emerald-800">Edit Transaksi ({{ t.sku }})</span>
            <button type="button" @click="cancelEdit" class="text-slate-400 hover:text-slate-600">
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Batch</label>
              <input
                v-model="editBatch"
                type="text"
                class="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Qty (Rumus OK)</label>
              <input
                v-model="editQtyRaw"
                type="text"
                class="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-1">
            <button
              type="button"
              @click="cancelEdit"
              class="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Batal
            </button>
            <button
              type="button"
              @click="saveEdit(t)"
              class="px-4 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-xl shadow-sm hover:bg-emerald-700 flex items-center gap-1.5"
            >
              <Save class="w-3.5 h-3.5" />
              <span>Simpan Perubahan</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div
      v-if="pendingDelete"
      class="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div class="neo-card max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div class="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto">
          <AlertTriangle class="w-6 h-6" />
        </div>

        <div class="text-center">
          <h3 class="text-sm font-extrabold text-slate-900">Hapus Transaksi?</h3>
          <p class="text-xs text-slate-500 mt-1 leading-relaxed">
            Data SKU <strong class="text-slate-800">{{ pendingDelete.sku }}</strong> ({{ pendingDelete.qty }} pcs) akan dihapus dari sistem dan Google Sheets.
          </p>
        </div>

        <div class="flex gap-2">
          <button
            type="button"
            @click="pendingDelete = null"
            class="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            type="button"
            @click="confirmDelete"
            class="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 shadow-lg shadow-rose-600/20"
          >
            Hapus Sekarang
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

