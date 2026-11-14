<script setup lang="ts">
import { useStore } from '../store';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-vue-next';

const store = useStore();

const getIcon = (type: 'success' | 'error' | 'info') => {
  switch (type) {
    case 'success':
      return CheckCircle2;
    case 'error':
      return AlertCircle;
    default:
      return Info;
  }
};
</script>

<template>
  <div class="fixed top-3 inset-x-0 z-[200] flex flex-col items-center gap-2 pointer-events-none px-4 pt-safe">
    <TransitionGroup
      enter-active-class="transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] transform"
      enter-from-class="-translate-y-3 opacity-0 scale-[0.98]"
      enter-to-class="translate-y-0 opacity-100 scale-100"
      leave-active-class="transition duration-150 ease-in transform"
      leave-from-class="translate-y-0 opacity-100 scale-100"
      leave-to-class="-translate-y-2 opacity-0 scale-[0.98]"
    >
      <div
        v-for="toast in store.toasts"
        :key="toast.id"
        class="pointer-events-auto flex items-center gap-3 pl-4 pr-1.5 py-2 rounded-2xl shadow-[0_8px_24px_-4px_rgba(11,59,64,0.22)] max-w-md w-full border backdrop-blur-xl text-xs sm:text-sm font-medium"
        :class="{
          'bg-[#0B3B40]/95 text-[#E6FFFA] border-white/10': toast.type === 'success',
          'bg-rose-950/95 text-rose-100 border-rose-500/30': toast.type === 'error',
          'bg-[#0F4C52]/95 text-[#E0F7FA] border-white/10': toast.type === 'info',
        }"
      >
        <component
          :is="getIcon(toast.type)"
          class="w-5 h-5 shrink-0 stroke-[1.75]"
          :class="{
            'text-[#2DD4BF]': toast.type === 'success',
            'text-rose-400': toast.type === 'error',
            'text-[#67E8F9]': toast.type === 'info',
          }"
        />
        <div class="flex-1 font-semibold leading-snug py-1">{{ toast.message }}</div>
        <button
          type="button"
          @click="store.dismissToast(toast.id)"
          class="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition-colors shrink-0 cursor-pointer"
          title="Tutup"
        >
          <X class="w-4 h-4 stroke-[1.75]" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
