import React from 'react';
import { User } from '../../types/app.types';
import { StatusBadge } from '../shared/UIItems';
import { MoreVertical, Edit2, UserMinus } from 'lucide-react';

export const UsersTable: React.FC<{ users: User[] }> = ({ users }) => {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded shadow-sm overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-surface-container-low border-b border-outline-variant">
          <tr className="text-[10px] text-outline font-black uppercase tracking-wider">
            <th className="px-4 py-3">Employee</th>
            <th className="px-4 py-3">Department</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Last Login</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-surface-container-low transition-colors group">
              <td className="px-4 py-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-xs uppercase">
                    {user.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="text-body-md font-bold text-on-surface leading-tight">{user.name}</p>
                    <p className="text-[11px] text-on-surface-variant font-mono">{user.employeeId}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-4 text-body-sm text-on-surface-variant">{user.department}</td>
              <td className="px-4 py-4"><StatusBadge status={user.role} /></td>
              <td className="px-4 py-4">
                <StatusBadge 
                  status={user.status} 
                  type={user.status === 'Active' ? 'success' : 'default'} 
                />
              </td>
              <td className="px-4 py-4 text-body-sm text-on-surface-variant opacity-60 italic">{user.lastLogin}</td>
              <td className="px-4 py-4 text-right">
                <div className="flex items-center justify-end space-x-2">
                  <button className="p-1 hover:bg-surface-container rounded text-primary transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button className="p-1 hover:bg-surface-container rounded text-error transition-colors"><UserMinus className="w-3.5 h-3.5" /></button>
                  <button className="p-1 hover:bg-surface-container rounded transition-colors"><MoreVertical className="w-3.5 h-3.5 text-outline" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
