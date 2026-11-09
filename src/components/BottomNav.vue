<script setup lang="ts">
import { ClipboardList, PackagePlus, History } from 'lucide-vue-next';

defineProps<{
  activeTab: 'CC' | 'IN' | 'HISTORY';
}>();

const emit = defineEmits<{
  (e: 'update:activeTab', tab: 'CC' | 'IN' | 'HISTORY'): void;
}>();

const navs = [
  { id: 'CC', label: 'Cycle Count', icon: ClipboardList, badgeColor: 'from-emerald-500 to-teal-500' },
  { id: 'IN', label: 'Product In', icon: PackagePlus, badgeColor: 'from-teal-500 to-cyan-500' },
  { id: 'HISTORY', label: 'Riwayat', icon: History, badgeColor: 'from-cyan-500 to-blue-500' },
] as const;
</script>

<template>
  <nav class="fixed bottom-0 inset-x-0 z-40 pb-safe pointer-events-none">
    <div class="max-w-md mx-auto px-4 pb-2">
      <div class="pointer-events-auto bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-1.5 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.5)] flex items-center justify-between">
        <button
          v-for="item in navs"
          :key="item.id"
          type="button"
          @click="emit('update:activeTab', item.id)"
          class="relative flex-1 flex flex-col items-center justify-center py-2 px-3 rounded-2xl transition-all duration-300 group cursor-pointer"
          :class="activeTab === item.id ? 'text-white' : 'text-slate-400 hover:text-slate-200'"
        >
          <!-- Active Pill Background Indicator -->
          <div
            v-if="activeTab === item.id"
            class="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 border border-emerald-500/40 rounded-2xl shadow-inner transition-all duration-300"
          />

          <div
            class="relative z-10 flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-300"
            :class="activeTab === item.id ? 'bg-gradient-to-br ' + item.badgeColor + ' text-white shadow-lg shadow-emerald-500/30 scale-105' : 'text-slate-400 group-hover:text-slate-200'"
          >
            <component :is="item.icon" class="w-4 h-4" />
          </div>

          <span
            class="relative z-10 text-[11px] font-semibold mt-1 tracking-tight transition-colors duration-200"
            :class="activeTab === item.id ? 'text-emerald-300 font-bold' : 'text-slate-400'"
          >
            {{ item.label }}
          </span>
        </button>
      </div>
    </div>
  </nav>
</template>

