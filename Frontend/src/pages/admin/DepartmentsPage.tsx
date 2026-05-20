import React from 'react';
import { PageTitle, StatusBadge } from '../../components/shared/UIItems';
import { Plus, Search, MoreVertical, Edit2 } from 'lucide-react';
import type { Department } from '../../types/app.types';

const LIVE_DEPARTMENTS: Department[] = [];

export const DepartmentsPage: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-start">
        <PageTitle 
          title="Refinery Structure" 
          subtitle="Define unit mapping, operational zones, and department-level PSSR logic."
          breadcrumbs={['Operations', 'Site Mapping', 'Departments']} 
        />
        <button className="bg-primary hover:bg-primary-container text-on-primary font-black text-label-md px-4 py-2 rounded flex items-center shadow-md transition-all">
          <Plus className="mr-2 w-4 h-4" />
          Map New Unit
        </button>
      </div>

      <div className="bg-surface border border-outline-variant p-3 rounded flex items-center justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
          <input 
            type="text" 
            placeholder="Search departments..." 
            className="pl-10 pr-4 py-2 border border-outline-variant rounded bg-surface-container-lowest text-body-sm w-96 outline-none focus:border-primary transition-all"
          />
        </div>
        <div className="flex items-center space-x-1">
          <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
          <span className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">Global Sync Active</span>
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-surface-container-low border-b border-outline-variant">
            <tr className="text-[10px] text-outline font-black uppercase tracking-wider">
              <th className="px-6 py-3">Unit Name</th>
              <th className="px-6 py-3">System Code</th>
              <th className="px-6 py-3 text-center">Personnel</th>
              <th className="px-6 py-3">Annexures Mapping</th>
              <th className="px-6 py-3">Visibility</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {LIVE_DEPARTMENTS.map((dept) => (
              <tr key={dept.id} className="hover:bg-surface-container-low transition-colors">
                <td className="px-6 py-4 text-body-md font-bold text-on-surface uppercase">{dept.name}</td>
                <td className="px-6 py-4 text-body-sm font-mono text-primary font-bold">{dept.code}</td>
                <td className="px-6 py-4 text-body-sm text-center font-bold text-on-surface-variant">{dept.members}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {dept.annexures.map(a => (
                      <span key={a} className="bg-secondary-container text-on-secondary-container px-1 rounded text-[9px] font-black">{a}</span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <StatusBadge 
                    status={dept.visibility} 
                    type={dept.visibility === 'Global' ? 'success' : 'warning'} 
                  />
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end space-x-3">
                    <button className="text-primary hover:text-primary-container"><Edit2 className="w-4 h-4" /></button>
                    <button className="text-outline hover:text-on-surface"><MoreVertical className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {LIVE_DEPARTMENTS.length === 0 && (
          <div className="p-8 text-center border-t border-outline-variant">
            <p className="text-headline-sm font-black text-on-surface">No live department records available</p>
            <p className="text-body-sm text-on-surface-variant mt-2">
              Department records will be loaded from backend refinery structure APIs when enabled.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
