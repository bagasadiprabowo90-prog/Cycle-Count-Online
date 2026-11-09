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
  <div class="min-h-screen bg-[#F4F7F4] text-[#172D26] font-sans antialiased selection:bg-[#8FC0A9] selection:text-[#172D26]">
    <ToastHost />

    <!-- 1. LOGIN SCREEN -->
    <div v-if="!store.user" class="min-h-screen flex items-center justify-center p-4">
      <div class="w-full max-w-sm p-7 sm:p-8 space-y-6 bg-white rounded-3xl border border-[#8FC0A9]/40 shadow-xl shadow-[#223F36]/5 relative overflow-hidden">
        <!-- Ambient decorative corner glow using #C8D5B9 and #8FC0A9 -->
        <div class="absolute -top-16 -right-16 w-36 h-36 bg-[#C8D5B9]/40 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -bottom-16 -left-16 w-36 h-36 bg-[#8FC0A9]/30 rounded-full blur-3xl pointer-events-none"></div>

        <div class="text-center relative">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-[#8FC0A9] to-[#2D5347] text-white shadow-lg shadow-[#8FC0A9]/30 mb-3.5">
            <Package class="w-8 h-8" />
          </div>
          <h1 class="text-xl font-extrabold tracking-tight text-[#172D26]">
            Stock Opname Pro
          </h1>
          <p class="text-xs text-[#4F685F] font-medium mt-1">
            Warehouse Management & Cycle Count
          </p>
        </div>

        <form @submit.prevent="handleLogin" class="space-y-4 relative">
          <div>
            <label class="block text-[11px] font-bold text-[#4F685F] uppercase tracking-wider mb-1.5">
              Nama Operator
            </label>
            <div class="relative">
              <User class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A958B]" />
              <input
                v-model="usernameInput"
                type="text"
                placeholder="Masukkan nama Anda..."
                required
                class="w-full pl-10 pr-4 py-3 bg-[#FAFBF9] border border-[#C8D5B9] rounded-2xl text-xs sm:text-sm text-[#172D26] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#8FC0A9]/40 focus:border-[#8FC0A9] transition-all font-medium"
              />
            </div>
          </div>

          <div>
            <label class="block text-[11px] font-bold text-[#4F685F] uppercase tracking-wider mb-1.5">
              Password Operator
            </label>
            <div class="relative">
              <ShieldCheck class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A958B]" />
              <input
                v-model="passwordInput"
                type="password"
                placeholder="Masukkan password operator..."
                required
                class="w-full pl-10 pr-4 py-3 bg-[#FAFBF9] border border-[#C8D5B9] rounded-2xl text-xs sm:text-sm text-[#172D26] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#8FC0A9]/40 focus:border-[#8FC0A9] transition-all font-medium"
              />
            </div>
            <div v-if="loginError" class="mt-2 text-xs font-semibold text-rose-600">
              {{ loginError }}
            </div>
          </div>

          <button
            type="submit"
            class="w-full py-3.5 px-4 bg-gradient-to-r from-[#8FC0A9] to-[#68A68C] hover:from-[#7EB39B] hover:to-[#5B987F] text-[#13251F] font-extrabold text-xs sm:text-sm rounded-2xl shadow-lg shadow-[#8FC0A9]/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            <span>Masuk ke Sistem</span>
            <ArrowRight class="w-4 h-4" />
          </button>
        </form>

        <div class="pt-2 text-center text-[10px] text-[#7A958B] font-medium">
          Sinkronisasi Otomatis Google Sheets & Offline Storage
        </div>
      </div>
    </div>

    <!-- 2. MAIN APP SHELL -->
    <div v-else class="pb-28 pb-safe">
      <!-- Top Sticky Header with Theme Palette -->
      <header class="sticky top-0 z-30 bg-[#1E352E]/95 backdrop-blur-xl border-b border-[#8FC0A9]/20 text-white shadow-xl shadow-[#1E352E]/15">
        <div class="max-w-md mx-auto px-4 py-3">
          <div class="flex items-center justify-between">
            <!-- Brand & App Identity -->
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#C8D5B9] to-[#8FC0A9] flex items-center justify-center text-[#1E352E] shadow-md shadow-[#8FC0A9]/20">
                <Package class="w-5 h-5 font-bold" />
              </div>
              <div>
                <h1 class="text-sm font-extrabold tracking-tight text-white leading-tight">
                  Stock Opname Pro
                </h1>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <span class="inline-block w-1.5 h-1.5 rounded-full" :class="store.isOnline ? 'bg-[#8FC0A9] animate-pulse' : 'bg-rose-400'"></span>
                  <span class="text-[10px] font-semibold text-[#C8D5B9]">{{ store.user }}</span>
                </div>
              </div>
            </div>

            <!-- Header Quick Action Pills -->
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                @click="store.syncCloud()"
                :disabled="store.isSyncing"
                class="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white transition-colors shadow-sm"
                title="Tarik data terbaru dari Google Sheets"
              >
                <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': store.isSyncing }" />
              </button>

              <button
                type="button"
                @click="store.logout()"
                class="p-2 rounded-xl bg-white/10 hover:bg-rose-500/20 text-white hover:text-rose-300 transition-colors"
                title="Keluar"
              >
                <LogOut class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Status Bar Meta (Online/Offline, Pending Queue, Sheets indicator) -->
          <div class="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-white/10">
            <!-- Online / Offline Badge -->
            <div
              class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors"
              :class="
                store.isOnline
                  ? 'bg-[#8FC0A9]/20 text-[#C8D5B9] border-[#8FC0A9]/40'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
              "
            >
              <component :is="store.isOnline ? Wifi : WifiOff" class="w-2.5 h-2.5" />
              <span>{{ store.isOnline ? 'Online' : 'Offline' }}</span>
            </div>

            <!-- Pending writes badge -->
            <div
              v-if="store.pendingCount > 0"
              class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-200 border border-amber-500/30"
            >
              <CloudOff class="w-2.5 h-2.5" />
              <span>{{ store.pendingCount }} pending</span>
            </div>

            <!-- Cloud Database Tag -->
            <div class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-black/20 text-[#C8D5B9] border border-white/10 ml-auto">
              <Database class="w-2.5 h-2.5 text-[#8FC0A9]" />
              <span>Sheets Sync</span>
            </div>
          </div>
        </div>
      </header>

      <!-- Sync Error Alert -->
      <div v-if="store.syncError" class="max-w-md mx-auto px-4 mt-3">
        <div class="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 shadow-sm">
          <AlertTriangle class="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <div class="flex-1">
            <div class="font-bold">Koneksi Sinkronisasi Bermasalah</div>
            <p class="text-[11px] text-rose-600 mt-0.5">{{ store.syncError }}</p>
          </div>
          <button type="button" @click="store.clearSyncError()" class="text-rose-400 hover:text-rose-700 p-0.5">
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <!-- Main Application Views (Mobile Focused Container) -->
      <main class="max-w-md mx-auto px-3.5 pt-3.5">
        <Transition
          mode="out-in"
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0 translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-1"
        >
          <CycleCount v-if="activeTab === 'CC'" />
          <ProductIn v-else-if="activeTab === 'IN'" />
          <History v-else-if="activeTab === 'HISTORY'" />
        </Transition>
      </main>

      <!-- Bottom Floating Dock Navigation -->
      <BottomNav v-model:activeTab="activeTab" />
    </div>
  </div>
</template>
