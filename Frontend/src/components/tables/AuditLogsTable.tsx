import React from 'react';
import { AuditLog } from '../../types/app.types';

export const AuditLogsTable: React.FC<{ logs: AuditLog[] }> = ({ logs }) => {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded shadow-sm overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-surface-container-low border-b border-outline-variant">
          <tr className="text-[10px] text-outline font-black uppercase tracking-wider">
            <th className="px-4 py-3">Timestamp</th>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Module</th>
            <th className="px-4 py-3">Action</th>
            <th className="px-4 py-3">Change Detail</th>
            <th className="px-4 py-3 text-right">IP Address</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-surface-container-low transition-colors">
              <td className="px-4 py-3 text-body-sm font-mono text-outline">{log.timestamp}</td>
              <td className="px-4 py-3 text-body-sm font-bold text-on-surface">{log.user}</td>
              <td className="px-4 py-3 text-[11px] font-black uppercase text-on-surface-variant tracking-wider">{log.module}</td>
              <td className="px-4 py-3 text-body-sm text-on-surface">{log.action}</td>
              <td className="px-4 py-3 text-[11px] text-on-surface-variant">
                {log.oldValue && <span className="line-through opacity-50 mr-2">{log.oldValue}</span>}
                <span className="text-primary font-bold">{log.newValue}</span>
              </td>
              <td className="px-4 py-3 text-right text-[11px] font-mono text-outline">{log.ipAddress}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
