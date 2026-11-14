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
  <div class="fixed inset-0 z-50 bg-[#0F1117]/85 backdrop-blur-md flex flex-col items-center justify-center p-4">
    <div class="bg-[#161922] border border-white/[0.08] rounded-3xl w-full max-w-sm overflow-hidden shadow-[0_20px_50px_-12px_rgba(0,0,0,0.6)] flex flex-col">
      <!-- Modal Header -->
      <div class="px-4 py-3.5 border-b border-white/[0.07] flex items-center justify-between bg-[#161922]">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-[#2DD4BF]/15 border border-[#2DD4BF]/30 flex items-center justify-center text-[#5EEAD4]">
            <ScanLine class="w-4 h-4 stroke-[1.75]" />
          </div>
          <div>
            <h3 class="font-bold text-sm text-[#F1F3F7] tracking-tight">Scanner Barcode</h3>
            <p class="text-xs text-[#949CAE]">1D Barcode & QR Code</p>
          </div>
        </div>

        <button
          type="button"
          @click="handleClose"
          class="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-[#1E222D] hover:bg-white/10 text-[#949CAE] hover:text-[#F1F3F7] transition-colors duration-[180ms] cursor-pointer"
          title="Tutup"
        >
          <X class="w-5 h-5 stroke-[1.75]" />
        </button>
      </div>

      <!-- Viewport Container -->
      <div class="relative w-full h-[320px] bg-[#0F1117] flex items-center justify-center overflow-hidden">
        <div id="barcode-viewport" class="w-full h-full"></div>

        <!-- HUD Laser Guide -->
        <div class="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div class="relative w-[85%] h-[140px] rounded-2xl border-2 border-[#2DD4BF] shadow-[0_0_0_9999px_rgba(15,17,23,0.65)] overflow-hidden">
            <!-- Corner Brackets -->
            <div class="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#67E8F9]"></div>
            <div class="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#67E8F9]"></div>
            <div class="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#67E8F9]"></div>
            <div class="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#67E8F9]"></div>

            <!-- Laser Beam Line -->
            <div class="absolute inset-x-3 h-0.5 bg-[#2DD4BF] rounded-full animate-scan-laser"></div>
          </div>
        </div>
      </div>

      <!-- Action & Error Footer -->
      <div class="p-5 flex flex-col items-center gap-3 bg-[#161922]">
        <div v-if="error" class="w-full p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs font-medium flex items-center gap-2.5">
          <CameraOff class="w-4 h-4 shrink-0 text-rose-400" />
          <span>{{ error }}</span>
        </div>

        <div v-else class="text-center">
          <p class="text-xs font-medium text-[#949CAE]">
            Posisikan garis aqua sejajar dengan barcode fisik barang.
          </p>
        </div>

        <div v-if="hasTorch" class="pt-1">
          <button
            type="button"
            @click="toggleTorch"
            class="min-h-[44px] flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all duration-[180ms] cursor-pointer active:scale-[0.98]"
            :class="isTorchOn ? 'bg-amber-400 text-[#14171F]' : 'bg-[#1E222D] text-[#F1F3F7] hover:bg-white/10 border border-white/[0.08]'"
          >
            <component :is="isTorchOn ? Zap : ZapOff" class="w-4 h-4 stroke-[1.75]" />
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

