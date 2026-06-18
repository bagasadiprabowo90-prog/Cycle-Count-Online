import React from 'react';
import { ClipboardList, PackagePlus, Clock } from 'lucide-react';

interface BottomNavProps {
  activeTab: 'CC' | 'IN' | 'HISTORY';
  setActiveTab: (tab: 'CC' | 'IN' | 'HISTORY') => void;
}

export default function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  const navs = [
    { id: 'CC', label: 'Cycle Count', icon: ClipboardList, gradient: 'from-emerald-500 to-teal-500', activeBg: 'bg-gradient-to-br from-emerald-500 to-teal-500' },
    { id: 'IN', label: 'Product In', icon: PackagePlus, gradient: 'from-emerald-600 to-teal-600', activeBg: 'bg-gradient-to-br from-emerald-600 to-teal-600' },
    { id: 'HISTORY', label: 'History', icon: Clock, gradient: 'from-teal-500 to-cyan-500', activeBg: 'bg-gradient-to-br from-teal-500 to-cyan-500' },
  ] as const;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-[0_-4px_20px_rgba(15,23,42,0.08)] pb-safe z-50">
      <div className="flex px-2 py-2">
        {navs.map(nav => {
          const isActive = activeTab === nav.id;
          const Icon = nav.icon;
          return (
            <button
              key={nav.id}
              className={`flex-1 flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 ${isActive ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
              onClick={() => setActiveTab(nav.id)}
            >
              <div className={`p-2.5 rounded-xl transition-all duration-300 shadow-sm ${isActive ? `${nav.activeBg} text-white shadow-lg` : 'bg-slate-100 text-slate-500'}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={`text-[11px] font-semibold mt-1.5 ${isActive ? 'text-slate-800' : ''}`}>{nav.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}