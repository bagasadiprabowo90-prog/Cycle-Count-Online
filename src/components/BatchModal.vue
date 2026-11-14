<script setup lang="ts">
import { ref } from 'vue';
import { Layers, X, Plus, Check } from 'lucide-vue-next';

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
    @click.self="emit('close')"
    class="fixed inset-0 z-50 flex items-end justify-center bg-[#0B2226]/55 backdrop-blur-sm transition-opacity duration-200"
  >
    <div
      class="bg-white rounded-t-3xl w-full max-w-md overflow-hidden shadow-[0_-10px_32px_-8px_rgba(11,59,64,0.18)] border-t border-slate-900/[0.06] flex flex-col max-h-[85dvh] pb-safe"
    >
      <!-- Drag Handle -->
      <div class="pt-2.5 pb-1 flex justify-center bg-[#F4F9F9]">
        <div class="w-10 h-1 rounded-full bg-[#B8D8D8]"></div>
      </div>

      <!-- Header -->
      <div class="px-5 py-3 border-b border-slate-900/[0.06] flex items-center justify-between bg-[#F4F9F9]">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-xl bg-[#CCFBF1] text-[#0D9488] flex items-center justify-center shrink-0">
            <Layers class="w-4 h-4 stroke-[1.75]" />
          </div>
          <div class="min-w-0">
            <h3 class="text-sm font-bold text-[#132327] tracking-tight">Pilih Nomor Batch</h3>
            <p class="text-xs font-mono font-semibold text-[#0F766E] tabular-nums truncate">{{ sku }}</p>
          </div>
        </div>

        <button
          type="button"
          @click="emit('close')"
          class="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-slate-900/[0.05] text-[#4A656B] hover:text-[#132327] transition-colors duration-[180ms] cursor-pointer"
          title="Tutup"
        >
          <X class="w-5 h-5 stroke-[1.75]" />
        </button>
      </div>

      <!-- Product Description Banner (Full wrapping, mobile friendly) -->
      <div class="px-5 py-3 bg-[#E6F7F6] border-b border-slate-900/[0.06] text-xs text-[#0B3B40] font-medium leading-relaxed break-words">
        {{ productName }}
      </div>

      <!-- Batch Selection Body -->
      <div class="p-5 overflow-y-auto space-y-4">
        <div>
          <div class="flex items-center justify-between mb-2.5">
            <label class="text-xs font-bold text-[#4A656B] uppercase tracking-wider">
              Batch Tersedia
            </label>
            <span class="text-xs text-[#4A656B] font-medium tabular-nums">{{ batches.length }} batch</span>
          </div>

          <!-- Empty state if no master batch -->
          <div v-if="batches.length === 0" class="p-4 rounded-2xl bg-[#F4F9F9] border border-dashed border-[#99E2DC] text-center text-xs text-[#4A656B]">
            Tidak ada batch tersimpan di master. Silakan masukkan batch baru di bawah.
          </div>

          <!-- Chips Grid -->
          <div v-else class="grid grid-cols-2 gap-2">
            <button
              v-for="b in batches"
              :key="b"
              type="button"
              @click="selectBatch(b)"
              class="group relative min-h-[52px] p-3 rounded-xl border text-left transition-all duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] flex items-center justify-between cursor-pointer"
              :class="
                selectedBatch === b
                  ? 'bg-[#CCFBF1] text-[#083B3F] border-[#14B8A6] font-bold shadow-[0_4px_14px_-4px_rgba(20,184,166,0.35)]'
                  : 'bg-[#EEF5F5] hover:bg-[#E0F2F1] border-slate-900/[0.06] text-[#132327]'
              "
            >
              <div class="min-w-0 pr-1.5">
                <div class="text-xs text-[#4A656B] font-medium leading-none mb-1">Batch</div>
                <div class="text-xs font-mono font-bold truncate tabular-nums">{{ b }}</div>
              </div>
              <div
                class="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                :class="selectedBatch === b ? 'bg-[#0D9488] text-white' : 'text-transparent group-hover:text-[#0D9488]'"
              >
                <Check class="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
            </button>
          </div>
        </div>

        <!-- Custom / Manual Batch Section -->
        <div class="pt-3 border-t border-slate-900/[0.06]">
          <div v-if="!isCustom">
            <button
              type="button"
              @click="isCustom = true"
              class="w-full min-h-[44px] py-2.5 px-3 rounded-xl border border-dashed border-[#14B8A6] hover:bg-[#E6F7F6] text-[#0F766E] text-xs font-bold transition-all duration-[180ms] active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus class="w-4 h-4 stroke-[1.75]" />
              <span>Input Batch Baru / Lainnya</span>
            </button>
          </div>

          <div v-else class="space-y-2">
            <label class="block text-xs font-bold text-[#4A656B] uppercase tracking-wider">
              Ketik Batch Baru
            </label>
            <div class="flex gap-2">
              <input
                v-model="manualBatch"
                type="text"
                placeholder="Nomor batch fisik..."
                @keyup.enter="submitManual"
                class="flex-1 min-h-[46px] px-3.5 py-2.5 bg-[#EEF5F5] border border-slate-900/[0.07] rounded-xl text-base font-mono font-bold text-[#132327] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/40 focus:border-[#0D9488] transition-all"
              />
              <button
                type="button"
                @click="submitManual"
                :disabled="!manualBatch.trim()"
                class="min-h-[46px] px-5 bg-[#0D9488] hover:bg-[#0F766E] disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all duration-[180ms] active:scale-[0.98] cursor-pointer"
              >
                Pilih
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Buttons -->
      <div class="px-4 py-3 bg-[#F4F9F9] border-t border-slate-900/[0.06] flex items-center justify-between gap-2">
        <button
          type="button"
          @click="selectBatch('')"
          class="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold text-[#4A656B] hover:text-[#132327] hover:bg-slate-900/[0.05] transition-colors cursor-pointer"
        >
          Lewati (Tanpa Batch)
        </button>

        <button
          type="button"
          @click="emit('close')"
          class="min-h-[44px] px-5 py-2 rounded-xl text-xs font-bold bg-[#E0F2F1] hover:bg-[#CCFBF1] text-[#0B3B40] transition-colors cursor-pointer"
        >
          Tutup
        </button>
      </div>
    </div>
  </div>
</template>
