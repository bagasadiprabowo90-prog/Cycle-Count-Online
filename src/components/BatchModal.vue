<script setup lang="ts">
import { ref } from 'vue';
import { Layers, X, Plus, Check, Tag } from 'lucide-vue-next';

const props = defineProps<{
  isOpen: boolean;
  sku: string;
  productName: string;
  batches: string[];
  selectedBatch: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'select', batch: string): void;
}>();

const manualBatch = ref('');
const isCustom = ref(false);

const selectBatch = (b: string) => {
  emit('select', b);
};

const submitManual = () => {
  const val = manualBatch.value.trim();
  if (val) {
    emit('select', val);
  }
};
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200"
  >
    <div
      class="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]"
    >
      <!-- Header -->
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <Layers class="w-4 h-4" />
          </div>
          <div>
            <h3 class="text-sm font-extrabold text-slate-900 tracking-tight">Pilih Nomor Batch</h3>
            <p class="text-[11px] font-mono font-semibold text-emerald-700">{{ sku }}</p>
          </div>
        </div>

        <button
          type="button"
          @click="emit('close')"
          class="p-1.5 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Product Description Banner -->
      <div class="px-5 py-3 bg-emerald-50/60 border-b border-emerald-100/60 text-xs text-slate-700 font-medium leading-snug line-clamp-2">
        {{ productName }}
      </div>

      <!-- Batch Selection Body -->
      <div class="p-5 overflow-y-auto space-y-4">
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Batch Master Tersedia (Tinggal Pilih)
            </label>
            <span class="text-[10px] text-slate-400 font-medium">{{ batches.length }} batch</span>
          </div>

          <!-- Empty state if no master batch -->
          <div v-if="batches.length === 0" class="p-4 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-500">
            Tidak ada batch tersimpan di master. Silakan masukkan batch baru di bawah.
          </div>

          <!-- Chips Grid -->
          <div v-else class="grid grid-cols-2 gap-2">
            <button
              v-for="b in batches"
              :key="b"
              type="button"
              @click="selectBatch(b)"
              class="group relative p-3 rounded-2xl border text-left transition-all duration-150 flex items-center justify-between cursor-pointer"
              :class="
                selectedBatch === b
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/30'
                  : 'bg-slate-50 hover:bg-emerald-50/70 border-slate-200 text-slate-800 hover:border-emerald-300'
              "
            >
              <div class="min-w-0 pr-1">
                <div class="text-[10px] opacity-70 uppercase tracking-wider font-semibold">Batch</div>
                <div class="text-xs font-mono font-extrabold truncate">{{ b }}</div>
              </div>
              <div
                class="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                :class="selectedBatch === b ? 'bg-white/20 text-white' : 'text-transparent group-hover:text-emerald-600'"
              >
                <Check class="w-3.5 h-3.5" />
              </div>
            </button>
          </div>
        </div>

        <!-- Custom / Manual Batch Section -->
        <div class="pt-2 border-t border-slate-100">
          <div v-if="!isCustom">
            <button
              type="button"
              @click="isCustom = true"
              class="w-full py-2.5 px-3 rounded-xl border border-dashed border-slate-300 hover:border-emerald-500 text-slate-600 hover:text-emerald-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>Input Batch Baru / Lainnya</span>
            </button>
          </div>

          <div v-else class="space-y-2">
            <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Ketik Batch Baru
            </label>
            <div class="flex gap-2">
              <input
                v-model="manualBatch"
                type="text"
                placeholder="Nomor batch fisik..."
                @keyup.enter="submitManual"
                class="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                @click="submitManual"
                :disabled="!manualBatch.trim()"
                class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                Pilih
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Buttons -->
      <div class="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
        <button
          type="button"
          @click="selectBatch('')"
          class="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
        >
          Lewati (Tanpa Batch)
        </button>

        <button
          type="button"
          @click="emit('close')"
          class="px-4 py-1.5 rounded-xl text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors"
        >
          Tutup
        </button>
      </div>
    </div>
  </div>
</template>

