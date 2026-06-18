import React, { useEffect, useState } from 'react';
import { AlertTriangle, BadgeCheck, CheckCircle2, ChevronLeft, ChevronRight, Eye, History, MoreVertical, Search, ShieldOff } from 'lucide-react';

import { PageTitle } from '../../components/shared/UIItems';
import { useAdminUsers } from '../../hooks/useAdminUsers';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useDepartments } from '../../hooks/useDepartments';
import { useDisableInitiator, useEnableInitiator, usePSSRInitiators } from '../../hooks/usePSSRInitiators';
import type { AdminUser, Role } from '../../services/api';

export const PSSRInitiatorManagementPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [initiator, setInitiator] = useState<'true' | 'false' | ''>('');
  const [role, setRole] = useState<Role | ''>('TEAM_MEMBER');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [openMenuUserId, setOpenMenuUserId] = useState<number | null>(null);
  const [confirmUser, setConfirmUser] = useState<AdminUser | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  const departmentsQuery = useDepartments({ limit: 100, active: true });
  const usersQuery = useAdminUsers({
    page,
    limit: rowsPerPage,
    search: debouncedSearch,
    department: department || undefined,
    role: role || undefined,
    active: true,
    initiator: initiator === '' ? undefined : initiator === 'true',
  });
  const initiatorsQuery = usePSSRInitiators({ active: true, page: 1, limit: 1, department: department || undefined });
  const enableMutation = useEnableInitiator();
  const disableMutation = useDisableInitiator();

  const users = usersQuery.data?.records ?? [];
  const departments = departmentsQuery.data?.records ?? [];
  const pagination = usersQuery.data?.pagination;
  const totalRecords = pagination?.total_records ?? 0;
  const totalPages = pagination?.total_pages || 1;
  const firstRecord = totalRecords === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const lastRecord = totalRecords === 0 ? 0 : Math.min(page * rowsPerPage, totalRecords);
  const activeInitiatorTotal = initiatorsQuery.data?.pagination.total_records ?? 0;
  const busy = enableMutation.isPending || disableMutation.isPending;

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, department, initiator, role, rowsPerPage]);

  const toggleAccess = (user: AdminUser) => {
    if (user.is_pssr_initiator) {
      disableMutation.mutate({ userId: user.id, reason: 'Admin disabled PSSR initiator capability.' });
      return;
    }
    enableMutation.mutate({ userId: user.id, reason: 'Admin granted PSSR initiator capability.' });
  };
  const requestToggle = (user: AdminUser) => setConfirmUser(user);

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 animate-in fade-in duration-500">
      <PageTitle
        title="PSSR Initiator Access"
        subtitle="Grant TEAM_MEMBER users the capability to create new PSSR workflows without changing their permanent role."
        breadcrumbs={['Admin Center', 'Access Governance', 'PSSR Initiators']}
      />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Metric label="Active Initiators" value={activeInitiatorTotal} />
        <Metric label="Total Personnel" value={totalRecords} />
        <Metric label="Departments" value={departments.length} />
        <Metric label="Permission Model" value="RBAC" compact />
      </section>

      <div className="sticky top-0 z-20 bg-surface/95 backdrop-blur border border-outline-variant rounded p-2 shadow-sm">
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(280px,1fr)_190px_170px_150px_140px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search TEAM_MEMBER by name, employee ID, or email"
              className="h-9 w-full pl-10 pr-3 border border-outline-variant rounded bg-surface-container-lowest text-body-sm outline-none focus:border-primary"
            />
          </div>
          <select
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            className="h-9 w-full px-2 border border-outline-variant rounded bg-surface-container-lowest text-body-sm outline-none focus:border-primary"
          >
            <option value="">All departments</option>
            {departments.map((item) => (
              <option key={item.id} value={item.name}>{item.name}</option>
            ))}
          </select>
          <select
            value={initiator}
            onChange={(event) => setInitiator(event.target.value as typeof initiator)}
            className="h-9 w-full px-2 border border-outline-variant rounded bg-surface-container-lowest text-body-sm outline-none focus:border-primary"
          >
            <option value="">All access states</option>
            <option value="true">Initiator enabled</option>
            <option value="false">Not enabled</option>
          </select>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as Role | '')}
            className="h-9 w-full px-2 border border-outline-variant rounded bg-surface-container-lowest text-body-sm outline-none focus:border-primary"
          >
            <option value="">All roles</option>
            <option value="TEAM_MEMBER">Team Members</option>
            <option value="AREA_OWNER">Area Owners</option>
            <option value="ADMIN">Admins</option>
          </select>
          <select
            value={rowsPerPage}
            onChange={(event) => setRowsPerPage(Number(event.target.value))}
            className="h-9 w-full px-2 border border-outline-variant rounded bg-surface-container-lowest text-body-sm outline-none focus:border-primary"
          >
            {[25, 50, 100].map((size) => <option key={size} value={size}>{size} rows</option>)}
          </select>
        </div>
      </div>

      {(usersQuery.error || initiatorsQuery.error) && (
        <ErrorPanel message={usersQuery.error?.message || initiatorsQuery.error?.message || 'Unable to load initiator access.'} />
      )}

      <section className="bg-surface-container-lowest border border-outline-variant rounded shadow-sm overflow-hidden">
        <div className="px-3 py-2 border-b border-outline-variant flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-body-md font-black text-on-surface">Personnel Access</h2>
            <p className="text-label-sm font-semibold text-on-surface-variant">Showing {firstRecord}-{lastRecord} of {totalRecords} active personnel</p>
          </div>
          {(usersQuery.isFetching || initiatorsQuery.isFetching) && <span className="text-label-sm font-black text-primary uppercase">Refreshing</span>}
        </div>

        {usersQuery.isLoading ? <RowsLoading /> : (
          <div className="divide-y divide-outline-variant">
            {users.map((user) => (
              <PersonnelAccessRow
                key={user.id}
                user={user}
                busy={busy}
                menuOpen={openMenuUserId === user.id}
                onToggleMenu={() => setOpenMenuUserId(openMenuUserId === user.id ? null : user.id)}
                onCloseMenu={() => setOpenMenuUserId(null)}
                onToggleAccess={() => requestToggle(user)}
              />
            ))}
            {users.length === 0 && <EmptyPanel message="No personnel match the current filters." />}
          </div>
        )}
        <div className="px-3 py-2 border-t border-outline-variant bg-surface flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-label-sm font-semibold text-on-surface-variant">Showing {firstRecord}-{lastRecord} of {totalRecords}</p>
          <div className="flex flex-wrap items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="h-9 px-3 border border-outline-variant rounded text-label-sm font-bold disabled:opacity-40 inline-flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <select value={page} onChange={(event) => setPage(Number(event.target.value))} className="h-9 rounded border border-outline-variant bg-surface-container-lowest px-2 text-label-sm font-bold outline-none focus:border-primary">
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                <option key={pageNumber} value={pageNumber}>Page {pageNumber}</option>
              ))}
            </select>
            <span className="text-label-sm font-bold text-on-surface-variant">of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="h-9 px-3 border border-outline-variant rounded text-label-sm font-bold disabled:opacity-40 inline-flex items-center gap-1">
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
      {confirmUser && (
        <ConfirmAccessDialog
          user={confirmUser}
          busy={busy}
          onClose={() => setConfirmUser(null)}
          onConfirm={() => {
            toggleAccess(confirmUser);
            setConfirmUser(null);
          }}
        />
      )}
    </div>
  );
};

