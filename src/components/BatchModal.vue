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
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#172D26]/75 backdrop-blur-md animate-in fade-in duration-200"
  >
    <div
      class="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-[#8FC0A9]/40 animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]"
    >
      <!-- Header -->
      <div class="px-5 py-4 border-b border-[#C8D5B9]/40 flex items-center justify-between bg-[#F4F7F4]">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-[#8FC0A9]/30 text-[#1E352E] flex items-center justify-center font-bold">
            <Layers class="w-4 h-4" />
          </div>
          <div>
            <h3 class="text-sm font-extrabold text-[#172D26] tracking-tight">Pilih Nomor Batch</h3>
            <p class="text-[11px] font-mono font-semibold text-[#3B6657]">{{ sku }}</p>
          </div>
        </div>

        <button
          type="button"
          @click="emit('close')"
          class="p-1.5 rounded-xl hover:bg-[#C8D5B9]/40 text-[#4F685F] hover:text-[#172D26] transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Product Description Banner (Full wrapping, mobile friendly) -->
      <div class="px-5 py-3 bg-[#C8D5B9]/20 border-b border-[#C8D5B9]/40 text-xs text-[#1E352E] font-medium leading-relaxed break-words">
        {{ productName }}
      </div>

      <!-- Batch Selection Body -->
      <div class="p-5 overflow-y-auto space-y-4">
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-[11px] font-bold text-[#4F685F] uppercase tracking-wider">
              Batch Tersedia (Tinggal Pilih)
            </label>
            <span class="text-[10px] text-[#7A958B] font-medium">{{ batches.length }} batch</span>
          </div>

          <!-- Empty state if no master batch -->
          <div v-if="batches.length === 0" class="p-4 rounded-2xl bg-[#F4F7F4] border border-dashed border-[#C8D5B9] text-center text-xs text-[#4F685F]">
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
                  ? 'bg-[#8FC0A9] text-[#172D26] border-[#8FC0A9] font-bold shadow-md shadow-[#8FC0A9]/30'
                  : 'bg-[#F4F7F4] hover:bg-[#C8D5B9]/40 border-[#C8D5B9]/70 text-[#172D26] hover:border-[#8FC0A9]'
              "
            >
              <div class="min-w-0 pr-1">
                <div class="text-[10px] opacity-70 uppercase tracking-wider font-semibold">Batch</div>
                <div class="text-xs font-mono font-extrabold truncate">{{ b }}</div>
              </div>
              <div
                class="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                :class="selectedBatch === b ? 'bg-[#172D26] text-white' : 'text-transparent group-hover:text-[#2D5347]'"
              >
                <Check class="w-3.5 h-3.5 stroke-[3]" />
              </div>
            </button>
          </div>
        </div>

        <!-- Custom / Manual Batch Section -->
        <div class="pt-2 border-t border-[#C8D5B9]/40">
          <div v-if="!isCustom">
            <button
              type="button"
              @click="isCustom = true"
              class="w-full py-2.5 px-3 rounded-xl border border-dashed border-[#8FC0A9] hover:bg-[#C8D5B9]/20 text-[#2D5347] text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>Input Batch Baru / Lainnya</span>
            </button>
          </div>

          <div v-else class="space-y-2">
            <label class="block text-[11px] font-bold text-[#4F685F] uppercase tracking-wider">
              Ketik Batch Baru
            </label>
            <div class="flex gap-2">
              <input
                v-model="manualBatch"
                type="text"
                placeholder="Nomor batch fisik..."
                @keyup.enter="submitManual"
                class="flex-1 px-3.5 py-2.5 bg-[#FAFBF9] border border-[#C8D5B9] rounded-xl text-xs font-mono font-bold text-[#172D26] focus:bg-white focus:outline-none focus:border-[#8FC0A9]"
              />
              <button
                type="button"
                @click="submitManual"
                :disabled="!manualBatch.trim()"
                class="px-4 py-2.5 bg-[#8FC0A9] hover:bg-[#7EB39B] disabled:opacity-50 text-[#172D26] rounded-xl text-xs font-extrabold transition-all shadow-sm"
              >
                Pilih
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Buttons -->
      <div class="p-3 bg-[#F4F7F4] border-t border-[#C8D5B9]/40 flex items-center justify-between">
        <button
          type="button"
          @click="selectBatch('')"
          class="px-3 py-1.5 rounded-xl text-xs font-semibold text-[#4F685F] hover:text-[#172D26] hover:bg-[#C8D5B9]/30 transition-colors"
        >
          Lewati (Tanpa Batch)
        </button>

        <button
          type="button"
          @click="emit('close')"
          class="px-4 py-1.5 rounded-xl text-xs font-bold bg-[#C8D5B9]/60 hover:bg-[#C8D5B9] text-[#1E352E] transition-colors"
        >
          Tutup
        </button>
      </div>
    </div>
  </div>
</template>
