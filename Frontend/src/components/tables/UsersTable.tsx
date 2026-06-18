import React, { useMemo } from 'react';
import { List, type RowComponentProps } from 'react-window';
import { MoreVertical, Edit2, UserMinus } from 'lucide-react';
import type { AdminUser } from '../../services/api';
import { StatusBadge } from '../shared/UIItems';

interface UsersTableProps {
  users: AdminUser[];
}

interface UserRowProps {
  users: AdminUser[];
}

const columns =
  'minmax(260px,1.4fr) minmax(240px,1.2fr) minmax(150px,.8fr) minmax(120px,.7fr) minmax(110px,.6fr) minmax(160px,.8fr) 110px';

/**
 * Virtualized PostgreSQL-backed user directory table.
 *
 * Even with server-side pagination, enterprise screens should avoid rendering
 * more DOM nodes than the operator can see. `react-window` keeps only visible
 * rows mounted, protecting the portal when page sizes grow or future columns
 * add richer controls.
 */
export const UsersTable: React.FC<UsersTableProps> = ({ users }) => {
  const rowProps = useMemo(() => ({ users }), [users]);

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[1150px]">
          <div
            className="grid bg-surface-container-low border-b border-outline-variant text-[10px] text-outline font-black uppercase tracking-wider"
            style={{ gridTemplateColumns: columns }}
          >
            {['Employee', 'Email', 'Department', 'Role', 'Status', 'Last Login', 'Actions'].map((label) => (
              <div key={label} className="px-4 py-3 last:text-right">
                {label}
              </div>
            ))}
          </div>

          <List
            rowComponent={UserRow}
            rowCount={users.length}
            rowHeight={72}
            rowProps={rowProps}
            defaultHeight={Math.min(520, Math.max(72, users.length * 72))}
            overscanCount={6}
            className="divide-y divide-outline-variant"
            style={{ height: Math.min(520, Math.max(72, users.length * 72)) }}
          />
        </div>
      </div>
    </div>
  );
};

function UserRow({
  index,
  style,
  users,
  ariaAttributes,
}: RowComponentProps<UserRowProps>): React.ReactElement | null {
  const user = users[index];
  if (!user) return null;

  return (
    <div
      {...ariaAttributes}
      style={{ ...style, gridTemplateColumns: columns }}
      className="grid items-center hover:bg-surface-container-low transition-colors group border-b border-outline-variant"
    >
      <div className="px-4 py-3 min-w-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-xs uppercase shrink-0">
            {getInitials(user.full_name)}
          </div>
          <div className="min-w-0">
            <p className="text-body-md font-bold text-on-surface leading-tight truncate">
              {user.full_name}
            </p>
            <p className="text-[11px] text-on-surface-variant font-mono truncate">
              {user.employee_id}
            </p>
          </div>
        </div>
      </div>
      <div className="px-4 py-3 text-body-sm text-on-surface-variant truncate">{user.email}</div>
      <div className="px-4 py-3 text-body-sm text-on-surface-variant truncate">{user.department}</div>
      <div className="px-4 py-3"><StatusBadge status={formatRole(user.role)} /></div>
      <div className="px-4 py-3">
        <StatusBadge status={user.active ? 'Active' : 'Inactive'} type={user.active ? 'success' : 'default'} />
      </div>
      <div className="px-4 py-3 text-body-sm text-on-surface-variant opacity-70 truncate">
        {formatLastLogin(user.last_login_at)}
      </div>
      <div className="px-4 py-3 text-right">
        <div className="flex items-center justify-end space-x-2">
          <button className="p-1 hover:bg-surface-container rounded text-primary transition-colors" title="Edit user access">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button className="p-1 hover:bg-surface-container rounded text-error transition-colors" title="Deactivate user">
            <UserMinus className="w-3.5 h-3.5" />
          </button>
          <button className="p-1 hover:bg-surface-container rounded transition-colors" title="More actions">
            <MoreVertical className="w-3.5 h-3.5 text-outline" />
          </button>
        </div>
      </div>
    </div>
  );
}

function getInitials(fullName: string): string {
  /** Keep avatars deterministic without storing profile images in the directory. */
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function formatRole(role: AdminUser['role']): string {
  /** Convert backend role constants to concise enterprise display labels. */
  return role.replace('_', ' ');
}

function formatLastLogin(lastLogin?: string | null): string {
  /** Present null login timestamps clearly for newly seeded or inactive users. */
  if (!lastLogin) return 'Never';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(lastLogin));
}
