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
  <div class="fixed top-3 inset-x-0 z-[200] flex flex-col items-center gap-2 pointer-events-none px-4">
    <TransitionGroup
      enter-active-class="transition duration-300 ease-out transform"
      enter-from-class="-translate-y-4 opacity-0 scale-95"
      enter-to-class="translate-y-0 opacity-100 scale-100"
      leave-active-class="transition duration-200 ease-in transform"
      leave-from-class="translate-y-0 opacity-100 scale-100"
      leave-to-class="-translate-y-3 opacity-0 scale-95"
    >
      <div
        v-for="toast in store.toasts"
        :key="toast.id"
        class="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl max-w-md w-full border backdrop-blur-xl text-xs sm:text-sm font-medium"
        :class="{
          'bg-[#1E352E]/95 text-[#C8D5B9] border-[#8FC0A9]/50 shadow-[#1E352E]/30': toast.type === 'success',
          'bg-rose-950/95 text-rose-100 border-rose-500/40 shadow-rose-950/30': toast.type === 'error',
          'bg-[#27443B]/95 text-[#C8D5B9] border-[#8FC0A9]/40 shadow-[#1E352E]/30': toast.type === 'info',
        }"
      >
        <component
          :is="getIcon(toast.type)"
          class="w-5 h-5 shrink-0"
          :class="{
            'text-[#8FC0A9]': toast.type === 'success',
            'text-rose-400': toast.type === 'error',
            'text-[#C8D5B9]': toast.type === 'info',
          }"
        />
        <div class="flex-1 font-semibold leading-relaxed">{{ toast.message }}</div>
        <button
          type="button"
          @click="store.dismissToast(toast.id)"
          class="p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          title="Tutup"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
