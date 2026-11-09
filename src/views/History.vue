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
  Boxes,
  Barcode,
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
</script>

<template>
  <div class="space-y-3 pb-4">
    <!-- Top Date Filter & Refresh Row -->
    <div class="flex items-center justify-between gap-2 px-0.5">
      <div>
        <h2 class="text-sm font-extrabold text-[#172D26] tracking-tight flex items-center gap-1.5">
          <Clock class="w-4 h-4 text-[#3D6E5C]" />
          <span>Riwayat Transaksi</span>
        </h2>
        <p class="text-[11px] text-[#5C796E] font-medium">Log data tersimpan per tanggal</p>
      </div>

      <div class="flex items-center gap-1.5">
        <div class="relative">
          <button
            type="button"
            @click="openDatePicker"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-xs cursor-pointer"
            :class="
              isToday(store.dateHistory)
                ? 'bg-[#C8D5B9]/40 text-[#1E352E] border-[#8FC0A9]/60'
                : 'bg-white text-[#2D5347] border-[#C8D5B9] hover:bg-[#F4F7F4]'
            "
          >
            <CalendarDays class="w-3.5 h-3.5 text-[#3D6E5C]" />
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
          class="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-[#8FC0A9] text-[#172D26] shadow-xs hover:bg-[#7EB39B] transition-colors"
        >
          Hari Ini
        </button>

        <button
          type="button"
          @click="store.fetchTransactions(true)"
          :disabled="store.isSyncing"
          class="p-2 bg-white border border-[#C8D5B9] rounded-xl text-[#3D6E5C] hover:text-[#172D26] shadow-xs transition-all"
          title="Segarkan Riwayat"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': store.isSyncing }" />
        </button>
      </div>
    </div>

    <!-- Segmented Tab Switcher (#C8D5B9 / #8FC0A9 Theme) -->
    <div class="p-1 bg-[#C8D5B9]/30 border border-[#C8D5B9]/60 rounded-2xl flex gap-1">
      <button
        type="button"
        @click="currentTab = 'CC'; editingId = null"
        class="flex-1 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        :class="
          currentTab === 'CC'
            ? 'bg-white text-[#172D26] shadow-sm'
            : 'text-[#4F685F] hover:text-[#172D26]'
        "
      >
        <Layers class="w-3.5 h-3.5" />
        <span>Cycle Count</span>
      </button>

      <button
        type="button"
        @click="currentTab = 'IN'; editingId = null"
        class="flex-1 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        :class="
          currentTab === 'IN'
            ? 'bg-white text-[#172D26] shadow-sm'
            : 'text-[#4F685F] hover:text-[#172D26]'
        "
      >
        <Package class="w-3.5 h-3.5" />
        <span>Product In</span>
      </button>
    </div>

    <!-- KPI Summary Cards (Mobile Responsive, No Text Cut-Off) -->
    <div class="grid grid-cols-3 gap-2">
      <div class="bg-white rounded-2xl p-2.5 sm:p-3 border border-[#8FC0A9]/40 shadow-xs text-center">
        <div class="text-[10px] font-bold text-[#5C796E] uppercase tracking-wider">Item</div>
        <div class="text-sm sm:text-base font-extrabold text-[#172D26] mt-0.5 font-mono">{{ stats.count }}</div>
      </div>
      <div class="bg-white rounded-2xl p-2.5 sm:p-3 border border-[#8FC0A9]/40 shadow-xs text-center">
        <div class="text-[10px] font-bold text-[#5C796E] uppercase tracking-wider">Total Qty</div>
        <div class="text-sm sm:text-base font-extrabold text-[#235342] mt-0.5 font-mono">{{ stats.totalQty }}</div>
      </div>
      <div class="bg-white rounded-2xl p-2.5 sm:p-3 border border-[#8FC0A9]/40 shadow-xs text-center">
        <div class="text-[10px] font-bold text-[#5C796E] uppercase tracking-wider">SKU Unik</div>
        <div class="text-sm sm:text-base font-extrabold text-[#3B6657] mt-0.5 font-mono">{{ stats.uniqueSkus }}</div>
      </div>
    </div>

    <!-- Search / Filter Input -->
    <div class="relative">
      <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A958B]" />
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Filter nama produk, SKU, atau batch..."
        class="w-full pl-9 pr-8 py-2.5 bg-white border border-[#C8D5B9] rounded-xl text-xs text-[#172D26] focus:outline-none focus:ring-2 focus:ring-[#8FC0A9]/40 focus:border-[#8FC0A9] transition-all font-medium"
      />
      <button
        v-if="searchQuery"
        type="button"
        @click="searchQuery = ''"
        class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7A958B] hover:text-[#172D26] p-1"
      >
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- Empty State -->
    <div v-if="filteredTransactions.length === 0" class="bg-white rounded-2xl p-8 border border-[#C8D5B9] text-center shadow-xs">
      <Boxes class="w-10 h-10 text-[#8FC0A9]/60 mx-auto mb-2" />
      <div class="text-sm font-bold text-[#172D26]">Belum ada data transaksi</div>
      <p class="text-xs text-[#5C796E] mt-0.5">Tidak ada data untuk tanggal atau filter yang dipilih.</p>
    </div>

    <!-- List Items (Mobile First, Fully Expanded Text, Zero Truncation) -->
    <div v-else class="space-y-2.5">
      <div
        v-for="t in filteredTransactions"
        :key="t.id"
        class="bg-white rounded-2xl p-3.5 sm:p-4 border border-[#8FC0A9]/40 shadow-xs transition-all space-y-2.5"
        :class="{
          'ring-2 ring-[#8FC0A9] border-[#8FC0A9]': editingId === t.id,
          'opacity-90': t.id.startsWith('optimistic_'),
        }"
      >
        <!-- Standard Row View -->
        <div v-if="editingId !== t.id" class="space-y-2.5">
          <!-- Top Row: Full Product Title + Qty Pill -->
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <!-- Full product name, wraps cleanly on mobile without line truncation -->
              <div class="text-xs font-extrabold text-[#172D26] leading-relaxed break-words">
                {{ t.product || 'Tanpa Nama Produk' }}
              </div>
            </div>

            <!-- Prominent Qty Badge -->
            <div class="shrink-0 bg-[#8FC0A9]/20 border border-[#8FC0A9]/60 px-2.5 py-1 rounded-xl text-right">
              <div class="text-sm sm:text-base font-extrabold font-mono text-[#172D26] leading-none">
                {{ t.qty }} <span class="text-[10px] font-normal text-[#4F685F]">pcs</span>
              </div>
              <div v-if="t.id.startsWith('optimistic_')" class="text-[9px] font-semibold text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded mt-1 text-center">
                pending
              </div>
            </div>
          </div>

          <!-- Middle Row: Metadata Badges (SKU, Batch, Operator) -->
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="px-2 py-0.5 rounded-md text-[10px] font-mono font-extrabold bg-[#C8D5B9]/40 text-[#172D26] border border-[#C8D5B9]">
              {{ t.sku }}
            </span>
            <span v-if="t.batch" class="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#8FC0A9]/30 text-[#1E352E] border border-[#8FC0A9]/40">
              Batch: {{ t.batch }}
            </span>
            <span class="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#FAFBF9] text-[#5C796E] border border-slate-200 flex items-center gap-1">
              <User class="w-2.5 h-2.5 text-[#7A958B]" />
              {{ t.user }}
            </span>
          </div>

          <!-- Bottom Row: Barcode & Action Buttons -->
          <div class="flex items-center justify-between pt-2 border-t border-[#C8D5B9]/30">
            <div class="text-[10px] font-mono text-[#7A958B] truncate max-w-[55%] flex items-center gap-1">
              <Barcode class="w-3 h-3 shrink-0" />
              <span class="truncate">{{ t.barcode || t.sku }}</span>
            </div>

            <div class="flex items-center gap-1 shrink-0">
              <button
                type="button"
                @click="startEdit(t)"
                class="px-2.5 py-1.5 rounded-xl text-xs font-bold text-[#2D5347] bg-[#C8D5B9]/30 hover:bg-[#C8D5B9]/60 transition-colors flex items-center gap-1 cursor-pointer"
                title="Edit Transaksi"
              >
                <Edit3 class="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                @click="pendingDelete = t"
                class="p-1.5 rounded-xl text-[#7A958B] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                title="Hapus Transaksi"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <!-- Inline Edit Mode -->
        <div v-else class="space-y-3">
          <div class="flex items-center justify-between pb-2 border-b border-[#C8D5B9]/40">
            <span class="text-xs font-extrabold text-[#172D26]">Edit Transaksi ({{ t.sku }})</span>
            <button type="button" @click="cancelEdit" class="text-[#7A958B] hover:text-[#172D26]">
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-[10px] font-bold text-[#4F685F] uppercase mb-1">Batch</label>
              <input
                v-model="editBatch"
                type="text"
                class="w-full px-3 py-1.5 bg-[#FAFBF9] border border-[#C8D5B9] rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-[#8FC0A9]"
              />
            </div>
            <div>
              <label class="block text-[10px] font-bold text-[#4F685F] uppercase mb-1">Qty (Rumus OK)</label>
              <input
                v-model="editQtyRaw"
                type="text"
                class="w-full px-3 py-1.5 bg-[#FAFBF9] border border-[#C8D5B9] rounded-xl text-xs font-mono font-extrabold focus:outline-none focus:border-[#8FC0A9]"
              />
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-1">
            <button
              type="button"
              @click="cancelEdit"
              class="px-3 py-1.5 text-xs font-semibold text-[#4F685F] hover:bg-[#C8D5B9]/30 rounded-xl"
            >
              Batal
            </button>
            <button
              type="button"
              @click="saveEdit(t)"
              class="px-4 py-1.5 text-xs font-extrabold bg-[#8FC0A9] hover:bg-[#7EB39B] text-[#13251F] rounded-xl shadow-xs flex items-center gap-1.5"
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
      class="fixed inset-0 z-50 bg-[#172D26]/75 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div class="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 border border-[#8FC0A9]/40 shadow-2xl">
        <div class="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto">
          <AlertTriangle class="w-6 h-6" />
        </div>

        <div class="text-center">
          <h3 class="text-sm font-extrabold text-[#172D26]">Hapus Transaksi?</h3>
          <p class="text-xs text-[#5C796E] mt-1 leading-relaxed">
            Data SKU <strong class="text-[#172D26]">{{ pendingDelete.sku }}</strong> ({{ pendingDelete.qty }} pcs) akan dihapus dari sistem dan Google Sheets.
          </p>
        </div>

        <div class="flex gap-2">
          <button
            type="button"
            @click="pendingDelete = null"
            class="flex-1 py-2.5 rounded-xl border border-[#C8D5B9] text-xs font-bold text-[#4F685F] hover:bg-[#FAFBF9]"
          >
            Batal
          </button>
          <button
            type="button"
            @click="confirmDelete"
            class="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 shadow-md shadow-rose-600/20"
          >
            Hapus Sekarang
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
