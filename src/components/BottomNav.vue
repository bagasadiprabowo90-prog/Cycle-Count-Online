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
  <!-- DOCKED SOLID BOTTOM BAR (Tidak Mengambang, Menempel di Dasar Layar) -->
  <nav class="fixed bottom-0 left-0 right-0 z-40 bg-[#1E352E] border-t border-[#8FC0A9]/30 shadow-[0_-4px_20px_rgba(15,31,26,0.25)] pb-safe">
    <div class="max-w-md mx-auto flex items-stretch justify-around px-2 py-1">
      <button
        v-for="item in navs"
        :key="item.id"
        type="button"
        @click="emit('update:activeTab', item.id)"
        class="relative flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all duration-200 cursor-pointer"
        :class="activeTab === item.id ? 'text-[#C8D5B9]' : 'text-[#8FC0A9]/60 hover:text-[#C8D5B9]'"
      >
        <!-- Top Active Indicator Line -->
        <div
          v-if="activeTab === item.id"
          class="absolute -top-1 w-8 h-1 bg-gradient-to-r from-[#C8D5B9] to-[#8FC0A9] rounded-full shadow-[0_0_8px_#8FC0A9]"
        />

        <div
          class="flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200"
          :class="activeTab === item.id ? 'bg-[#8FC0A9]/20 text-[#C8D5B9] scale-105' : 'text-[#8FC0A9]/60'"
        >
          <component :is="item.icon" class="w-4 h-4" />
        </div>

        <span
          class="text-[11px] font-bold mt-0.5 tracking-tight transition-colors"
          :class="activeTab === item.id ? 'text-white' : 'text-[#8FC0A9]/70'"
        >
          {{ item.label }}
        </span>
      </button>
    </div>
  </nav>
</template>
