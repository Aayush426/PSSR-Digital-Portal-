import React from 'react';
import { PageTitle } from '../../components/shared/UIItems';
import { AuditLogsTable } from '../../components/tables/AuditLogsTable';
import { MOCK_AUDIT_LOGS } from '../../constants/mockData';
import { Search, Download, Calendar } from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-start">
        <PageTitle 
          title="Audit Immutable Trail" 
          subtitle="Comprehensive, read-only sequence of all administrative and operational actions."
          breadcrumbs={['Compliance', 'Audit Logs']} 
        />
        <button className="bg-surface-container-lowest border border-outline-variant hover:bg-surface-container text-on-surface font-black text-label-md px-4 py-2 rounded flex items-center transition-all">
          <Download className="mr-2 w-4 h-4" />
          Export XML Trail
        </button>
      </div>

      <div className="bg-surface border border-outline-variant p-4 rounded grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-4">
        <div>
          <label className="text-[10px] font-black uppercase text-outline mb-1 block tracking-widest">Scan Range</label>
          <div className="relative">
            <input className="w-full bg-surface-container-lowest border border-outline-variant rounded px-3 py-1.5 text-body-sm outline-none" defaultValue="Nov 01 - Nov 15, 2023" />
            <Calendar className="absolute right-2 top-1.5 w-4 h-4 text-outline" />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-black uppercase text-outline mb-1 block tracking-widest">Logic Module</label>
          <select className="w-full bg-surface-container-lowest border border-outline-variant rounded px-3 py-2 text-body-sm outline-none">
            <option>All Operations</option>
            <option>PSSR Engine</option>
            <option>RBAC Management</option>
            <option>Document Versioning</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-black uppercase text-outline mb-1 block tracking-widest">Search Log</label>
          <div className="relative">
            <input className="w-full bg-surface-container-lowest border border-outline-variant rounded px-3 py-1.5 text-body-sm outline-none" placeholder="Search actor or IP..." />
            <Search className="absolute right-2 top-1.5 w-4 h-4 text-outline" />
          </div>
        </div>
        <button className="bg-primary text-on-primary font-bold text-label-md py-2 rounded hover:bg-primary-container transition-colors shadow-sm">
          Execute Filter
        </button>
      </div>

      <div className="p-4 bg-tertiary/10 border-l-4 border-tertiary flex items-start space-x-3 mb-6">
        <div className="w-5 h-5 bg-tertiary text-on-tertiary rounded-full flex items-center justify-center shrink-0 text-[10px] font-black">!</div>
        <p className="text-[11px] text-tertiary font-bold uppercase tracking-wider leading-relaxed">
          SECURITY PROTOCOL NOTICE: THIS LOG IS CRYPTOGRAPHICALLY SIGNED AND CANNOT BE ALTERED. ANY ATTEMPT TO TAMPER WITH SYSTEM CLOCKS WILL TRIGGER AN IMMEDIATE GLOBAL LOCKDOWN.
        </p>
      </div>

      <AuditLogsTable logs={MOCK_AUDIT_LOGS} />
    </div>
  );
};
