import React from 'react';
import { PageTitle, StatusBadge } from '../../components/shared/UIItems';
import { Upload, Search, Download, MoreVertical, FileArchive } from 'lucide-react';
import type { Annexure } from '../../types/app.types';

const LIVE_ANNEXURES: Annexure[] = [];

export const AnnexuresPage: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-start">
        <PageTitle 
          title="Annexure Repository" 
          subtitle="Manage technical documentation templates, version control, and mapping."
          breadcrumbs={['Compliance', 'Documentation', 'Annexures']} 
        />
        <div className="flex space-x-2">
           <button className="bg-surface-container-lowest border border-outline-variant hover:bg-surface-container text-on-surface font-black text-label-md px-4 py-2 rounded flex items-center transition-all">
            <Download className="mr-2 w-4 h-4" />
            Download Catalog
          </button>
          <button className="bg-primary hover:bg-primary-container text-on-primary font-black text-label-md px-4 py-2 rounded flex items-center shadow-md transition-all active:scale-95">
            <Upload className="mr-2 w-4 h-4" />
            Upload Manifest Template
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-surface-container-low border border-outline-variant p-6 rounded flex items-center space-x-4">
          <div className="w-12 h-12 bg-primary/10 rounded flex items-center justify-center text-primary">
            <FileArchive className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-black text-on-surface leading-none">24</p>
            <p className="text-[10px] text-outline font-black uppercase tracking-widest mt-1">Total Templates</p>
          </div>
        </div>
        <div className="bg-surface-container-low border border-outline-variant p-6 rounded flex items-center space-x-4">
          <div className="w-12 h-12 bg-green-500/10 rounded flex items-center justify-center text-green-600">
            <div className="w-3 h-3 bg-current rounded-full"></div>
          </div>
          <div>
            <p className="text-2xl font-black text-on-surface leading-none">18</p>
            <p className="text-[10px] text-outline font-black uppercase tracking-widest mt-1">Active Variants</p>
          </div>
        </div>
        <div className="bg-surface-container-low border border-outline-variant p-6 rounded flex items-center space-x-4">
          <div className="w-12 h-12 bg-tertiary/10 rounded flex items-center justify-center text-tertiary font-black text-xs">P</div>
          <div>
            <p className="text-2xl font-black text-on-surface leading-none">3</p>
            <p className="text-[10px] text-outline font-black uppercase tracking-widest mt-1">Pending Updates</p>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-outline-variant p-3 rounded flex items-center justify-between mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
          <input 
            type="text" 
            placeholder="Filter by template name or ID..." 
            className="pl-10 pr-4 py-2 border border-outline-variant rounded bg-surface-container-lowest text-body-sm w-96 focus:ring-1 focus:ring-primary outline-none"
          />
        </div>
        <div className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant flex items-center">
          <span className="w-2 h-2 rounded-full bg-primary mr-2"></span>
          Version Control: Enabled
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-surface-container-low border-b border-outline-variant">
            <tr className="text-[10px] text-outline font-black uppercase tracking-wider">
              <th className="px-6 py-3">Annexure Name</th>
              <th className="px-6 py-3">Revision</th>
              <th className="px-6 py-3">Mapped Units</th>
              <th className="px-6 py-3">Audit Date</th>
              <th className="px-6 py-3">State</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {LIVE_ANNEXURES.map((item) => (
              <tr key={item.id} className="hover:bg-surface-container-low transition-colors">
                <td className="px-6 py-4 text-body-sm font-bold text-on-surface">{item.name}</td>
                <td className="px-6 py-4 font-mono text-[11px] text-primary font-black uppercase tracking-tighter">{item.version}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {item.departments.map(d => (
                      <span key={d} className="bg-surface-container text-outline px-1.5 py-0.5 rounded text-[9px] font-black uppercase">{d}</span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 text-body-sm text-outline italic">{item.lastUpdated}</td>
                <td className="px-6 py-4">
                  <StatusBadge 
                    status={item.status} 
                    type={item.status === 'Active' ? 'success' : item.status === 'Draft' ? 'warning' : 'default'} 
                  />
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end space-x-3">
                    <button className="text-primary hover:underline text-[12px] font-bold">Edit Variant</button>
                    <button className="text-outline hover:text-on-surface"><MoreVertical className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {LIVE_ANNEXURES.length === 0 && (
          <div className="p-8 text-center border-t border-outline-variant">
            <p className="text-headline-sm font-black text-on-surface">No live annexure records available</p>
            <p className="text-body-sm text-on-surface-variant mt-2">
              Annexure data will be loaded from the backend document-control service when enabled.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
