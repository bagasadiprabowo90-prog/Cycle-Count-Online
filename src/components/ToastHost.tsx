import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useStore } from '../store';

const styles = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
};

const icons = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

export default function ToastHost() {
  const { toasts, dismissToast } = useStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-3 top-3 z-[200] flex w-[calc(100%-1.5rem)] max-w-sm flex-col gap-2 sm:right-4 sm:top-4">
      {toasts.map(toast => {
        const Icon = icons[toast.type];

        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 rounded-xl border p-3 text-sm shadow-lg backdrop-blur-md ${styles[toast.type]}`}
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="flex-1 font-semibold leading-snug">{toast.message}</div>
            <button onClick={() => dismissToast(toast.id)} className="rounded-md p-1 hover:bg-black/5" title="Tutup notifikasi">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
