import React from 'react';
import { Search, Bell, User as UserIcon } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="h-12 bg-surface-container-lowest border-b border-outline-variant flex items-center justify-between px-6 sticky top-0 z-40">
      <div className="flex items-center space-x-2">
        <span className="text-label-md font-bold text-primary tracking-widest uppercase">Admin Center</span>
      </div>
      
      <div className="flex items-center space-x-6">
        <div className="relative flex items-center bg-surface-container text-on-surface-variant px-3 py-1 rounded border border-outline-variant w-64 group focus-within:border-primary transition-colors">
          <Search className="w-3.5 h-3.5" />
          <input 
            type="text" 
            placeholder="Search records..." 
            className="bg-transparent border-none focus:ring-0 text-[12px] w-full ml-2 placeholder:opacity-50"
          />
        </div>
        
        <div className="flex items-center space-x-4">
          <button className="text-on-surface-variant hover:text-primary transition-colors">
            <Bell className="w-4 h-4" />
          </button>
          <div className="flex items-center space-x-2 pl-4 border-l border-outline-variant">
            <div className="text-right hidden md:block">
              <p className="text-[11px] font-bold text-on-surface leading-none">Admin</p>
              <p className="text-[9px] text-on-surface-variant uppercase tracking-tighter">System Admin</p>
            </div>
            <div className="w-7 h-7 bg-secondary-container rounded flex items-center justify-center border border-outline-variant">
              <UserIcon className="w-4 h-4 text-secondary" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
