<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useStore } from './store';
import CycleCount from './views/CycleCount.vue';
import ProductIn from './views/ProductIn.vue';
import History from './views/History.vue';
import BottomNav from './components/BottomNav.vue';
import ToastHost from './components/ToastHost.vue';
import {
  Package,
  LogOut,
  RefreshCw,
  AlertTriangle,
  X,
  Wifi,
  WifiOff,
  CloudOff,
  ShieldCheck,
  User,
  ArrowRight,
  Database,
} from 'lucide-vue-next';

const store = useStore();

const activeTab = ref<'CC' | 'IN' | 'HISTORY'>('CC');
const usernameInput = ref('');
const passwordInput = ref('');
const loginError = ref('');

onMounted(() => {
  store.initialize();
  if (store.user) {
    store.fetchProducts();
    store.fetchTransactions();
  }
});

watch(
  () => store.user,
  (newUser) => {
    if (newUser) {
      store.fetchProducts();
      store.fetchTransactions();
    }
  }
);

const handleLogin = () => {
  const user = usernameInput.value.trim();
  if (!user) {
    loginError.value = 'Nama operator wajib diisi.';
    store.notify('error', 'Nama operator wajib diisi.');
    return;
  }

  if (passwordInput.value !== 'blp123') {
    loginError.value = 'Password salah. Gunakan password operator blp123.';
    store.notify('error', 'Password operator salah.');
    return;
  }

  loginError.value = '';
  store.login(user);
  store.notify('success', `Selamat bekerja, ${user}!`);
};
</script>

