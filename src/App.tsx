import { useEffect, useState } from 'react';
import { useStore } from './store';
import CycleCount from './views/CycleCount';
import ProductIn from './views/ProductIn';
import History from './views/History';
import BottomNav from './components/BottomNav';
import ToastHost from './components/ToastHost';
import { AlertTriangle, Package, LogOut, RefreshCw, X, Wifi, WifiOff, CloudOff } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'CC' | 'IN' | 'HISTORY'>('CC');
  const { user, login, logout, fetchProducts, fetchTransactions, syncCloud, isSyncing, syncError, clearSyncError, notify, isOnline, pendingCount, initialize } = useStore();
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // Initialize app on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (user) {
      fetchProducts();
      fetchTransactions();
    }
  }, [user, fetchProducts, fetchTransactions]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <ToastHost />
        <div className="bg-white rounded-2xl w-full max-w-sm p-8 shadow-xl border border-slate-200">
          <div className="text-center mb-6">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white shadow-sm">
              <Package className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Stock Opname Pro</h1>
            <p className="text-slate-500 text-sm mt-1">Warehouse stock control</p>
          </div>
          <form onSubmit={(e) => {
            e.preventDefault();
            const username = usernameInput.trim();

            if (!username) {
              setLoginError('Username wajib diisi.');
              notify('error', 'Username operator wajib diisi.');
              return;
            }

            if (passwordInput !== 'blp123') {
              setLoginError('Password salah. Hubungi admin jika lupa password.');
              notify('error', 'Password operator salah.');
              return;
            }

            setLoginError('');
            login(username);
            notify('success', `Masuk sebagai ${username}`);
          }}>
            <div className="mb-5">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Username</label>
              <input
                className="w-full p-4 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-success transition-colors text-slate-900"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="Masukkan nama Anda..."
                required
              />
            </div>
            <div className="mb-5">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Password</label>
              <input
                type="password"
                className="w-full p-4 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-success transition-colors text-slate-900"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Masukkan password operator"
                required
              />
              {loginError && <div className="mt-2 text-xs font-bold text-red-600">{loginError}</div>}
            </div>
            <button
              type="submit"
              className="w-full bg-primary text-white font-bold py-4 rounded-xl shadow-lg hover:bg-primary-dark transition-all"
            >
              Masuk ke Sistem
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <ToastHost />
      {/* Header */}
      <header className="bg-gradient-to-br from-slate-900 via-indigo-900 to-teal-900 text-white p-4 sticky top-0 z-20 shadow-xl">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-500 to-teal-500 p-2.5 rounded-xl shadow-lg">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-base text-white tracking-tight">Stock Opname</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => syncCloud()}
              className={`p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors shadow-sm ${isSyncing ? 'animate-spin opacity-50' : ''}`}
              title="Tarik data terbaru dari Google Sheets"
            >
              <RefreshCw className="w-4 h-4 text-white" />
            </button>
            <button onClick={() => logout()} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-teal-400 animate-pulse' : 'bg-red-400'}`}></div>
          <span className="text-xs font-medium text-indigo-100">{user}</span>
          {!isOnline && (
            <span className="text-[10px] bg-red-500/30 text-red-200 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
              <WifiOff className="w-3 h-3" /> Offline
            </span>
          )}
          {pendingCount > 0 && (
            <span className="text-[10px] bg-amber-500/30 text-amber-200 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
              <CloudOff className="w-3 h-3" /> {pendingCount} pending
            </span>
          )}
          <span className="text-[10px] bg-teal-500/30 text-teal-200 px-2 py-0.5 rounded-full font-medium">Sheets Sync</span>
        </div>
      </header>

      {syncError && (
        <div className="mx-auto mt-4 w-full max-w-lg px-4">
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 shadow-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              <div className="font-bold">Sync Google Sheets gagal</div>
              <div className="mt-0.5 text-xs">{syncError}</div>
            </div>
            <button onClick={clearSyncError} className="rounded-lg p-1 hover:bg-red-100" title="Tutup pesan error">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="p-4 w-full max-w-lg mx-auto">
        {activeTab === 'CC' && <CycleCount />}
        {activeTab === 'IN' && <ProductIn />}
        {activeTab === 'HISTORY' && <History />}
      </main>

      {/* Bottom Nav */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
