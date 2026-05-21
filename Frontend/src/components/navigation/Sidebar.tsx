import React from 'react';
import { NAV_ITEMS } from '../../constants/navigation';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPath, onNavigate }) => {
  const { logout } = useAuth();

  return (
    <aside className="w-60 bg-surface-container-low border-r border-outline-variant flex flex-col h-screen fixed left-0 top-0 overflow-y-auto custom-scrollbar">
      <div className="p-6">
        <h1 className="text-headline-sm font-black text-primary tracking-tighter uppercase leading-none">Digital PSSR</h1>
        <p className="text-[10px] text-on-surface-variant opacity-60 mt-1 uppercase font-bold tracking-widest">Refinery Operations</p>
      </div>

      <nav className="flex-1 px-2 space-y-0.5 mt-4">
        {NAV_ITEMS.map((item) => {
          const isActive = currentPath === item.path;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.path)}
              className={`w-full flex items-center px-4 py-2 text-[12px] transition-all group ${
                isActive 
                  ? 'bg-primary text-on-primary font-bold shadow-sm' 
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-primary'
              }`}
            >
              <item.icon className={`w-4 h-4 mr-3 ${isActive ? 'text-on-primary' : 'text-outline group-hover:text-primary transition-colors'}`} />
              {item.name}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-outline-variant bg-surface-container-lowest space-y-2">
        <button 
          onClick={() => void logout()}
          className="w-full flex items-center px-4 py-2 text-[10px] font-black uppercase text-error hover:bg-error/5 rounded transition-all tracking-widest"
        >
          <LogOut className="w-3.5 h-3.5 mr-3" />
          Terminate Session
        </button>

        <div className="p-3 bg-surface border border-outline-variant rounded flex items-center space-x-3">
          <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
            <div className="w-4 h-4 border-2 border-primary rounded-sk"></div>
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] font-black text-primary uppercase leading-tight">License: Enterprise</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
