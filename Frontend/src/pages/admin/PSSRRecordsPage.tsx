import React from 'react';
import { PageTitle, StatusBadge } from '../../components/shared/UIItems';
import { Plus, Download, Filter, MoreVertical, Eye, FileText } from 'lucide-react';
import type { PSSRRecord } from '../../types/app.types';

const LIVE_PSSR_RECORDS: PSSRRecord[] = [];

export const PSSRRecordsPage: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-start">
        <PageTitle 
          title="PSSR Records Repository" 
          subtitle="Archive and active tracking of all Pre-Commissioning Safety Reviews."
          breadcrumbs={['Safety', 'Compliance', 'PSSR Records']} 
        />
        <div className="flex space-x-2">
          <button className="bg-surface-container-lowest border border-outline-variant hover:bg-surface-container text-on-surface font-black text-label-md px-4 py-2 rounded flex items-center transition-all">
            <Download className="mr-2 w-4 h-4" />
            Export Archive
          </button>
          <button className="bg-primary hover:bg-primary-container text-on-primary font-black text-label-md px-4 py-2 rounded flex items-center shadow-md transition-all active:scale-95">
            <Plus className="mr-2 w-4 h-4" />
            Initiate PSSR Workflow
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Records', value: '1,248' },
          { label: 'Awaiting Initiation', value: '12' },
          { label: 'Critical Overdue', value: '3', color: 'text-error' },
          { label: 'Compliance Index', value: '98.2%' },
        ].map(stat => (
          <div key={stat.label} className="bg-surface-container-low border border-outline-variant p-4 rounded text-center">
            <p className="text-[10px] text-outline font-black uppercase tracking-widest">{stat.label}</p>
            <p className={`text-2xl font-black ${stat.color || 'text-on-surface'}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded shadow-sm overflow-hidden">
        <div className="p-4 border-b border-outline-variant bg-surface flex justify-between items-center">
          <div className="flex items-center space-x-2">
             <button className="px-4 py-2 bg-primary/10 text-primary rounded text-label-md font-black uppercase tracking-wider border border-primary/20">Active Trials</button>
             <button className="px-4 py-2 text-outline rounded text-label-md font-black uppercase tracking-wider hover:bg-surface-container transition-colors">History</button>
          </div>
          <button className="p-2 border border-outline-variant rounded hover:bg-surface-container"><Filter className="w-4 h-4 text-outline" /></button>
        </div>

        <table className="w-full text-left">
          <thead className="bg-surface-container-low border-b border-outline-variant">
            <tr className="text-[10px] text-outline font-black uppercase tracking-wider">
              <th className="px-4 py-3">PSSR ID</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Initiator</th>
              <th className="px-4 py-3">Workfow Stage</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Deadline</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {LIVE_PSSR_RECORDS.map((record) => (
              <tr key={record.id} className="hover:bg-surface-container-low transition-colors">
                <td className="px-4 py-4 text-body-sm font-black text-primary font-mono">{record.id}</td>
                <td className="px-4 py-4 text-body-sm font-bold text-on-surface">{record.unit}</td>
                <td className="px-4 py-4 text-body-sm text-on-surface-variant italic">{record.initiator}</td>
                <td className="px-4 py-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                    <span className="text-[11px] font-bold text-on-surface uppercase">{record.stage}</span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <StatusBadge 
                    status={record.status} 
                    type={record.status === 'Approved' ? 'success' : 'warning'} 
                  />
                </td>
                <td className="px-4 py-4 text-body-sm font-mono text-outline">{record.dueDate}</td>
                <td className="px-4 py-4 text-right">
                  <div className="flex items-center justify-end space-x-2">
                    <button className="p-1 hover:bg-surface-container rounded text-primary" title="View Detail"><Eye className="w-4 h-4" /></button>
                    <button className="p-1 hover:bg-surface-container rounded text-outline" title="View Docs"><FileText className="w-4 h-4" /></button>
                    <button className="p-1 hover:bg-surface-container rounded text-outline"><MoreVertical className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {LIVE_PSSR_RECORDS.length === 0 && (
          <div className="p-8 text-center border-t border-outline-variant">
            <p className="text-headline-sm font-black text-on-surface">No live PSSR records available</p>
            <p className="text-body-sm text-on-surface-variant mt-2">
              Workflow records will populate from the backend PSSR module when commissioning workflows are enabled.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
