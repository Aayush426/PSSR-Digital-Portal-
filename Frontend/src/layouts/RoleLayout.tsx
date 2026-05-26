import React from 'react';
import { Bell, ClipboardCheck, FileClock, LayoutDashboard, LogOut, Search, ShieldCheck, User as UserIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface RoleLayoutProps {
  children: React.ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const RoleLayout: React.FC<RoleLayoutProps> = ({ children, currentPath, onNavigate }) => {
  const { user, logout } = useAuth();
  const dashboardPath = user?.role === 'AREA_OWNER' ? '/area-owner/dashboard' : '/team/dashboard';
  const visibleNav = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, path: dashboardPath },
    ...(user?.role === 'AREA_OWNER'
      ? [
          { id: 'review', name: 'Review Queue', icon: FileClock, path: '/area-owner/dashboard' },
          { id: 'compliance', name: 'Compliance Gate', icon: ShieldCheck, path: '/area-owner/dashboard' },
        ]
      : [
          { id: 'assigned', name: 'Assigned PSSR', icon: ClipboardCheck, path: '/team/dashboard' },
          { id: 'compliance', name: 'Compliance Gate', icon: ShieldCheck, path: '/team/dashboard' },
        ]),
  ];

  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      <aside className="w-60 bg-surface-container-low border-r border-outline-variant flex flex-col h-screen fixed left-0 top-0 overflow-y-auto custom-scrollbar">
        <div className="p-6">
          <h1 className="text-headline-sm font-black text-primary tracking-tighter uppercase leading-none">Digital PSSR</h1>
          <p className="text-[10px] text-on-surface-variant opacity-60 mt-1 uppercase font-bold tracking-widest">Refinery Operations</p>
        </div>

        <nav className="flex-1 px-2 space-y-0.5 mt-4">
          {visibleNav.map((item) => {
            const isActive = currentPath === item.path || (item.id === 'dashboard' && currentPath.includes('/dashboard'));
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
              <ShieldCheck className="w-4 h-4 text-primary" />
            </div>
            <div className="overflow-hidden">
              <p className="text-[10px] font-black text-primary uppercase leading-tight">{user?.role.replace('_', ' ')}</p>
              <p className="text-[9px] text-on-surface-variant truncate">{user?.department}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col ml-60">
        <header className="h-12 bg-surface-container-lowest border-b border-outline-variant flex items-center justify-between px-6 sticky top-0 z-40">
          <div className="flex items-center space-x-2">
            <span className="text-label-md font-bold text-primary tracking-widest uppercase">Operations Workbench</span>
          </div>

          <div className="flex items-center space-x-6">
            <div className="relative hidden md:flex items-center bg-surface-container text-on-surface-variant px-3 py-1 rounded border border-outline-variant w-64 group focus-within:border-primary transition-colors">
              <Search className="w-3.5 h-3.5" />
              <input type="text" placeholder="Search records..." className="bg-transparent border-none focus:ring-0 text-[12px] w-full ml-2 placeholder:opacity-50" />
            </div>
            <button className="text-on-surface-variant hover:text-primary transition-colors" aria-label="Notifications">
              <Bell className="w-4 h-4" />
            </button>
            <div className="flex items-center space-x-2 pl-4 border-l border-outline-variant">
              <div className="text-right hidden md:block">
                <p className="text-[11px] font-bold text-on-surface leading-none">{user?.full_name}</p>
                <p className="text-[9px] text-on-surface-variant uppercase tracking-tighter">{user?.designation}</p>
              </div>
              <div className="w-7 h-7 bg-secondary-container rounded flex items-center justify-center border border-outline-variant">
                <UserIcon className="w-4 h-4 text-secondary" />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-6 py-6 lg:px-8">
          {/* Unified max-width constraint: consistent with AdminLayout */}
          <div className="w-full mx-auto" style={{ maxWidth: 'var(--container-operational)' }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
