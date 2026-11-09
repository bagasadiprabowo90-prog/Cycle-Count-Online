<script setup lang="ts">
import { ClipboardList, PackagePlus, History } from 'lucide-vue-next';

defineProps<{
  activeTab: 'CC' | 'IN' | 'HISTORY';
}>();

const emit = defineEmits<{
  (e: 'update:activeTab', tab: 'CC' | 'IN' | 'HISTORY'): void;
}>();

const navs = [
  { id: 'CC', label: 'Cycle Count', icon: ClipboardList },
  { id: 'IN', label: 'Product In', icon: PackagePlus },
  { id: 'HISTORY', label: 'Riwayat', icon: History },
] as const;
</script>

<template>
  <nav class="fixed bottom-0 inset-x-0 z-40 pb-safe pointer-events-none">
    <div class="max-w-md mx-auto px-4 pb-2">
      <div class="pointer-events-auto bg-[#1E352E]/95 backdrop-blur-2xl border border-[#8FC0A9]/30 rounded-3xl p-1.5 shadow-[0_12px_40px_-8px_rgba(23,45,38,0.5)] flex items-center justify-between">
        <button
          v-for="item in navs"
          :key="item.id"
          type="button"
          @click="emit('update:activeTab', item.id)"
          class="relative flex-1 flex flex-col items-center justify-center py-2 px-3 rounded-2xl transition-all duration-300 group cursor-pointer"
          :class="activeTab === item.id ? 'text-white' : 'text-[#8FC0A9]/60 hover:text-[#C8D5B9]'"
        >
          <!-- Active Pill Background Indicator -->
          <div
            v-if="activeTab === item.id"
            class="absolute inset-0 bg-[#8FC0A9]/20 border border-[#8FC0A9]/50 rounded-2xl shadow-inner transition-all duration-300"
          />

          <div
            class="relative z-10 flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-300"
            :class="activeTab === item.id ? 'bg-gradient-to-br from-[#C8D5B9] to-[#8FC0A9] text-[#172D26] shadow-md shadow-[#8FC0A9]/30 scale-105 font-bold' : 'text-[#8FC0A9]/70 group-hover:text-white'"
          >
            <component :is="item.icon" class="w-4 h-4" />
          </div>

          <span
            class="relative z-10 text-[11px] font-semibold mt-1 tracking-tight transition-colors duration-200"
            :class="activeTab === item.id ? 'text-[#C8D5B9] font-bold' : 'text-[#8FC0A9]/70'"
          >
            {{ item.label }}
          </span>
        </button>
      </div>
    </div>
  </nav>
</template>
