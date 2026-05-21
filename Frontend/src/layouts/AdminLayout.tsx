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
      
      <div className="flex-1 flex flex-col ml-[240px]">
        <Header />
        <main className="flex-1 overflow-y-auto px-5 py-6 lg:px-8 custom-scrollbar relative">
          <div className="w-full max-w-[1800px] mx-auto">
            {children}
          </div>
        </main>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; h: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #c0c7d4; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #717783; }
      `}</style>
    </div>
  );
};
