<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Zap, ZapOff, ScanLine, CameraOff } from 'lucide-vue-next';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'scan', code: string): void;
}>();

const error = ref('');
const isTorchOn = ref(false);
const hasTorch = ref(false);
let scannerInstance: Html5Qrcode | null = null;

// Synthetic beep feedback via Web Audio API
const playBeep = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    // AudioContext not available or blocked
  }
};

const triggerHaptic = () => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([60, 40, 80]);
    } catch {
      // Haptics not allowed
    }
  }
};

const startScanner = async () => {
  if (!props.isOpen) return;

  try {
    const scanner = new Html5Qrcode('barcode-viewport', {
      verbose: false,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.QR_CODE,
      ],
    });
    scannerInstance = scanner;

    const config = {
      fps: 20,
      qrbox: (w: number) => ({ width: Math.floor(w * 0.85), height: 140 }),
      aspectRatio: 1.0,
    };

    await scanner.start(
      { facingMode: 'environment' },
      config,
      async (decodedText) => {
        triggerHaptic();
        playBeep();
        if (scannerInstance && scannerInstance.isScanning) {
          try {
            await scannerInstance.stop();
          } catch {
            // Ignore stop errors
          }
        }
        emit('scan', decodedText);
      },
      () => {
        // Ignored frame mismatch
      }
    );

    const capabilities = scanner.getRunningTrackCameraCapabilities();
    if (capabilities && (capabilities as any).torch) {
      hasTorch.value = true;
    }
  } catch (err: any) {
    error.value = err?.message || 'Kamera tidak dapat diakses atau izin ditolak.';
  }
};

const toggleTorch = async () => {
  if (scannerInstance && scannerInstance.isScanning) {
    const nextState = !isTorchOn.value;
    try {
      await scannerInstance.applyVideoConstraints({
        advanced: [{ torch: nextState } as any],
      });
      isTorchOn.value = nextState;
    } catch (e) {
      console.warn('Torch toggle failed', e);
    }
  }
};

const handleClose = async () => {
  if (scannerInstance && scannerInstance.isScanning) {
    try {
      await scannerInstance.stop();
    } catch {
      // Ignore
    }
  }
  emit('close');
};

onMounted(() => {
  startScanner();
});

onBeforeUnmount(async () => {
  if (scannerInstance && scannerInstance.isScanning) {
    try {
      await scannerInstance.stop();
    } catch {
      // Ignore
    }
  }
});
</script>

<template>
  <div class="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col">
      <!-- Modal Header -->
      <div class="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/70">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ScanLine class="w-4 h-4" />
          </div>
          <div>
            <h3 class="font-bold text-sm text-white tracking-tight">Scanner Barcode</h3>
            <p class="text-[11px] text-slate-400">1D Barcode & QR Code</p>
          </div>
        </div>

        <button
          type="button"
          @click="handleClose"
          class="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Viewport Container -->
      <div class="relative w-full h-[320px] bg-black flex items-center justify-center overflow-hidden">
        <div id="barcode-viewport" class="w-full h-full"></div>

        <!-- HUD Laser Guide -->
        <div class="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div class="relative w-[85%] h-[140px] rounded-2xl border-2 border-emerald-400/60 shadow-[0_0_0_9999px_rgba(15,23,42,0.65)] overflow-hidden">
            <!-- Corner Brackets -->
            <div class="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-emerald-400"></div>
            <div class="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-emerald-400"></div>
            <div class="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-emerald-400"></div>
            <div class="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-emerald-400"></div>

            <!-- Laser Beam Line -->
            <div class="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-scan-laser"></div>
          </div>
        </div>
      </div>

      <!-- Action & Error Footer -->
      <div class="p-5 flex flex-col items-center gap-3 bg-slate-900">
        <div v-if="error" class="w-full p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-2">
          <CameraOff class="w-4 h-4 shrink-0 text-rose-400" />
          <span>{{ error }}</span>
        </div>

        <div v-else class="text-center">
          <p class="text-[12px] font-medium text-slate-400">
            Posisikan garis laser hijau sejajar dengan barcode fisik barang.
          </p>
        </div>

        <div v-if="hasTorch" class="pt-1">
          <button
            type="button"
            @click="toggleTorch"
            class="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all shadow-md"
            :class="isTorchOn ? 'bg-amber-400 text-slate-950 shadow-amber-400/30' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'"
          >
            <component :is="isTorchOn ? Zap : ZapOff" class="w-3.5 h-3.5" />
            <span>{{ isTorchOn ? 'Matikan Senter' : 'Nyalakan Senter' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
:deep(#barcode-viewport video) {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
}
</style>