const Metric: React.FC<{ label: string; value: number | string; compact?: boolean }> = ({ label, value, compact }) => (
  <div className="bg-surface-container-lowest border border-outline-variant rounded px-3 py-2 shadow-sm">
    <p className="text-[10px] font-black text-outline uppercase">{label}</p>
    <p className={`${compact ? 'text-lg' : 'text-2xl'} font-black text-on-surface mt-0.5`}>{value}</p>
  </div>
);

const AccessBadge: React.FC<{ enabled?: boolean }> = ({ enabled }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-black uppercase whitespace-nowrap ${enabled ? 'bg-primary/10 text-primary border-primary/20' : 'bg-surface-container text-on-surface-variant border-outline-variant'}`}>
    {enabled ? <BadgeCheck className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
    {enabled ? 'Initiator Enabled' : 'Standard'}
  </span>
);

const PersonnelAccessRow: React.FC<{
  user: AdminUser;
  busy: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onToggleAccess: () => void;
}> = ({ user, busy, menuOpen, onToggleMenu, onCloseMenu, onToggleAccess }) => {
  const enabled = user.is_pssr_initiator;
  const canToggle = user.role === 'TEAM_MEMBER';
  return (
    <section className="relative grid gap-3 px-3 py-2.5 hover:bg-surface-container-low lg:grid-cols-[minmax(280px,1.15fr)_minmax(280px,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <p className="truncate text-body-sm font-black text-on-surface">{user.full_name}</p>
        <p className="mt-0.5 truncate text-[11px] font-semibold text-on-surface-variant">{user.employee_id} | {user.email}</p>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-1 sm:grid-cols-2 sm:items-center">
        <p className="truncate text-body-sm font-semibold text-on-surface-variant">{user.department || 'Not assigned'}</p>
        <p className="truncate text-body-sm text-on-surface-variant">{user.designation || 'Team Member'}</p>
      </div>
      <div className="flex items-center justify-start gap-2 lg:justify-end">
        <AccessBadge enabled={enabled} />
        <button onClick={onToggleMenu} className="h-8 w-8 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-container inline-flex items-center justify-center" aria-label={`Actions for ${user.full_name}`}>
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>
      {menuOpen && (
        <div className="absolute right-3 top-11 z-30 w-52 rounded border border-outline-variant bg-surface-container-lowest py-1 shadow-xl">
          <SecondaryMenuItem
            icon={enabled ? ShieldOff : BadgeCheck}
            label={enabled ? 'Disable initiator' : 'Enable initiator'}
            onClick={() => {
              onToggleAccess();
              onCloseMenu();
            }}
            disabled={busy || !canToggle}
            tone={enabled ? 'danger' : 'primary'}
          />
          <SecondaryMenuItem icon={Eye} label="View profile" onClick={onCloseMenu} />
          <SecondaryMenuItem icon={History} label="Audit history" onClick={onCloseMenu} />
        </div>
      )}
    </section>
  );
};

const SecondaryMenuItem: React.FC<{ icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; disabled?: boolean; tone?: 'primary' | 'danger' }> = ({ icon: Icon, label, onClick, disabled, tone }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-label-sm font-bold hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-40 ${tone === 'danger' ? 'text-error' : tone === 'primary' ? 'text-primary' : 'text-on-surface'}`}
  >
    <Icon className="h-4 w-4" />
    {label}
  </button>
);

