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
  <!-- Bottom Nav: tinggi tetap 48px (sama dengan Header), menempel di dasar layar -->
  <nav class="fixed bottom-0 left-0 right-0 z-40 bg-[#1E352E] border-t border-[#8FC0A9]/25" style="padding-bottom: env(safe-area-inset-bottom)">
    <div class="max-w-md mx-auto h-12 flex items-stretch justify-around px-2">
      <button
        v-for="item in navs"
        :key="item.id"
        type="button"
        @click="emit('update:activeTab', item.id)"
        class="relative flex-1 flex flex-col items-center justify-center gap-0.5 rounded-lg transition-colors cursor-pointer"
        :class="activeTab === item.id ? 'text-white' : 'text-[#8FC0A9]/70 hover:text-[#C8D5B9]'"
      >
        <!-- Active indicator -->
        <div
          v-if="activeTab === item.id"
          class="absolute top-0 w-8 h-0.5 bg-gradient-to-r from-[#C8D5B9] to-[#8FC0A9] rounded-full"
        />
        <component :is="item.icon" class="w-4 h-4" :class="activeTab === item.id ? 'text-[#C8D5B9]' : ''" />
        <span class="text-[10px] font-bold leading-none tracking-tight">{{ item.label }}</span>
      </button>
    </div>
  </nav>
</template>
