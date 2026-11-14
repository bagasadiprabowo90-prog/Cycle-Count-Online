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
  <!-- Bottom Nav: thumb-zone mobile navigation with safe-area -->
  <nav class="fixed bottom-0 left-0 right-0 z-40 bg-[#0B3B40] border-t border-white/10" style="padding-bottom: env(safe-area-inset-bottom)">
    <div class="max-w-md mx-auto h-12 flex items-stretch justify-around px-2">
      <button
        v-for="item in navs"
        :key="item.id"
        type="button"
        @click="emit('update:activeTab', item.id)"
        class="relative flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer active:scale-[0.98]"
        :class="activeTab === item.id ? 'text-white' : 'text-[#99F6E4]/75 hover:text-[#CCFBF1]'"
      >
        <!-- Active indicator -->
        <div
          v-if="activeTab === item.id"
          class="absolute top-0 w-8 h-0.5 bg-[#2DD4BF] rounded-full"
        />
        <component :is="item.icon" class="w-4 h-4 stroke-[1.75]" :class="activeTab === item.id ? 'text-[#2DD4BF]' : ''" />
        <span class="text-[11px] font-semibold leading-none tracking-tight">{{ item.label }}</span>
      </button>
    </div>
  </nav>
</template>
