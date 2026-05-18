import React from 'react';
import { PageTitle } from '../../components/shared/UIItems';
import { UsersTable } from '../../components/tables/UsersTable';
import { MOCK_USERS } from '../../constants/mockData';
import { Plus, Search, Filter } from 'lucide-react';

export const UsersPage: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-start">
        <PageTitle 
          title="User Directory" 
          subtitle="Manage refinery personnel access, roles, and department assignments."
          breadcrumbs={['System', 'Administration', 'Users']} 
        />
        <button className="bg-primary hover:bg-primary-container text-on-primary font-black text-label-md px-4 py-2 rounded flex items-center shadow-md transition-all active:scale-95">
          <Plus className="mr-2 w-4 h-4" />
          Add Access Control Record
        </button>
      </div>

      <div className="bg-surface border border-outline-variant p-3 rounded flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
            <input 
              type="text" 
              placeholder="Filter by name, ID or email..." 
              className="pl-10 pr-4 py-2 border border-outline-variant rounded bg-surface-container-lowest text-body-sm w-96 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            />
          </div>
          <button className="flex items-center px-4 py-2 bg-surface-container-low border border-outline-variant text-label-md font-bold text-on-surface-variant hover:bg-surface-container transition-colors rounded">
            <Filter className="mr-2 w-4 h-4" />
            Department: All
          </button>
        </div>
        <div className="text-label-sm text-outline font-bold uppercase tracking-widest">
          {MOCK_USERS.length} ACTIVE DIRECTORY RECORDS
        </div>
      </div>

      <UsersTable users={MOCK_USERS} />
    </div>
  );
};