<template>
  <div class="min-h-dvh bg-[#F4F9F9] text-[#132327] font-sans antialiased selection:bg-[#2DD4BF] selection:text-[#082F33]">
    <ToastHost />

    <!-- 1. LOGIN SCREEN -->
    <div v-if="!store.user" class="min-h-dvh flex items-center justify-center p-4 pt-safe pb-safe">
      <div class="w-full max-w-sm p-6 sm:p-7 space-y-6 bg-white rounded-3xl border border-slate-900/[0.06] shadow-[0_6px_28px_-6px_rgba(11,59,64,0.09)]">
        <div class="text-center">
          <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0B3B40] text-[#2DD4BF] mb-3.5">
            <Package class="w-7 h-7 stroke-[1.75]" />
          </div>
          <h1 class="text-xl font-extrabold tracking-tight text-[#132327] leading-tight">
            Stock Opname Pro
          </h1>
          <p class="text-xs text-[#4A656B] font-medium mt-1">
            Warehouse Management & Cycle Count
          </p>
        </div>

        <form @submit.prevent="handleLogin" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-[#4A656B] uppercase tracking-wider mb-1.5">
              Nama Operator
            </label>
            <div class="relative">
              <User class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A656B]" />
              <input
                v-model="usernameInput"
                type="text"
                placeholder="Masukkan nama Anda..."
                required
                class="w-full min-h-[48px] pl-10 pr-4 py-3 bg-[#EEF5F5] border border-slate-900/[0.07] rounded-xl text-base text-[#132327] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/40 focus:border-[#0D9488] transition-all font-medium"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-[#4A656B] uppercase tracking-wider mb-1.5">
              Password Operator
            </label>
            <div class="relative">
              <ShieldCheck class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A656B]" />
              <input
                v-model="passwordInput"
                type="password"
                placeholder="Masukkan password operator..."
                required
                class="w-full min-h-[48px] pl-10 pr-4 py-3 bg-[#EEF5F5] border border-slate-900/[0.07] rounded-xl text-base text-[#132327] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/40 focus:border-[#0D9488] transition-all font-medium"
              />
            </div>
            <div v-if="loginError" class="mt-2 text-xs font-semibold text-rose-600">
              {{ loginError }}
            </div>
          </div>

          <button
            type="submit"
            class="w-full min-h-[48px] py-3.5 px-4 bg-[#0D9488] hover:bg-[#0F766E] text-white font-bold text-sm rounded-xl shadow-[0_4px_14px_-4px_rgba(13,148,136,0.45)] active:scale-[0.98] transition-all duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            <span>Masuk ke Sistem</span>
            <ArrowRight class="w-4 h-4 stroke-[2]" />
          </button>
        </form>

        <div class="pt-1 text-center text-xs text-[#4A656B] font-medium">
          Sinkronisasi Otomatis Google Sheets & Offline Storage
        </div>
      </div>
    </div>

    <!-- 2. MAIN APP SHELL (Mobile-focused container) -->
    <div v-else class="pb-20">
      <!-- Header -->
      <header class="sticky top-0 z-30 bg-[#0B3B40] border-b border-white/10 text-white" style="padding-top: env(safe-area-inset-top)">
        <div class="max-w-md mx-auto h-14 px-3.5 flex items-center justify-between gap-2">
          <!-- Brand & App Identity -->
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-9 h-9 rounded-xl bg-[#2DD4BF] flex items-center justify-center text-[#082F33] shrink-0">
              <Package class="w-4 h-4 stroke-[2]" />
            </div>
            <div class="min-w-0 leading-tight">
              <h1 class="text-sm font-extrabold tracking-tight text-white truncate">
                Cycle Count Bob & Frou
              </h1>
              <div class="flex items-center gap-1.5 text-xs text-[#99F6E4] mt-0.5">
                <span class="inline-block w-1.5 h-1.5 rounded-full shrink-0" :class="store.isOnline ? 'bg-[#2DD4BF]' : 'bg-rose-400'"></span>
                <span class="truncate font-semibold">{{ store.user }}</span>
                <span v-if="store.pendingCount > 0" class="text-amber-200 font-bold bg-amber-500/20 px-1.5 py-0.5 rounded-md text-xs leading-none tabular-nums">
                  {{ store.pendingCount }} pending
                </span>
              </div>
            </div>
          </div>

          <!-- Header Quick Actions (44x44px touch targets) -->
          <div class="flex items-center gap-1 shrink-0">
            <button
              type="button"
              @click="store.syncCloud()"
              :disabled="store.isSyncing"
              class="w-11 h-11 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/15 text-[#CCFBF1] hover:text-white transition-colors duration-[180ms] active:scale-[0.98] cursor-pointer disabled:opacity-60"
              title="Tarik data terbaru dari Google Sheets"
            >
              <RefreshCw class="w-4 h-4 stroke-[1.75]" :class="{ 'animate-spin': store.isSyncing }" />
            </button>

            <button
              type="button"
              @click="store.logout()"
              class="w-11 h-11 flex items-center justify-center rounded-xl bg-white/10 hover:bg-rose-500/20 text-[#CCFBF1] hover:text-rose-200 transition-colors duration-[180ms] active:scale-[0.98] cursor-pointer"
              title="Keluar"
            >
              <LogOut class="w-4 h-4 stroke-[1.75]" />
            </button>
          </div>
        </div>
      </header>

      <!-- Sync Error Alert -->
      <div v-if="store.syncError" class="max-w-md mx-auto px-3.5 mt-3">
        <div class="p-3.5 rounded-2xl bg-rose-50 border border-rose-500/20 text-rose-900 text-xs flex items-start gap-2.5 shadow-[0_2px_10px_-4px_rgba(225,29,72,0.12)]">
          <AlertTriangle class="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <div class="flex-1 min-w-0">
            <div class="font-bold">Koneksi Sinkronisasi Bermasalah</div>
            <p class="text-xs text-rose-700 mt-0.5 leading-relaxed">{{ store.syncError }}</p>
            <button
              type="button"
              @click="store.syncCloud()"
              :disabled="store.isSyncing"
              class="mt-2 min-h-[36px] px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-60"
            >
              Coba Lagi
            </button>
          </div>
          <button
            type="button"
            @click="store.clearSyncError()"
            class="min-w-[44px] min-h-[44px] -mr-1.5 -mt-1.5 flex items-center justify-center rounded-xl text-rose-500 hover:text-rose-800 hover:bg-rose-100/70 transition-colors cursor-pointer"
            title="Tutup"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Main Application Views (Mobile Focused Container) -->
      <main class="max-w-md mx-auto px-3.5 pt-4">
        <Transition
          mode="out-in"
          enter-active-class="transition duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
          enter-from-class="opacity-0 translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-1"
        >
          <CycleCount v-if="activeTab === 'CC'" />
          <ProductIn v-else-if="activeTab === 'IN'" />
          <History v-else-if="activeTab === 'HISTORY'" />
        </Transition>
      </main>

      <!-- Bottom Navigation -->
      <BottomNav v-model:activeTab="activeTab" />
    </div>
  </div>
</template>
