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
  <!-- DOCKED ULTRA-COMPACT SLIM BOTTOM BAR (Ramping & Tidak Mengambang) -->
  <nav class="fixed bottom-0 left-0 right-0 z-40 bg-[#1E352E] border-t border-[#8FC0A9]/30 shadow-[0_-2px_14px_rgba(15,31,26,0.25)] pb-safe">
    <div class="max-w-md mx-auto flex items-stretch justify-around px-2 py-0.5">
      <button
        v-for="item in navs"
        :key="item.id"
        type="button"
        @click="emit('update:activeTab', item.id)"
        class="relative flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-lg transition-all duration-150 cursor-pointer"
        :class="activeTab === item.id ? 'text-[#C8D5B9]' : 'text-[#8FC0A9]/60 hover:text-[#C8D5B9]'"
      >
        <!-- Top Active Indicator Line -->
        <div
          v-if="activeTab === item.id"
          class="absolute -top-0.5 w-6 h-0.5 bg-gradient-to-r from-[#C8D5B9] to-[#8FC0A9] rounded-full shadow-[0_0_6px_#8FC0A9]"
        />

        <div
          class="flex items-center justify-center w-5 h-5 rounded transition-all"
          :class="activeTab === item.id ? 'text-[#C8D5B9] scale-110' : 'text-[#8FC0A9]/60'"
        >
          <component :is="item.icon" class="w-3.5 h-3.5" />
        </div>

        <span
          class="text-[10px] font-bold mt-0.5 tracking-tight transition-colors leading-none"
          :class="activeTab === item.id ? 'text-white' : 'text-[#8FC0A9]/70'"
        >
          {{ item.label }}
        </span>
      </button>
    </div>
  </nav>
</template>
