import React from 'react';
import { PageTitle, StatusBadge } from '../../components/shared/UIItems';
import { Shield, Check, X, Save } from 'lucide-react';

export const RolesPermissionsPage: React.FC = () => {
  const modules = [
    { id: 'pssr', name: 'PSSR Management', permissions: ['Create', 'Read', 'Approve', 'Override'] },
    { id: 'annex', name: 'Annexures & Templates', permissions: ['Upload', 'Read', 'Delete', 'Version'] },
    { id: 'dept', name: 'Department Configuration', permissions: ['Edit', 'Read', 'Visibility'] },
    { id: 'audit', name: 'Audit Access', permissions: ['Read', 'Export', 'Clear'] },
  ];

  const roles = ['Admin', 'Team Member', 'Area Owner'];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-start">
        <PageTitle 
          title="RBAC Policy Engine" 
          subtitle="Configure Role-Based Access Control matrix and module-level permissions."
          breadcrumbs={['Infra', 'Security', 'Roles']} 
        />
        <button className="bg-primary hover:bg-primary-container text-on-primary font-black text-label-md px-6 py-2 rounded flex items-center shadow-md transition-all">
          <Save className="mr-2 w-4 h-4" />
          Commit Security Changes
        </button>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low border-b border-outline-variant">
              <th className="px-6 py-4 text-label-sm font-black uppercase text-outline w-1/4">Module & Function</th>
              {roles.map(role => (
                <th key={role} className="px-6 py-4 text-center">
                  <span className="text-label-sm font-black uppercase text-primary tracking-widest">{role}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {modules.map(module => (
              <React.Fragment key={module.id}>
                <tr className="bg-surface-container/50">
                  <td colSpan={roles.length + 1} className="px-6 py-2 border-y border-outline-variant/30">
                    <div className="flex items-center space-x-2">
                      <Shield className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[11px] font-black uppercase text-on-surface tracking-widest">{module.name}</span>
                    </div>
                  </td>
                </tr>
                {module.permissions.map(perm => (
                  <tr key={perm} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-8 py-3 text-body-sm text-on-surface-variant font-medium">{perm}</td>
                    {roles.map(role => {
                      const hasAccess = getPolicyAccess(role, module.id, perm);
                      return (
                        <td key={role} className="px-6 py-3 text-center">
                          <div className="flex justify-center">
                            <button className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
                              hasAccess 
                                ? 'bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20' 
                                : 'bg-on-surface/5 text-outline border border-outline-variant/30 hover:bg-on-surface/10 grayscale'
                            }`}>
                              {hasAccess ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 bg-surface-container-low border border-outline-variant rounded flex items-center space-x-4">
        <div className="p-2 bg-on-surface/5 rounded">
          <Shield className="w-5 h-5 text-outline" />
        </div>
        <div>
          <p className="text-[11px] font-black uppercase text-on-surface tracking-widest">Global Policy Indicator</p>
          <p className="text-[10px] text-on-surface-variant max-w-2xl leading-relaxed">
            All permission changes are subject to multi-part approval. Once committed, policies propagate across the refinery network within 180 seconds. Inactive roles will automatically lose inherited permissions.
          </p>
        </div>
      </div>
    </div>
  );
};

function getPolicyAccess(role: string, moduleId: string, permission: string): boolean {
  /**
   * Deterministic policy projection for the current RBAC model.
   *
   * PSSR initiator is intentionally absent here because it is a user capability
   * state for TEAM_MEMBER users, not a permanent role in the identity model.
   */
  if (role === 'Admin') return true;
  if (role === 'Area Owner') return ['Read', 'Approve', 'Export'].includes(permission);
  if (role === 'Team Member') {
    return moduleId === 'pssr' && ['Create', 'Read'].includes(permission);
  }
  return false;
}
