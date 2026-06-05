import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Flashlight } from 'lucide-react';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (result: string) => void;
}

export default function ScannerModal({ isOpen, onClose, onScan }: ScannerModalProps) {
  const [error, setError] = useState('');
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (isOpen) {
      const scanner = new Html5Qrcode("reader-container", {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
        ]
      });
      scannerRef.current = scanner;

      const config = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          return { width: viewfinderWidth * 0.8, height: 120 };
        },
        aspectRatio: 1.0,
      };

      scanner.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          scanner.stop().then(() => {
            onScan(decodedText);
          }).catch(console.error);
        },
        (errorMsg) => {
          // Ignored for frequent frame fail
        }
      ).then(() => {
        const capabilities = scanner.getRunningTrackCameraCapabilities();
        if (capabilities && (capabilities as any).torch) {
          setHasTorch(true);
        }
      }).catch(err => {
        setError("Kamera tidak dapat diakses.");
      });

      return () => {
        if (scanner.isScanning) {
          scanner.stop().catch(console.error);
        }
      };
    } else {
      setIsTorchOn(false);
      setHasTorch(false);
      setError('');
    }
  }, [isOpen, onScan]);

  const toggleTorch = () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      const newTorchState = !isTorchOn;
      scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: newTorchState } as any]
      }).then(() => {
        setIsTorchOn(newTorchState);
      }).catch(err => {
        console.warn("Torch cannot be toggled", err);
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center p-4">
      <style>{`
        @keyframes scanline {
          0% { transform: translateY(-10px); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(118px); opacity: 0; }
        }
        #reader-container video {
          object-fit: cover !important;
        }
      `}</style>
      
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 shadow-2xl">
        <div className="w-full p-4 bg-gray-50 flex items-center justify-between border-b border-gray-100">
          <h3 className="font-bold text-gray-800">📷 Scan Barcode</h3>
          <button onClick={onClose} className="p-2 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="w-full relative bg-black flex justify-center items-center overflow-hidden h-[300px]">
          <div id="reader-container" className="w-full h-full opacity-90"></div>
          
          {/* Overlay Box */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-[80%] h-[120px] rounded-xl border-4 border-white/40 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] relative overflow-hidden">
               <div className="w-full h-[3px] bg-red-500 shadow-[0_0_15px_rgba(239,68,68,1)] animate-[scanline_2.5s_linear_infinite]"></div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="p-4 text-center text-sm font-bold text-white bg-red-500 m-4 rounded-xl shadow-md">{error}</div>
        ) : (
          <div className="p-5 flex flex-col items-center gap-3">
            <p className="text-xs font-semibold text-gray-500 text-center uppercase tracking-wider">
              Arahkan garis merah ke barcode batang (1D)
            </p>
            {hasTorch && (
              <button 
                onClick={toggleTorch} 
                className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm transition-all ${isTorchOn ? 'bg-primary text-white shadow-md shadow-primary/30' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                <Flashlight className="w-4 h-4" /> {isTorchOn ? 'Matikan Flash' : 'Nyalakan Flash'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