const ConfirmAccessDialog: React.FC<{ user: AdminUser; busy: boolean; onClose: () => void; onConfirm: () => void }> = ({ user, busy, onClose, onConfirm }) => {
  const enabled = user.is_pssr_initiator;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded border border-outline-variant bg-surface-container-lowest shadow-2xl">
        <div className="border-b border-outline-variant px-5 py-4">
          <h3 className="text-headline-sm font-bold text-on-surface">{enabled ? 'Disable Initiator Access?' : 'Enable Initiator Access?'}</h3>
          <p className="mt-1 text-body-sm text-on-surface-variant">{user.full_name} · {user.employee_id}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-body-sm text-on-surface-variant">
            {enabled ? 'This user will return to standard TEAM_MEMBER access and will no longer be able to create PSSR workflows.' : 'This user will receive the INITIATE_PSSR capability while retaining their TEAM_MEMBER role.'}
          </p>
        </div>
        <div className="flex justify-end gap-3 border-t border-outline-variant px-5 py-4">
          <button onClick={onClose} className="rounded border border-outline-variant px-4 py-2 text-label-md font-bold">Cancel</button>
          <button disabled={busy} onClick={onConfirm} className="rounded bg-primary px-4 py-2 text-label-md font-bold text-on-primary disabled:opacity-50">
            {enabled ? 'Disable Access' : 'Enable Access'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ErrorPanel: React.FC<{ message: string }> = ({ message }) => (
  <div className="bg-error/5 border border-error/20 rounded p-4 flex gap-2">
    <AlertTriangle className="w-4 h-4 text-error shrink-0 mt-0.5" />
    <p className="text-body-sm text-error">{message}</p>
  </div>
);

const EmptyPanel: React.FC<{ message: string }> = ({ message }) => (
  <div className="p-8 text-center">
    <p className="text-body-sm font-bold text-on-surface-variant">{message}</p>
  </div>
);

const RowsLoading: React.FC = () => (
  <div className="p-3 space-y-2">
    {[0, 1, 2, 3, 4].map((item) => (
      <div key={item} className="h-12 bg-surface-container-low rounded animate-pulse" />
    ))}
  </div>
);
