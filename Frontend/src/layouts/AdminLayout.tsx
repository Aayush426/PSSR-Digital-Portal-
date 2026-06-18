import React from 'react';
import { Header } from '../components/navigation/Header';
import { Sidebar } from '../components/navigation/Sidebar';

interface AdminLayoutProps {
  children: React.ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children, currentPath, onNavigate }) => {
  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      <Sidebar currentPath={currentPath} onNavigate={onNavigate} />
      
      <div className="flex-1 flex flex-col ml-60">
        <Header />
        <main className="flex-1 overflow-y-auto px-6 py-6 lg:px-8 relative">
          {/* Single unified max-width constraint at app level */}
          <div className="w-full mx-auto" style={{ maxWidth: 'var(--container-operational)' }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
