import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Archive, Building2, CheckCircle2, ChevronLeft, ChevronRight, Edit2, Eye, GitBranch, History, KeyRound, MapPinned, MoreVertical, Plus, Search, ShieldCheck, ShieldOff, SlidersHorizontal, Trash2, UserCheck, UserX, X } from 'lucide-react';

import { PageTitle, StatusBadge } from '../../components/shared/UIItems';
import {
  ChipMultiSelect,
  FixedSelect,
  MappingSection,
  SearchableSelect,
  SegmentedControl,
  Stepper,
  TileSelector,
  type Option,
} from '@/components/admin/ConfigurationControls';
import {
  LabeledValue,
  MiniMetric,
  SummaryChips,
} from '@/components/admin/DepartmentPrimitives';
import { OperationalLayout, OperationalSidebar, OperationalDetail } from '../../components/layouts/OperationalLayout';
import { HorizontalTabs, TabPanel } from '../../components/layouts/HorizontalTabs';
import { OperationalGrid, MetricCard, InfoPanel, ConfigCard, ProfileGrid } from '../../components/layouts/GridSystem';
import {
  useCreateDepartment,
  useConfigureDepartmentAnnexure,
  useConfigureDepartmentAreaOwner,
  useConfigureDepartmentPermission,
  useConfigureDepartmentUnit,
  useConfigureDepartmentWorkflowResponsibility,
  useDeleteDepartment,
  useDepartmentUsers,
  useDepartments,
  useRemoveDepartmentAnnexure,
  useResetDepartmentUserPermissions,
  useSetDepartmentUserStatus,
  useSoftDeleteDepartmentUser,
  useUpdateDepartment,
  useUpdateDepartmentUser,
} from '../../hooks/useDepartments';
import { useAdminUsers } from '../../hooks/useAdminUsers';
import { useAnnexures } from '../../hooks/useAnnexures';
import { useDisableInitiator, useEnableInitiator } from '../../hooks/usePSSRInitiators';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { api, type AdminUser, type DepartmentAnnexure, type DepartmentAreaOwner, type DepartmentPermissionConfig, type DepartmentUser, type DepartmentWorkflowResponsibility, type OperationalUnit, type RefineryDepartment, type Role, type UpdateUserPayload } from '../../services/api';
import type { AnnexureSummary } from '../../types/annexure.types';

type DetailTab = 'overview' | 'team' | 'annexures' | 'units' | 'workflow' | 'permissions' | 'areaOwners' | 'history';
type ConfirmState = {
  title: string;
  detail: string;
  actionLabel: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
} | null;

const TABS: Array<{ id: DetailTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'team', label: 'Team Members' },
  { id: 'annexures', label: 'Annexures' },
  { id: 'units', label: 'Operational Units' },
  { id: 'workflow', label: 'Workflow' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'areaOwners', label: 'Area Owners' },
  { id: 'history', label: 'History' },
];

const ROLE_OPTIONS: Option[] = [
  { value: 'TEAM_MEMBER', label: 'Department Team Member', helper: 'Checklist execution and evidence readiness' },
  { value: 'AREA_OWNER', label: 'Area Owner', helper: 'Approval authority for assigned process areas' },
  { value: 'ADMIN', label: 'Admin', helper: 'Portal management and department setup' },
];

const USER_ROLE_TILE_OPTIONS: Option[] = [
  { value: 'TEAM_MEMBER', label: 'Department Team Member', helper: 'Checklist execution' },
  { value: 'AREA_OWNER', label: 'Area Owner', helper: 'Approval authority' },
  { value: 'ADMIN', label: 'Admin', helper: 'Portal management' },
];

const WORKFLOW_STAGE_OPTIONS: Option[] = [
  { value: 'PSSR Creation', label: 'PSSR Creation', helper: 'Scope, department applicability, team assignment' },
  { value: 'Checklist Execution', label: 'Checklist Execution', helper: 'Department checklist completion and evidence readiness' },
  { value: 'Punch Point Resolution', label: 'Punch Point Resolution', helper: 'Department punch-point ownership and closure' },
  { value: 'Pending Area Owner Approval', label: 'Area Owner Approval', helper: 'Completed checklist approval and handover acceptance' },
  { value: 'IN_PROGRESS', label: 'Checklist In Progress', helper: 'Default active execution stage for mapped annexures' },
];

const VISIBILITY_SCOPE_OPTIONS: Option[] = [
  { value: 'DEPARTMENT', label: 'Department', helper: 'Visible to this department and admins' },
  { value: 'UNIT', label: 'Unit', helper: 'Visible within mapped operational units' },
  { value: 'GLOBAL', label: 'Global', helper: 'Visible across refinery workflow contexts' },
];

const REQUIREMENT_OPTIONS: Option[] = [
  { value: 'MANDATORY', label: 'Mandatory', helper: 'Required for readiness closure' },
  { value: 'OPTIONAL', label: 'Optional', helper: 'Available when applicable' },
];

const UNIT_VISIBILITY_OPTIONS: Option[] = [
  { value: 'VISIBLE', label: 'Visible' },
  { value: 'RESTRICTED', label: 'Restricted' },
  { value: 'HIDDEN', label: 'Hidden' },
];

const WORKFLOW_SCOPE_OPTIONS: Option[] = [
  { value: 'STANDARD_PSSR', label: 'Standard PSSR', helper: 'Default refinery PSSR routing' },
  { value: 'TURNAROUND', label: 'Turnaround', helper: 'Shutdown or turnaround readiness' },
  { value: 'CAPITAL_PROJECT', label: 'Capital Project', helper: 'Project handover workflow' },
  { value: 'MAINTENANCE', label: 'Maintenance', helper: 'Maintenance-driven readiness scope' },
];

const APPROVAL_SCOPE_OPTIONS: Option[] = [
  { value: 'UNIT', label: 'Unit' },
  { value: 'DEPARTMENT', label: 'Department' },
  { value: 'GLOBAL', label: 'Global' },
];

const PERMISSION_SCOPE_OPTIONS: Option[] = [
  { value: 'DEPARTMENT', label: 'Department' },
  { value: 'UNIT', label: 'Mapped Units' },
  { value: 'GLOBAL', label: 'Global' },
];

const PERMISSION_PRESET_OPTIONS: Option[] = [
  { value: 'CHECKLIST_EXECUTION', label: 'Checklist execution', helper: 'Complete assigned checklist items and upload evidence' },
  { value: 'PUNCH_POINT_CONTROL', label: 'Punch-point control', helper: 'Create and close department punch points' },
  { value: 'PSSR_INITIATION', label: 'PSSR initiation', helper: 'Allow selected team members to start PSSR workflows' },
  { value: 'AREA_APPROVAL', label: 'Area approval', helper: 'Approve completed PSSR evidence for assigned areas' },
];

// Enterprise layout: The detail tabs are now managed with smart horizontal scrolling
// rather than wrapping. This maintains operational context better.

function toUnitOptions(departments: RefineryDepartment[]): Option[] {
  const units = new Map<number, OperationalUnit>();
  departments.forEach((department) => department.operational_units.forEach((unit) => units.set(unit.id, unit)));
  return [...units.values()]
    .sort((first, second) => `${first.zone}${first.name}`.localeCompare(`${second.zone}${second.name}`))
    .map((unit) => ({ value: String(unit.id), label: `${unit.code} · ${unit.name}`, helper: unit.zone, group: unit.zone }));
}

function toAnnexureOptions(annexures: AnnexureSummary[]): Option[] {
  return annexures.map((annexure) => ({
    value: String(annexure.id),
    label: `${annexure.code} · ${annexure.title}`,
    helper: annexure.departments.length ? annexure.departments.join(', ') : `Revision ${annexure.revision}`,
    group: annexure.departments[0] ?? 'General',
  }));
}

function toUserOptions(users: AdminUser[], role?: Role): Option[] {
  return users
    .filter((user) => !role || user.role === role)
    .map((user) => ({
      value: String(user.id),
      label: user.full_name,
      helper: `${user.employee_id} · ${user.role}${user.plant_location ? ` · ${user.plant_location}` : ''}`,
      group: user.role,
    }));
}

function optionLabel(options: Option[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

function defaultAnnexureMapping(annexure: DepartmentAnnexure | AnnexureSummary) {
  return {
    annexure_id: annexure.id,
    requirement_type: 'MANDATORY',
    visibility_scope: 'DEPARTMENT',
    checklist_owner_role: 'TEAM_MEMBER',
    workflow_stage: 'IN_PROGRESS',
    priority: 'priority' in annexure ? annexure.priority : 100,
    active: 'active' in annexure ? annexure.active : true,
  };
}

function permissionPresetToPayload(preset: string): Omit<DepartmentPermissionConfig, 'id'> {
  const presets: Record<string, Omit<DepartmentPermissionConfig, 'id'>> = {
    CHECKLIST_EXECUTION: { capability: 'EDIT_ASSIGNED_CHECKLIST', role: 'TEAM_MEMBER', allowed: true, scope: 'DEPARTMENT', active: true },
    PUNCH_POINT_CONTROL: { capability: 'CREATE_PUNCH_POINT', role: 'TEAM_MEMBER', allowed: true, scope: 'DEPARTMENT', active: true },
    PSSR_INITIATION: { capability: 'CREATE_PSSR', role: 'TEAM_MEMBER', allowed: true, scope: 'DEPARTMENT', active: true },
    AREA_APPROVAL: { capability: 'APPROVE_PSSR', role: 'AREA_OWNER', allowed: true, scope: 'DEPARTMENT', active: true },
  };
  return presets[preset] ?? presets.CHECKLIST_EXECUTION;
}

function capabilityLabel(capability: string): string {
  const labels: Record<string, string> = {
    VIEW_PSSR: 'PSSR visibility',
    EDIT_ASSIGNED_CHECKLIST: 'Checklist execution',
    CREATE_PUNCH_POINT: 'Punch-point creation',
    UPLOAD_EVIDENCE: 'Evidence upload',
    CLOSE_CHECKLIST: 'Checklist closure',
    CREATE_PSSR: 'PSSR initiation',
    APPROVE_PSSR: 'Area approval',
    MANAGE_DEPARTMENT_USERS: 'Department administration',
  };
  return labels[capability] ?? capability.replaceAll('_', ' ').toLowerCase();
}

export const DepartmentsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [setupDepartment, setSetupDepartment] = useState<RefineryDepartment | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const debouncedSearch = useDebouncedValue(search);
  const departmentsQuery = useDepartments({ page: 1, limit: 50, search: debouncedSearch });
  const annexuresQuery = useAnnexures({ page: 1, limit: 100, active: true, archived: false, sortBy: 'number', sortDir: 'asc' });
  const usersQuery = useAdminUsers({ page: 1, limit: 100, active: true });
  const createMutation = useCreateDepartment();
  const updateMutation = useUpdateDepartment();
  const deleteMutation = useDeleteDepartment();
  const departments = departmentsQuery.data?.records ?? [];
  const selectedDepartment = departments.find((item) => item.id === selectedDepartmentId) ?? departments[0] ?? null;
  const setupDepartmentView = setupDepartment ? departments.find((item) => item.id === setupDepartment.id) ?? setupDepartment : null;
  const annexures = annexuresQuery.data?.records ?? [];
  const users = usersQuery.data?.records ?? [];
  const unitOptions = useMemo(() => toUnitOptions(departments), [departments]);
  const annexureOptions = useMemo(() => toAnnexureOptions(annexures), [annexures]);
  const userOptions = useMemo(() => toUserOptions(users), [users]);
  const areaOwnerOptions = useMemo(() => toUserOptions(users, 'AREA_OWNER'), [users]);

  const totals = useMemo(() => ({
    personnel: departments.reduce((sum, item) => sum + item.personnel_count, 0),
    units: new Set(departments.flatMap((item) => item.operational_units.map((unit) => unit.id))).size,
    annexures: departments.reduce((sum, item) => sum + item.annexures.length, 0),
  }), [departments]);

  const selectDepartment = (department: RefineryDepartment) => {
    setSelectedDepartmentId(department.id);
    setActiveTab('overview');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <PageTitle
          title="Refinery Structure"
          subtitle="Department personnel, operational visibility, annexure responsibilities, and workflow access."
          breadcrumbs={['Operations', 'Site Mapping', 'Departments']}
        />
        <button onClick={() => setCreating(true)} className="bg-primary hover:bg-primary-container text-on-primary font-bold text-label-md px-4 py-2 rounded inline-flex items-center justify-center shadow-sm whitespace-nowrap">
          <Plus className="mr-2 w-4 h-4" />
          Create Department
        </button>
      </div>

      {/* Summary Metrics */}
      <OperationalGrid columns={4} gap="md">
        <MetricCard label="Departments" value={departments.length} />
        <MetricCard label="Personnel" value={totals.personnel} />
        <MetricCard label="Operational Units" value={totals.units} />
        <MetricCard label="Annexures" value={totals.annexures} />
      </OperationalGrid>

      {departmentsQuery.error && <ErrorPanel message={departmentsQuery.error.message} />}

      {/* Split-Panel: List + Detail */}
      <OperationalLayout
        sidebar={
          <OperationalSidebar
            header={
              <div className="space-y-3">
                <div>
                  <h2 className="text-headline-sm font-black text-on-surface">Departments</h2>
                  <p className="text-body-sm text-on-surface-variant">{departments.length} refinery departments</p>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search departments"
                    className="w-full pl-10 pr-3 py-2 border border-outline-variant rounded bg-surface text-body-sm outline-none focus:border-primary"
                  />
                </div>
              </div>
            }
            maxHeight="max-h-[calc(100vh-380px)]"
          >
            {departmentsQuery.isLoading ? (
              <LoadingRows compact />
            ) : departments.map((department) => (
              <DepartmentCard
                key={department.id}
                department={department}
                selected={selectedDepartment?.id === department.id}
                onSelect={() => selectDepartment(department)}
              />
            ))}
            {!departmentsQuery.isLoading && departments.length === 0 && <EmptyPanel message="No departments found." />}
          </OperationalSidebar>
        }
        detail={
          selectedDepartment ? (
            <OperationalDetail
              title={
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-black text-on-surface">{selectedDepartment.name}</h2>
                    <StatusBadge status={selectedDepartment.active ? 'Active' : 'Inactive'} type={selectedDepartment.active ? 'success' : 'warning'} />
                  </div>
                  <p className="text-label-md font-mono text-primary mt-1">{selectedDepartment.code}</p>
                  <p className="text-body-sm text-on-surface-variant mt-2 max-w-2xl">{selectedDepartment.description || 'No department description has been recorded.'}</p>
                </div>
              }
              actions={
                <>
                  <button onClick={() => setSetupDepartment(selectedDepartment)} className="px-3 py-2 border border-outline-variant rounded text-label-md font-bold text-primary hover:bg-primary/10 inline-flex items-center gap-2">
                    <Edit2 className="w-4 h-4" />
                    Setup
                  </button>
                  <button
                    disabled={deleteMutation.isPending || !selectedDepartment.active}
                    onClick={() => setConfirmState({
                      title: 'Deactivate Department',
                      detail: `Deactivate ${selectedDepartment.name}? Personnel and audit history will remain preserved.`,
                      actionLabel: 'Deactivate',
                      tone: 'danger',
                      onConfirm: () => deleteMutation.mutate(selectedDepartment.id),
                    })}
                    className="px-3 py-2 border border-error/30 rounded text-label-md font-bold text-error hover:bg-error/10 disabled:opacity-40 inline-flex items-center gap-2"
                  >
                    <Archive className="w-4 h-4" />
                    Deactivate
                  </button>
                </>
              }
              headerDivider
            >
              {/* Smart Horizontal Tabs */}
              <div className="space-y-4">
                <HorizontalTabs
                  tabs={TABS}
                  activeTabId={activeTab}
                  onTabChange={(tabId) => setActiveTab(tabId as DetailTab)}
                  variant="default"
                />

                {/* Tab Content */}
                <div className="space-y-6">
                  <TabPanel isActive={activeTab === 'overview'}>
                    <OverviewTab department={selectedDepartment} />
                  </TabPanel>

                  <TabPanel isActive={activeTab === 'team'}>
                    <TeamMembersTab department={selectedDepartment} onConfirm={setConfirmState} />
                  </TabPanel>

                  <TabPanel isActive={activeTab === 'annexures'}>
                    <AnnexuresTab department={selectedDepartment} annexures={annexures} />
                  </TabPanel>

                  <TabPanel isActive={activeTab === 'units'}>
                    <OperationalUnitsTab department={selectedDepartment} unitOptions={unitOptions} areaOwnerOptions={areaOwnerOptions} />
                  </TabPanel>

                  <TabPanel isActive={activeTab === 'workflow'}>
                    <WorkflowResponsibilitiesTab department={selectedDepartment} />
                  </TabPanel>

                  <TabPanel isActive={activeTab === 'permissions'}>
                    <PermissionsTab department={selectedDepartment} />
                  </TabPanel>

                  <TabPanel isActive={activeTab === 'areaOwners'}>
                    <AreaOwnersTab department={selectedDepartment} users={users} areaOwnerOptions={areaOwnerOptions} />
                  </TabPanel>

                  <TabPanel isActive={activeTab === 'history'}>
                    <ActivityHistoryTab department={selectedDepartment} />
                  </TabPanel>
                </div>
              </div>
            </OperationalDetail>
          ) : (
            <div className="bg-surface-container-lowest border border-outline-variant rounded p-10 text-center">
              <Building2 className="w-10 h-10 mx-auto text-outline mb-3" />
              <p className="text-headline-sm font-black text-on-surface">Select a department</p>
              <p className="text-body-sm text-on-surface-variant mt-1">Department details will appear here.</p>
            </div>
          )
        }
      />

      {creating && (
        <DepartmentDialog
          busy={createMutation.isPending}
          onClose={() => {
            setCreating(false);
          }}
          onSubmit={(payload) => {
            createMutation.mutate(payload, {
              onSuccess: (department) => {
                setCreating(false);
                setSelectedDepartmentId(department.id);
                setActiveTab('overview');
                setSetupDepartment(department);
              },
            });
          }}
        />
      )}

      {setupDepartmentView && (
        <DepartmentSetupWizard
          department={setupDepartmentView}
          departments={departments}
          annexures={annexures}
          users={users}
          unitOptions={unitOptions}
          annexureOptions={annexureOptions}
          userOptions={userOptions}
          areaOwnerOptions={areaOwnerOptions}
          busy={updateMutation.isPending || annexuresQuery.isLoading || usersQuery.isLoading}
          onClose={() => setSetupDepartment(null)}
          onDepartmentUpdated={(department) => {
            setSetupDepartment(department);
            setSelectedDepartmentId(department.id);
          }}
        />
      )}

      {confirmState && <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />}
    </div>
  );
};

const DepartmentCard: React.FC<{ department: RefineryDepartment; selected: boolean; onSelect: () => void }> = ({ department, selected, onSelect }) => (
  <button
    onClick={onSelect}
    className={`w-full text-left rounded border p-4 transition-colors ${selected ? 'border-primary bg-primary/5 shadow-sm' : 'border-outline-variant bg-surface hover:border-primary/40 hover:bg-surface-container-low'}`}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-body-md font-black text-on-surface truncate">{department.name}</p>
        <p className="text-[11px] font-mono text-primary mt-1">{department.code}</p>
      </div>
      <StatusBadge status={department.active ? 'Active' : 'Inactive'} type={department.active ? 'success' : 'warning'} />
    </div>
    <div className="grid grid-cols-3 gap-2 mt-4">
      <MiniMetric label="People" value={department.personnel_count} />
      <MiniMetric label="Units" value={department.operational_units.length} />
      <MiniMetric label="Annex." value={department.annexures.length} />
    </div>
  </button>
);

const OverviewTab: React.FC<{ department: RefineryDepartment }> = ({ department }) => {
  const initiatorsQuery = useDepartmentUsers(department.id, { page: 1, limit: 1, active: true, initiator: true });
  const activeInitiators = initiatorsQuery.data?.pagination.total_records ?? 0;

  return (
    <div className="space-y-6">
      <OperationalGrid columns={4} gap="md">
        <MetricCard label="Personnel" value={department.personnel_count} />
        <MetricCard label="Operational Units" value={department.operational_units.length} />
        <MetricCard label="Annexures" value={department.annexures.length} />
        <MetricCard label="Active Initiators" value={department.initiator_count || activeInitiators} />
        <MetricCard label="Active PSSR" value={department.workflow_impact.active_pssr_count} />
        <MetricCard label="Pending Approvals" value={department.workflow_impact.pending_approvals} />
        <MetricCard label="Punch Points" value={department.workflow_impact.punch_point_count} />
        <MetricCard label="Completion %" value={department.workflow_impact.completion_rate} />
      </OperationalGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <InfoPanel title="Department Metadata">
          <ProfileGrid items={[
            ['Department', department.name],
            ['Code', department.code],
            ['Status', department.active ? 'Active' : 'Inactive'],
            ['Updated', new Date(department.updated_at).toLocaleDateString()],
          ]} />
        </InfoPanel>
        <InfoPanel title="Workload Summary">
          <ProfileGrid items={[
            ['Active initiators', String(department.initiator_count || activeInitiators)],
            ['Area owners', String(department.area_owner_count)],
            ['Annexure responsibilities', `${department.annexures.length} mapped`],
            ['Operational coverage', `${department.operational_units.length} unit(s)`],
            ['Assigned checklist total', String(department.workflow_impact.assigned_checklist_total)],
            ['Department workload', String(department.workflow_impact.department_workload)],
          ]} />
        </InfoPanel>
      </div>

      <InfoPanel title="Recent Workflow Activity">
        <ActivityList rows={department.workflow_impact.recent_workflow_activity} empty="No recent workflow activity recorded." />
      </InfoPanel>
    </div>
  );
};

const TeamMembersTab: React.FC<{ department: RefineryDepartment; onConfirm: (state: ConfirmState) => void }> = ({ department, onConfirm }) => {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [active, setActive] = useState<'true' | 'false' | ''>('');
  const [initiator, setInitiator] = useState<'true' | 'false' | ''>('');
  const [unit, setUnit] = useState('');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [selectedUser, setSelectedUser] = useState<DepartmentUser | null>(null);
  const [editingUser, setEditingUser] = useState<DepartmentUser | null>(null);
  const [openMenuUserId, setOpenMenuUserId] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search);
  const usersQuery = useDepartmentUsers(department.id, {
    page,
    limit: rowsPerPage,
    search: debouncedSearch,
    role: role || undefined,
    active: active === '' ? undefined : active === 'true',
    initiator: initiator === '' ? undefined : initiator === 'true',
    plant_area: unit || undefined,
  });
  const updateUserMutation = useUpdateDepartmentUser();
  const statusMutation = useSetDepartmentUserStatus();
  const softDeleteMutation = useSoftDeleteDepartmentUser();
  const resetPermissionsMutation = useResetDepartmentUserPermissions();
  const enableInitiatorMutation = useEnableInitiator();
  const disableInitiatorMutation = useDisableInitiator();
  const users = usersQuery.data?.records ?? [];
  const pagination = usersQuery.data?.pagination;
  const busy = statusMutation.isPending || softDeleteMutation.isPending || resetPermissionsMutation.isPending || enableInitiatorMutation.isPending || disableInitiatorMutation.isPending;
  const totalRecords = pagination?.total_records ?? 0;
  const firstRecord = totalRecords === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const lastRecord = totalRecords === 0 ? 0 : Math.min(page * rowsPerPage, totalRecords);

  useEffect(() => {
    setPage(1);
  }, [department.id, debouncedSearch, role, active, initiator, unit, rowsPerPage]);

  const closeMenu = () => setOpenMenuUserId(null);

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-outline-variant rounded p-3 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search name, employee ID, or email" className="w-full md:w-90 pl-10 pr-3 py-2 border border-outline-variant rounded bg-surface-container-lowest text-body-sm outline-none focus:border-primary" />
          </div>
          <button onClick={() => setFiltersOpen((current) => !current)} className="px-3 py-2 border border-outline-variant rounded text-label-sm font-bold text-on-surface-variant hover:text-primary inline-flex items-center justify-center gap-2">
            <SlidersHorizontal className="w-4 h-4" />
            Filters
          </button>
          <div className="md:ml-auto flex flex-wrap gap-2 text-[11px] text-on-surface-variant">
            <span className="px-2 py-1 rounded bg-surface-container">Role: {role || 'All'}</span>
            <span className="px-2 py-1 rounded bg-surface-container">Status: {active === '' ? 'All' : active === 'true' ? 'Active' : 'Inactive'}</span>
            <span className="px-2 py-1 rounded bg-surface-container">Initiator: {initiator === '' ? 'All' : initiator === 'true' ? 'Yes' : 'No'}</span>
          </div>
        </div>
        {filtersOpen && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 pt-3 border-t border-outline-variant">
          <Select value={role} onChange={(value) => { setRole(value as Role | ''); setPage(1); }} options={[['', 'All roles'], ['TEAM_MEMBER', 'Team Member'], ['AREA_OWNER', 'Area Owner'], ['ADMIN', 'Admin']]} />
          <Select value={active} onChange={(value) => { setActive(value as typeof active); setPage(1); }} options={[['', 'All status'], ['true', 'Active'], ['false', 'Inactive']]} />
          <Select value={initiator} onChange={(value) => { setInitiator(value as typeof initiator); setPage(1); }} options={[['', 'All initiator'], ['true', 'Initiator'], ['false', 'Standard']]} />
          <Select value={unit} onChange={(value) => { setUnit(value); setPage(1); }} options={[['', 'All units'], ...department.operational_units.map((item) => [item.name, item.name] as [string, string])]} />
        </div>
        )}
      </div>

      {usersQuery.error && <ErrorPanel message={usersQuery.error.message} />}

      <div className="border border-outline-variant rounded bg-surface-container-lowest overflow-visible">
        <div className="max-h-160 overflow-y-auto overflow-x-visible p-3 space-y-3">
          {usersQuery.isLoading ? <LoadingRows compact /> : users.map((user) => (
            <TeamMemberCard
              key={user.id}
              user={user}
              busy={busy}
              menuOpen={openMenuUserId === user.id}
              onToggleMenu={() => setOpenMenuUserId(openMenuUserId === user.id ? null : user.id)}
              onCloseMenu={closeMenu}
              onView={() => setSelectedUser(user)}
              onEdit={() => setEditingUser(user)}
              onStatus={() => onConfirm({
                title: user.active ? 'Disable User' : 'Enable User',
                detail: `${user.active ? 'Disable' : 'Enable'} ${user.full_name}?`,
                actionLabel: user.active ? 'Disable' : 'Enable',
                tone: user.active ? 'danger' : 'primary',
                onConfirm: () => statusMutation.mutate({ userId: user.id, active: !user.active, reason: 'Department personnel management action.' }),
              })}
              onInitiator={() => onConfirm({
                title: user.is_pssr_initiator ? 'Revoke Initiator Access' : 'Grant Initiator Access',
                detail: `${user.is_pssr_initiator ? 'Revoke PSSR initiator access from' : 'Grant PSSR initiator access to'} ${user.full_name}?`,
                actionLabel: user.is_pssr_initiator ? 'Revoke' : 'Grant',
                tone: user.is_pssr_initiator ? 'danger' : 'primary',
                onConfirm: () => user.is_pssr_initiator
                  ? disableInitiatorMutation.mutate({ userId: user.id, reason: 'Revoked from department personnel management.' })
                  : enableInitiatorMutation.mutate({ userId: user.id, reason: 'Granted from department personnel management.' }),
              })}
              onReset={() => onConfirm({
                title: 'Reset User Permissions',
                detail: `Revoke all active capability grants for ${user.full_name}?`,
                actionLabel: 'Reset',
                tone: 'danger',
                onConfirm: () => resetPermissionsMutation.mutate({ userId: user.id, reason: 'Department personnel access reset.' }),
              })}
              onDelete={() => onConfirm({
                title: 'Soft Delete User',
                detail: `Soft delete ${user.full_name}? Historical workflow and audit records will be retained.`,
                actionLabel: 'Soft Delete',
                tone: 'danger',
                onConfirm: () => softDeleteMutation.mutate(user.id),
              })}
            />
          ))}
          {!usersQuery.isLoading && users.length === 0 && <EmptyPanel message="No users match this filter set." />}
        </div>
        <div className="px-4 py-3 border-t border-outline-variant bg-surface flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          <p className="text-body-sm font-semibold text-on-surface-variant">Showing {firstRecord}-{lastRecord} of {totalRecords} personnel</p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label className="flex items-center gap-2 text-label-sm font-bold text-on-surface-variant">
              Rows per page
              <select
                value={rowsPerPage}
                onChange={(event) => setRowsPerPage(Number(event.target.value))}
                className="h-9 rounded border border-outline-variant bg-surface-container-lowest px-2 text-label-sm outline-none focus:border-primary"
              >
                {[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
            <button disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="px-3 py-2 border border-outline-variant rounded text-label-sm font-bold disabled:opacity-40 inline-flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <span className="min-w-24 text-center text-label-sm font-bold text-on-surface-variant">Page {page} of {pagination?.total_pages || 1}</span>
            <button disabled={page >= (pagination?.total_pages || 1)} onClick={() => setPage((current) => current + 1)} className="px-3 py-2 border border-outline-variant rounded text-label-sm font-bold disabled:opacity-40 inline-flex items-center gap-1">
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {selectedUser && <UserDetailDialog user={selectedUser} onClose={() => setSelectedUser(null)} />}
      {editingUser && (
        <UserEditDialog
          user={editingUser}
          busy={updateUserMutation.isPending}
          onClose={() => setEditingUser(null)}
          onSubmit={(payload) => updateUserMutation.mutate({ userId: editingUser.id, payload }, { onSuccess: () => setEditingUser(null) })}
        />
      )}
    </div>
  );
};

const AnnexuresTab: React.FC<{ department: RefineryDepartment; annexures: AnnexureSummary[] }> = ({ department, annexures }) => {
  const [viewing, setViewing] = useState<DepartmentAnnexure | null>(null);
  const [mappingDraft, setMappingDraft] = useState<AnnexureSummary[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [librarySearch, setLibrarySearch] = useState('');
  const [requirementFilter, setRequirementFilter] = useState<'ALL' | 'MANDATORY' | 'OPTIONAL'>('ALL');
  const [stageFilter, setStageFilter] = useState('ALL');
  const [compatibilityFilter, setCompatibilityFilter] = useState<'ALL' | 'COMPATIBLE'>('ALL');
  const configure = useConfigureDepartmentAnnexure();
  const remove = useRemoveDepartmentAnnexure();
  const mappedIds = new Set(department.annexures.map((annexure) => annexure.id));
  const selectedAnnexures = annexures.filter((annexure) => selectedIds.includes(annexure.id));
  const departmentKeys = [department.code, department.name].map((item) => item.toLowerCase());
  const availableAnnexures = annexures
    .filter((annexure) => !mappedIds.has(annexure.id))
    .filter((annexure) => {
      const needle = librarySearch.trim().toLowerCase();
      const searchable = `${annexure.code} ${annexure.title} ${annexure.departments.join(' ')}`.toLowerCase();
      const matchesSearch = !needle || searchable.includes(needle);
      const suggestedRequirement = 'MANDATORY';
      const suggestedStage = 'IN_PROGRESS';
      const compatible = annexure.departments.length === 0 || annexure.departments.some((item) => departmentKeys.includes(item.toLowerCase()));
      return matchesSearch
        && (requirementFilter === 'ALL' || suggestedRequirement === requirementFilter)
        && (stageFilter === 'ALL' || suggestedStage === stageFilter)
        && (compatibilityFilter === 'ALL' || compatible);
    });
  const toggleSelection = (annexureId: number) => {
    setSelectedIds((current) => current.includes(annexureId) ? current.filter((id) => id !== annexureId) : [...current, annexureId]);
  };
  const disableMapping = (annexure: DepartmentAnnexure) => configure.mutate({
    id: department.id,
    payload: { ...defaultAnnexureMapping(annexure), active: false },
  });
  const selectionActive = selectedAnnexures.length > 0;

  return (
    <div className="space-y-4">
      <SectionHeader title="Annexure Responsibilities" detail="Map controlled annexure masters to department ownership, stage relevance, visibility, and execution responsibility." />

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(340px,420px)_132px_minmax(0,1fr)]">
        <section className="min-w-0 overflow-hidden rounded border border-outline-variant bg-surface">
          <div className="sticky top-0 z-10 border-b border-outline-variant bg-surface p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-body-md font-black text-on-surface">Annexure Library</h3>
                <p className="text-label-sm font-semibold text-muted-foreground">{availableAnnexures.length} available · {selectedIds.length} selected</p>
              </div>
              {selectedIds.length > 0 && (
                <button onClick={() => setSelectedIds([])} className="text-label-sm font-black text-primary hover:underline">Clear</button>
              )}
            </div>
            <div className="mt-3 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
                <input
                  value={librarySearch}
                  onChange={(event) => setLibrarySearch(event.target.value)}
                  placeholder="Filter by code, title, or department"
                  className="h-10 w-full rounded border border-outline-variant bg-surface pl-10 pr-3 text-body-sm outline-none focus:border-primary"
                />
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <FixedSelect label="Requirement" value={requirementFilter} options={[{ value: 'ALL', label: 'All' }, ...REQUIREMENT_OPTIONS]} onChange={(value) => setRequirementFilter(value as typeof requirementFilter)} />
                <FixedSelect label="Workflow stage" value={stageFilter} options={[{ value: 'ALL', label: 'All' }, ...WORKFLOW_STAGE_OPTIONS]} onChange={setStageFilter} />
                <FixedSelect label="Compatibility" value={compatibilityFilter} options={[{ value: 'ALL', label: 'All' }, { value: 'COMPATIBLE', label: 'This Department' }]} onChange={(value) => setCompatibilityFilter(value as typeof compatibilityFilter)} />
              </div>
            </div>
          </div>

          <div className="max-h-[620px] overflow-y-auto divide-y divide-outline-variant">
            {availableAnnexures.map((annexure) => {
              const selected = selectedIds.includes(annexure.id);
              const compatible = annexure.departments.length === 0 || annexure.departments.some((item) => departmentKeys.includes(item.toLowerCase()));
              return (
                <div
                  key={annexure.id}
                  className={`grid grid-cols-[28px_minmax(0,1fr)_74px] items-center gap-3 px-3 py-2.5 ${selected ? 'bg-primary/10' : 'bg-surface hover:bg-surface-container-low'}`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleSelection(annexure.id)}
                    className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
                    aria-label={`Select ${annexure.code}`}
                  />
                  <button type="button" onClick={() => toggleSelection(annexure.id)} className="min-w-0 text-left">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 font-mono text-[11px] font-black text-primary">{annexure.code}</span>
                      <span className="truncate text-body-sm font-black text-on-surface">{annexure.title}</span>
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      <span className="rounded bg-surface-container px-1.5 py-0.5 text-[10px] font-black uppercase text-on-surface-variant">Mandatory</span>
                      <span className="rounded bg-surface-container px-1.5 py-0.5 text-[10px] font-black uppercase text-on-surface-variant">Checklist In Progress</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-black uppercase ${compatible ? 'bg-status-success-bg text-status-success-text' : 'bg-status-warning-bg text-status-warning-text'}`}>{compatible ? 'Compatible' : 'Shared'}</span>
                    </span>
                  </button>
                  <button type="button" onClick={() => toggleSelection(annexure.id)} className="h-8 rounded border border-outline-variant px-2 text-label-sm font-black text-primary hover:bg-primary/10">
                    {selected ? 'Selected' : 'Select'}
                  </button>
                </div>
              );
            })}
            {availableAnnexures.length === 0 && <EmptyPanel message="No annexures match the selected filters." />}
          </div>
        </section>

        <aside className="xl:sticky xl:top-20 xl:self-start">
          <div className={`rounded border px-3 py-2 ${selectionActive ? 'border-primary bg-primary/10' : 'border-outline-variant bg-surface-container-low'}`}>
            <p className="text-label-sm font-black uppercase text-on-surface-variant">Selection</p>
            <p className="mt-0.5 text-xl font-black text-on-surface">{selectedAnnexures.length}</p>
            <div className="mt-2 space-y-2">
              <button
                disabled={!selectionActive}
                onClick={() => setMappingDraft(selectedAnnexures)}
                className="w-full rounded bg-primary px-2 py-2 text-label-sm font-black text-on-primary disabled:opacity-40"
              >
                Map
              </button>
              <button
                disabled={!selectionActive}
                onClick={() => setSelectedIds([])}
                className="w-full rounded border border-outline-variant px-2 py-2 text-label-sm font-black text-on-surface disabled:opacity-40"
              >
                Clear
              </button>
            </div>
          </div>
        </aside>

        <section className="min-w-0 overflow-hidden rounded border border-outline-variant bg-surface">
          <div className="border-b border-outline-variant bg-surface p-3">
            <h3 className="text-body-md font-black text-on-surface">Mapped Annexures</h3>
            <p className="text-label-sm font-semibold text-muted-foreground">{department.annexures.length} department responsibility mapping(s)</p>
          </div>
          <div className="max-h-[620px] overflow-y-auto divide-y divide-outline-variant">
            {department.annexures.map((annexure) => (
              <button
                key={annexure.mapping_id ?? annexure.code}
                type="button"
                onClick={() => setViewing(annexure)}
                className="grid w-full gap-3 px-3 py-2.5 text-left hover:bg-surface-container-low lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
              >
                <div className="grid min-w-0 grid-cols-[92px_minmax(0,1fr)] items-center gap-2">
                  <span className="font-mono text-[11px] font-black text-primary">{annexure.code}</span>
                  <h4 className="truncate text-body-sm font-black text-on-surface">{annexure.title}</h4>
                </div>
                <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                  <span className={`rounded px-2 py-1 text-[10px] font-black uppercase ${annexure.active ? 'bg-status-success-bg text-status-success-text' : 'bg-status-warning-bg text-status-warning-text'}`}>
                    {annexure.active ? 'Active' : 'Inactive'}
                  </span>
                  <span className="max-w-48 truncate rounded bg-surface-container px-2 py-1 text-[10px] font-black uppercase text-on-surface-variant">
                    {optionLabel(WORKFLOW_STAGE_OPTIONS, annexure.workflow_stage)}
                  </span>
                  <span className="h-8 rounded border border-outline-variant px-2.5 py-1.5 text-label-sm font-bold text-primary inline-flex items-center gap-1.5">
                    <Eye className="w-4 h-4" />
                    View
                  </span>
                </div>
              </button>
            ))}
            {department.annexures.length === 0 && <EmptyPanel message="No annexure responsibilities mapped yet." />}
          </div>
        </section>
      </div>

      <div className="xl:hidden">
        {selectionActive && (
          <div className="fixed inset-x-4 bottom-4 z-40 flex flex-col gap-2 rounded border border-primary bg-surface p-3 shadow-2xl sm:left-auto sm:w-96 sm:flex-row">
            <button onClick={() => setMappingDraft(selectedAnnexures)} className="flex-1 rounded bg-primary px-3 py-2 text-label-sm font-black text-on-primary">Map Selected Annexures</button>
            <button onClick={() => setSelectedIds([])} className="rounded border border-outline-variant px-3 py-2 text-label-sm font-black">Clear Selection</button>
          </div>
        )}
      </div>

      {mappingDraft && (
        <AnnexureBulkMappingDialog
          annexures={mappingDraft}
          department={department}
          busy={configure.isPending}
          onClose={() => setMappingDraft(null)}
          onSubmit={(payloads) => {
            Promise.all(payloads.map((payload) => configure.mutateAsync({ id: department.id, payload }))).then(() => {
              setSelectedIds([]);
              setMappingDraft(null);
            });
          }}
        />
      )}
      {viewing && (
        <AnnexureMappingDetailDialog
          annexure={viewing}
          department={department}
          compatible={annexures.find((item) => item.id === viewing.id)?.departments.length === 0 || Boolean(annexures.find((item) => item.id === viewing.id)?.departments.some((item) => departmentKeys.includes(item.toLowerCase())))}
          busy={configure.isPending || remove.isPending}
          onClose={() => setViewing(null)}
          onSubmit={(payload) => configure.mutate({ id: department.id, payload }, { onSuccess: () => setViewing(null) })}
          onDisable={() => disableMapping(viewing)}
          onRemove={() => viewing.mapping_id && remove.mutate({ id: department.id, mappingId: viewing.mapping_id }, { onSuccess: () => setViewing(null) })}
        />
      )}
    </div>
  );
};

const OperationalUnitsTab: React.FC<{ department: RefineryDepartment; unitOptions: Option[]; areaOwnerOptions: Option[] }> = ({ department, unitOptions, areaOwnerOptions }) => {
  const [editing, setEditing] = useState<OperationalUnit | null>(null);
  const [selectedUnitIds, setSelectedUnitIds] = useState(department.operational_units.map((unit) => String(unit.id)));
  const configure = useConfigureDepartmentUnit();
  const updateDepartment = useUpdateDepartment();

  return (
    <div className="space-y-4">
      <MappingSection
        title="Operational Unit Coverage"
        detail={`${department.operational_units.length} mapped unit(s). Add or remove coverage with chips instead of manual unit IDs.`}
        actions={
          <button
            disabled={updateDepartment.isPending}
            onClick={() => updateDepartment.mutate({ id: department.id, payload: { unit_ids: selectedUnitIds.map(Number) } })}
            className="px-3 py-2 bg-primary text-on-primary rounded text-label-sm font-black disabled:opacity-50"
          >
            Save Unit Coverage
          </button>
        }
      >
        <ChipMultiSelect label="Mapped refinery units" options={unitOptions} selected={selectedUnitIds} onChange={setSelectedUnitIds} placeholder="Search unit code, name, or zone" />
      </MappingSection>
      <OperationalGrid columns={2} gap="md">
        {department.operational_units.map((unit) => (
          <ConfigCard
            key={unit.id}
            title={`${unit.code} · ${unit.name}`}
            icon={MapPinned}
            items={[
              ['Zone', unit.zone],
              ['Visibility', optionLabel(UNIT_VISIBILITY_OPTIONS, unit.visibility)],
              ['Workflow scope', optionLabel(WORKFLOW_SCOPE_OPTIONS, unit.workflow_scope)],
              ['Area owner', unit.area_owner_user_id ? `Assigned user ${unit.area_owner_user_id}` : 'Not assigned'],
            ]}
            actions={<button onClick={() => setEditing(unit)} className="px-3 py-2 border border-outline-variant rounded text-label-sm font-bold inline-flex items-center gap-2"><Edit2 className="w-4 h-4" />Configure</button>}
          />
        ))}
        {department.operational_units.length === 0 && <EmptyPanel message="No operational units mapped." />}
      </OperationalGrid>
      {editing && (
        <UnitConfigDrawer
          unit={editing}
          busy={configure.isPending}
          areaOwnerOptions={areaOwnerOptions}
          onClose={() => setEditing(null)}
          onSubmit={(payload) => configure.mutate({ id: department.id, payload }, { onSuccess: () => setEditing(null) })}
        />
      )}
    </div>
  );
};

const WorkflowResponsibilitiesTab: React.FC<{ department: RefineryDepartment }> = ({ department }) => {
  const [editing, setEditing] = useState<DepartmentWorkflowResponsibility | null>(null);
  const configure = useConfigureDepartmentWorkflowResponsibility();
  return (
    <div className="space-y-4">
      <SectionHeader title="Workflow Responsibilities" detail="Responsibility matrix used by checklist ownership, escalation, due dates, punch-point routing, and approvals." />
      <div className="space-y-3">
        {department.workflow_responsibilities.map((row) => (
          <ConfigCard
            key={row.id}
            title={row.stage}
            icon={GitBranch}
            items={[
              ['Responsibility', row.responsibility],
              ['Checklist owner', optionLabel(ROLE_OPTIONS, row.owner_role)],
              ['Escalation owner', optionLabel(ROLE_OPTIONS, row.escalation_owner_role)],
              ['Due days', String(row.due_days)],
              ['Punch point owner', optionLabel(VISIBILITY_SCOPE_OPTIONS, row.punch_point_owner)],
              ['Approval required', row.approval_required ? 'Yes' : 'No'],
            ]}
            actions={<button onClick={() => setEditing(row)} className="px-3 py-2 border border-outline-variant rounded text-label-sm font-bold inline-flex items-center gap-2"><Edit2 className="w-4 h-4" />Configure</button>}
          />
        ))}
      </div>
      {editing && (
        <WorkflowConfigDrawer
          row={editing}
          busy={configure.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(payload) => configure.mutate({ id: department.id, responsibilityId: editing.id, payload }, { onSuccess: () => setEditing(null) })}
        />
      )}
    </div>
  );
};

const PermissionsTab: React.FC<{ department: RefineryDepartment }> = ({ department }) => {
  const configure = useConfigureDepartmentPermission();
  const [preset, setPreset] = useState(PERMISSION_PRESET_OPTIONS[0].value);
  const toggle = (row: DepartmentPermissionConfig) => configure.mutate({ id: department.id, payload: { ...row, allowed: !row.allowed } });
  return (
    <div className="space-y-4">
      <MappingSection
        title="Workflow Access"
        detail="Apply SRS-aligned access presets without exposing internal permission codes."
        actions={
          <button disabled={configure.isPending} onClick={() => configure.mutate({ id: department.id, payload: permissionPresetToPayload(preset) })} className="px-3 py-2 bg-primary text-on-primary rounded text-label-sm font-black disabled:opacity-50">
            Apply Access Preset
          </button>
        }
      >
        <TileSelector label="Access preset" value={preset} options={PERMISSION_PRESET_OPTIONS} onChange={setPreset} />
      </MappingSection>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {department.permission_configs.map((row) => (
          <ConfigCard
            key={row.id}
            title={capabilityLabel(row.capability)}
            icon={ShieldCheck}
            items={[
              ['Persona', optionLabel(ROLE_OPTIONS, row.role)],
              ['Visibility', optionLabel(PERMISSION_SCOPE_OPTIONS, row.scope)],
              ['Access', row.allowed ? 'Enabled' : 'Disabled'],
              ['Status', row.active ? 'Active' : 'Inactive'],
            ]}
            actions={<button disabled={configure.isPending} onClick={() => toggle(row)} className="px-3 py-2 border border-outline-variant rounded text-label-sm font-bold">{row.allowed ? 'Disable' : 'Enable'}</button>}
          />
        ))}
      </div>
    </div>
  );
};

const AreaOwnersTab: React.FC<{ department: RefineryDepartment; users: AdminUser[]; areaOwnerOptions: Option[] }> = ({ department, users, areaOwnerOptions }) => {
  const [editing, setEditing] = useState<DepartmentAreaOwner | null>(null);
  const [newOwnerId, setNewOwnerId] = useState(areaOwnerOptions[0]?.value ?? '');
  const [newOwnerUnitId, setNewOwnerUnitId] = useState('');
  const configure = useConfigureDepartmentAreaOwner();
  const unitOptions = department.operational_units.map((unit) => ({ value: String(unit.id), label: `${unit.code} · ${unit.name}`, helper: unit.zone }));
  const addOwner = () => {
    if (!newOwnerId) return;
    configure.mutate({
      id: department.id,
      payload: {
        area_owner_user_id: Number(newOwnerId),
        unit_id: newOwnerUnitId ? Number(newOwnerUnitId) : null,
        approval_scope: newOwnerUnitId ? 'UNIT' : 'DEPARTMENT',
        active: true,
      },
    });
  };
  return (
    <div className="space-y-4">
      <MappingSection
        title="Area Owners"
        detail="Approval and escalation routing for completed PSSR, punch points, and pending owner approval."
        actions={
          <button disabled={!newOwnerId || configure.isPending} onClick={addOwner} className="px-3 py-2 bg-primary text-on-primary rounded text-label-sm font-black disabled:opacity-50">
            Assign Area Owner
          </button>
        }
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <SearchableSelect label="Area owner" value={newOwnerId} options={areaOwnerOptions} onChange={setNewOwnerId} placeholder="Search area owner" />
          <SearchableSelect label="Approval unit" value={newOwnerUnitId} options={[{ value: '', label: 'Department-wide' }, ...unitOptions]} onChange={setNewOwnerUnitId} placeholder="Select unit scope" />
        </div>
      </MappingSection>
      <OperationalGrid columns={2} gap="md">
        {department.area_owners.map((row) => (
          <ConfigCard
            key={row.id}
            title={row.area_owner_name}
            icon={UserCheck}
            items={[
              ['Operational unit', row.unit_name || 'Department-wide'],
              ['Approval scope', row.approval_scope],
              ['Escalation', row.escalation_owner_name || 'Not assigned'],
              ['Status', row.active ? 'Active' : 'Inactive'],
            ]}
            actions={<button onClick={() => setEditing(row)} className="px-3 py-2 border border-outline-variant rounded text-label-sm font-bold inline-flex items-center gap-2"><Edit2 className="w-4 h-4" />Configure</button>}
          />
        ))}
        {department.area_owners.length === 0 && <EmptyPanel message="No area owner routing configured yet." />}
      </OperationalGrid>
      {editing && (
        <AreaOwnerConfigDrawer
          row={editing}
          units={department.operational_units}
          users={users}
          areaOwnerOptions={areaOwnerOptions}
          busy={configure.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(payload) => configure.mutate({ id: department.id, mappingId: editing.id, payload }, { onSuccess: () => setEditing(null) })}
        />
      )}
    </div>
  );
};

const ActivityHistoryTab: React.FC<{ department: RefineryDepartment }> = ({ department }) => (
  <div className="space-y-4">
    <SectionHeader title="Activity History" detail="Audit trail for user, annexure, unit, permission, workflow, and area-owner changes." />
    <ActivityList rows={department.activity_history} empty="No department configuration activity recorded." />
  </div>
);

const DepartmentSetupWizard: React.FC<{
  department: RefineryDepartment;
  departments: RefineryDepartment[];
  annexures: AnnexureSummary[];
  users: AdminUser[];
  unitOptions: Option[];
  annexureOptions: Option[];
  userOptions: Option[];
  areaOwnerOptions: Option[];
  busy: boolean;
  onClose: () => void;
  onDepartmentUpdated: (department: RefineryDepartment) => void;
}> = ({ department, annexures, users, unitOptions, annexureOptions, userOptions, areaOwnerOptions, busy, onClose, onDepartmentUpdated }) => {
  const [step, setStep] = useState(0);
  const updateDepartment = useUpdateDepartment();
  const configureAnnexure = useConfigureDepartmentAnnexure();
  const removeAnnexure = useRemoveDepartmentAnnexure();
  const configureAreaOwner = useConfigureDepartmentAreaOwner();
  const configureWorkflow = useConfigureDepartmentWorkflowResponsibility();
  const configurePermission = useConfigureDepartmentPermission();
  const enableInitiator = useEnableInitiator();
  const [metadata, setMetadata] = useState({
    code: department.code,
    name: department.name,
    description: department.description ?? '',
    active: department.active,
  });
  const [selectedUnitIds, setSelectedUnitIds] = useState(department.operational_units.map((unit) => String(unit.id)));
  const [selectedAnnexureIds, setSelectedAnnexureIds] = useState(department.annexures.map((annexure) => String(annexure.id)));
  const [areaOwnerUserId, setAreaOwnerUserId] = useState(areaOwnerOptions[0]?.value ?? '');
  const [areaOwnerUnitId, setAreaOwnerUnitId] = useState(department.operational_units[0]?.id ? String(department.operational_units[0].id) : '');
  const [initiatorUserId, setInitiatorUserId] = useState(userOptions.find((option) => option.group === 'TEAM_MEMBER')?.value ?? userOptions[0]?.value ?? '');
  const [workflowDraft, setWorkflowDraft] = useState({
    stage: WORKFLOW_STAGE_OPTIONS[1].value,
    responsibility: 'Owns assigned department checklist completion and evidence readiness.',
    owner_role: 'TEAM_MEMBER',
    escalation_owner_role: 'AREA_OWNER',
    due_days: 3,
    punch_point_owner: 'DEPARTMENT',
    approval_required: false,
    active: true,
  });

  const stepItems = [
    'Basic Metadata',
    'Operational Units',
    'Annexures',
    'Personnel & Permissions',
    'Workflow',
    'Review & Activate',
  ];
  const working = busy || updateDepartment.isPending || configureAnnexure.isPending || removeAnnexure.isPending || configureAreaOwner.isPending || configureWorkflow.isPending || configurePermission.isPending || enableInitiator.isPending;
  const mappedAnnexureIds = new Set(department.annexures.map((annexure) => String(annexure.id)));
  const selectedAnnexures = annexures.filter((annexure) => selectedAnnexureIds.includes(String(annexure.id)));

  const saveMetadata = async () => {
    const updated = await updateDepartment.mutateAsync({ id: department.id, payload: metadata });
    onDepartmentUpdated(updated);
  };

  const saveUnits = async () => {
    const updated = await updateDepartment.mutateAsync({ id: department.id, payload: { unit_ids: selectedUnitIds.map(Number) } });
    onDepartmentUpdated(updated);
  };

  const saveAnnexures = async () => {
    const selected = new Set(selectedAnnexureIds);
    await Promise.all(department.annexures
      .filter((annexure) => !selected.has(String(annexure.id)) && annexure.mapping_id)
      .map((annexure) => removeAnnexure.mutateAsync({ id: department.id, mappingId: annexure.mapping_id as number })));
    const additions = annexures.filter((annexure) => selected.has(String(annexure.id)) && !mappedAnnexureIds.has(String(annexure.id)));
    const configured = await Promise.all(additions.map((annexure, index) => configureAnnexure.mutateAsync({
      id: department.id,
      payload: { ...defaultAnnexureMapping(annexure), priority: (department.annexures.length + index + 1) * 10 },
    })));
    if (configured[configured.length - 1]) onDepartmentUpdated(configured[configured.length - 1]);
  };

  const savePersonnel = async () => {
    let latest: RefineryDepartment | undefined;
    if (areaOwnerUserId) {
      latest = await configureAreaOwner.mutateAsync({
        id: department.id,
        payload: {
          area_owner_user_id: Number(areaOwnerUserId),
          unit_id: areaOwnerUnitId ? Number(areaOwnerUnitId) : null,
          approval_scope: areaOwnerUnitId ? 'UNIT' : 'DEPARTMENT',
          active: true,
        },
      });
    }
    if (initiatorUserId) {
      await enableInitiator.mutateAsync({ userId: Number(initiatorUserId), reason: `Granted during ${department.name} setup wizard.` });
    }
    await configurePermission.mutateAsync({ id: department.id, payload: { capability: 'CREATE_PSSR', role: 'TEAM_MEMBER', allowed: Boolean(initiatorUserId), scope: 'DEPARTMENT', active: true } });
    if (latest) onDepartmentUpdated(latest);
  };

  const saveWorkflow = async () => {
    const existing = department.workflow_responsibilities.find((row) => row.stage === workflowDraft.stage);
    const updated = await configureWorkflow.mutateAsync({
      id: department.id,
      responsibilityId: existing?.id,
      payload: workflowDraft,
    });
    onDepartmentUpdated(updated);
  };

  const activate = async () => {
    const updated = await updateDepartment.mutateAsync({ id: department.id, payload: { active: true } });
    onDepartmentUpdated(updated);
    onClose();
  };

  const next = () => setStep((current) => Math.min(stepItems.length - 1, current + 1));
  const previous = () => setStep((current) => Math.max(0, current - 1));

  return (
    <DialogShell title="Department Setup Wizard" onClose={onClose} maxWidth="max-w-6xl">
      <div className="grid max-h-[calc(90vh-74px)] grid-cols-1 overflow-hidden lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-b border-border bg-surface-container-low p-4 lg:border-b-0 lg:border-r">
          <p className="text-label-sm font-black uppercase text-primary">{department.code}</p>
          <p className="mt-1 text-headline-sm font-black text-on-surface">{department.name}</p>
          <div className="mt-5 space-y-2">
            {stepItems.map((item, index) => (
              <button key={item} type="button" onClick={() => setStep(index)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-label-md font-black ${step === index ? 'bg-primary text-on-primary' : index < step ? 'bg-card text-primary' : 'text-on-surface-variant hover:bg-card'}`}>
                {index < step ? <CheckCircle2 className="h-4 w-4" /> : <span className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px]">{index + 1}</span>}
                {item}
              </button>
            ))}
          </div>
        </aside>

        <main className="min-h-0 overflow-y-auto bg-surface p-5">
          {step === 0 && (
            <div className="space-y-4">
              <SectionHeader title="Basic Metadata" detail="Set the department identity and activation posture before mapping operational workflow." />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Department Code" value={metadata.code} onChange={(value) => setMetadata({ ...metadata, code: value })} />
                <Field label="Department Name" value={metadata.name} onChange={(value) => setMetadata({ ...metadata, name: value })} />
                <label className="block md:col-span-2">
                  <span className="text-label-sm font-bold text-on-surface-variant">Description</span>
                  <textarea value={metadata.description} onChange={(event) => setMetadata({ ...metadata, description: event.target.value })} className="mt-1 w-full min-h-28 px-3 py-2 border border-outline-variant rounded bg-surface text-body-sm outline-none focus:border-primary" />
                </label>
                <SegmentedControl label="Operational visibility" value={metadata.active ? 'ACTIVE' : 'DRAFT'} onChange={(value) => setMetadata({ ...metadata, active: value === 'ACTIVE' })} options={[{ value: 'DRAFT', label: 'Draft' }, { value: 'ACTIVE', label: 'Active' }]} />
              </div>
              <WizardAction disabled={working || !metadata.code.trim() || !metadata.name.trim()} onSave={saveMetadata} />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <SectionHeader title="Operational Unit Mapping" detail="Assign refinery units visually. The saved selection becomes the department's unit coverage boundary." />
              <ChipMultiSelect label="Mapped refinery units" options={unitOptions} selected={selectedUnitIds} onChange={setSelectedUnitIds} placeholder="Search unit code, name, or zone" />
              <WizardAction disabled={working} onSave={saveUnits} />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <SectionHeader title="Annexure Responsibilities" detail="Attach controlled annexure masters with smart defaults for mandatory execution, department visibility, team ownership, and active workflow." />
              <ChipMultiSelect label="Mapped annexures" options={annexureOptions} selected={selectedAnnexureIds} onChange={setSelectedAnnexureIds} placeholder="Search annexure code, title, or department" />
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {selectedAnnexures.map((annexure, index) => (
                  <div key={annexure.id} className="rounded-lg border border-border bg-card p-3">
                    <p className="text-body-sm font-black text-on-surface">{annexure.code} · {annexure.title}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-label-sm font-black text-muted-foreground">
                      <span className="rounded bg-surface-container px-2 py-1">Mandatory</span>
                      <span className="rounded bg-surface-container px-2 py-1">Team Member</span>
                      <span className="rounded bg-surface-container px-2 py-1">In Progress</span>
                      <span className="rounded bg-surface-container px-2 py-1">Priority {(index + 1) * 10}</span>
                    </div>
                  </div>
                ))}
              </div>
              <WizardAction disabled={working} onSave={saveAnnexures} />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <SectionHeader title="Personnel & Permissions" detail="Assign approval owners and grant initiator access without memorizing user IDs or permission codes." />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <SearchableSelect label="Area owner" value={areaOwnerUserId} options={areaOwnerOptions} onChange={setAreaOwnerUserId} placeholder="Search area owners" />
                <SearchableSelect label="Approval unit" value={areaOwnerUnitId} options={[{ value: '', label: 'Department-wide' }, ...unitOptions.filter((option) => selectedUnitIds.includes(option.value))]} onChange={setAreaOwnerUnitId} placeholder="Select unit scope" />
                <SearchableSelect label="PSSR initiator" value={initiatorUserId} options={userOptions} onChange={setInitiatorUserId} placeholder="Search team member" />
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-label-sm font-black uppercase text-muted-foreground">Permission inheritance</p>
                  <p className="mt-2 text-body-sm text-on-surface-variant">Team members inherit checklist execution, evidence upload, and punch-point creation. PSSR initiator access is a separate capability for starting workflows.</p>
                </div>
              </div>
              <WizardAction disabled={working} onSave={savePersonnel} />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <SectionHeader title="Workflow Configuration" detail="Configure stage ownership, approval routing, due days, and punch-point handling from controlled option sets." />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <FixedSelect label="Workflow stage" value={workflowDraft.stage} options={WORKFLOW_STAGE_OPTIONS} onChange={(value) => setWorkflowDraft({ ...workflowDraft, stage: value })} />
                <FixedSelect label="Checklist owner" value={workflowDraft.owner_role} options={ROLE_OPTIONS} onChange={(value) => setWorkflowDraft({ ...workflowDraft, owner_role: value })} />
                <FixedSelect label="Escalation owner" value={workflowDraft.escalation_owner_role} options={ROLE_OPTIONS} onChange={(value) => setWorkflowDraft({ ...workflowDraft, escalation_owner_role: value })} />
                <Stepper label="Due days" value={workflowDraft.due_days} onChange={(value) => setWorkflowDraft({ ...workflowDraft, due_days: value })} />
                <SegmentedControl label="Punch-point owner" value={workflowDraft.punch_point_owner} options={VISIBILITY_SCOPE_OPTIONS} onChange={(value) => setWorkflowDraft({ ...workflowDraft, punch_point_owner: value })} />
                <SegmentedControl label="Approval required" value={workflowDraft.approval_required ? 'YES' : 'NO'} options={[{ value: 'NO', label: 'No' }, { value: 'YES', label: 'Yes' }]} onChange={(value) => setWorkflowDraft({ ...workflowDraft, approval_required: value === 'YES' })} />
                <label className="block lg:col-span-2">
                  <span className="text-label-sm font-bold text-on-surface-variant">Responsibility model</span>
                  <textarea value={workflowDraft.responsibility} onChange={(event) => setWorkflowDraft({ ...workflowDraft, responsibility: event.target.value })} className="mt-1 w-full min-h-24 px-3 py-2 border border-outline-variant rounded bg-surface text-body-sm outline-none focus:border-primary" />
                </label>
              </div>
              <WizardAction disabled={working} onSave={saveWorkflow} />
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <SectionHeader title="Review & Activate" detail="Confirm the department has enough routing, mappings, and permissions to operate immediately." />
              <OperationalGrid columns={4} gap="md">
                <MetricCard label="Units" value={selectedUnitIds.length} />
                <MetricCard label="Annexures" value={selectedAnnexureIds.length} />
                <MetricCard label="Area Owners" value={department.area_owners.length + (areaOwnerUserId ? 1 : 0)} />
                <MetricCard label="Workflow Rules" value={department.workflow_responsibilities.length} />
              </OperationalGrid>
              <MappingSection title="Activation checklist" detail="The setup wizard keeps the department useful even when backend defaults are minimal.">
                <SummaryChips
                  items={[
                    { key: 'metadata', label: metadata.name ? 'Metadata ready' : 'Metadata missing' },
                    { key: 'units', label: selectedUnitIds.length ? 'Units mapped' : 'No units mapped' },
                    { key: 'annexures', label: selectedAnnexureIds.length ? 'Annexures mapped' : 'No annexures mapped' },
                    { key: 'permissions', label: initiatorUserId ? 'Initiator selected' : 'Standard permissions only' },
                    { key: 'workflow', label: workflowDraft.stage },
                  ]}
                />
              </MappingSection>
              <button disabled={working || !metadata.name.trim() || !selectedUnitIds.length} onClick={activate} className="bg-primary px-4 py-2 text-label-md font-black text-on-primary rounded disabled:opacity-50">
                Activate Department
              </button>
            </div>
          )}
        </main>
      </div>
      <div className="border-t border-border px-5 py-4 flex items-center justify-between">
        <button disabled={step === 0} onClick={previous} className="px-4 py-2 border border-outline-variant rounded text-label-md font-bold disabled:opacity-40">Previous</button>
        <button disabled={step === stepItems.length - 1} onClick={next} className="px-4 py-2 bg-surface-container text-on-surface rounded text-label-md font-bold disabled:opacity-40">Next</button>
      </div>
    </DialogShell>
  );
};

const WizardAction: React.FC<{ disabled?: boolean; onSave: () => void | Promise<void> }> = ({ disabled, onSave }) => (
  <div className="flex justify-end">
    <button disabled={disabled} onClick={onSave} className="px-4 py-2 bg-primary text-on-primary rounded text-label-md font-black disabled:opacity-50">
      Save Step
    </button>
  </div>
);

const AnnexureBulkMappingDialog: React.FC<{
  annexures: AnnexureSummary[];
  department: RefineryDepartment;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payloads: Array<Parameters<typeof api.configureDepartmentAnnexure>[1]>) => void;
}> = ({ annexures, department, busy, onClose, onSubmit }) => {
  const [form, setForm] = useState({
    requirement_type: 'MANDATORY',
    visibility_scope: 'DEPARTMENT',
    checklist_owner_role: 'TEAM_MEMBER',
    workflow_stage: 'IN_PROGRESS',
    priority: (department.annexures.length + 1) * 10,
    active: true,
  });

  const payloads = annexures.map((annexure, index) => ({
    annexure_id: annexure.id,
    requirement_type: form.requirement_type,
    visibility_scope: form.visibility_scope,
    checklist_owner_role: form.checklist_owner_role,
    workflow_stage: form.workflow_stage,
    priority: form.priority + index * 10,
    active: form.active,
  }));

  return (
    <DialogShell title="Map Annexure Responsibilities" onClose={onClose} maxWidth="max-w-3xl">
      <div className="p-5 space-y-5">
        <div className="rounded-lg border border-border bg-surface-container-low p-3">
          <p className="text-body-sm font-bold text-on-surface">{annexures.length} annexure template(s) selected for {department.name}. These mappings will drive checklist routing, workflow visibility, and department responsibility.</p>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {annexures.map((annexure) => (
            <div key={annexure.id} className="rounded-lg border border-border bg-card p-3">
              <p className="text-body-sm font-black text-on-surface">{annexure.code} · {annexure.title}</p>
              <p className="mt-1 text-label-sm font-semibold text-muted-foreground">{annexure.departments.length ? annexure.departments.join(', ') : 'All configured departments'}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SegmentedControl label="Requirement type" value={form.requirement_type} onChange={(value) => setForm({ ...form, requirement_type: value })} options={REQUIREMENT_OPTIONS} />
          <SegmentedControl label="Visibility scope" value={form.visibility_scope} onChange={(value) => setForm({ ...form, visibility_scope: value })} options={VISIBILITY_SCOPE_OPTIONS} />
          <FixedSelect label="Checklist owner" value={form.checklist_owner_role} options={ROLE_OPTIONS} onChange={(value) => setForm({ ...form, checklist_owner_role: value })} />
          <FixedSelect label="Workflow stage" value={form.workflow_stage} options={WORKFLOW_STAGE_OPTIONS} onChange={(value) => setForm({ ...form, workflow_stage: value })} />
          <Stepper label="Starting priority" value={form.priority} onChange={(value) => setForm({ ...form, priority: value })} step={10} />
          <SegmentedControl label="Mapping status" value={form.active ? 'ACTIVE' : 'INACTIVE'} options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]} onChange={(value) => setForm({ ...form, active: value === 'ACTIVE' })} />
        </div>
      </div>
      <DialogActions onClose={onClose} submitLabel="Save Mappings" disabled={busy || annexures.length === 0} onSubmit={() => onSubmit(payloads)} />
    </DialogShell>
  );
};

const AnnexureMappingDetailDialog: React.FC<{
  annexure: DepartmentAnnexure;
  department: RefineryDepartment;
  compatible: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: Parameters<typeof api.configureDepartmentAnnexure>[1]) => void;
  onDisable: () => void;
  onRemove: () => void;
}> = ({ annexure, department, compatible, busy, onClose, onSubmit, onDisable, onRemove }) => {
  const [form, setForm] = useState({
    annexure_id: annexure.id,
    requirement_type: annexure.requirement_type,
    visibility_scope: annexure.visibility_scope,
    checklist_owner_role: annexure.checklist_owner_role,
    workflow_stage: annexure.workflow_stage,
    priority: annexure.priority,
    active: annexure.active,
  });
  return (
    <DialogShell title={`${annexure.code} Responsibility`} onClose={onClose} maxWidth="max-w-3xl">
      <div className="p-5 space-y-5">
        <div className="flex flex-col gap-3 border-b border-outline-variant pb-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="text-xl font-black text-on-surface">{annexure.title}</p>
            <p className="mt-1 text-body-sm text-on-surface-variant">Department annexure responsibility mapping for {department.name}.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <span className={`rounded px-2 py-1 text-[10px] font-black uppercase ${annexure.active ? 'bg-status-success-bg text-status-success-text' : 'bg-status-warning-bg text-status-warning-text'}`}>{annexure.active ? 'Active' : 'Inactive'}</span>
            <span className="rounded bg-surface-container px-2 py-1 text-[10px] font-black uppercase text-on-surface-variant">{optionLabel(WORKFLOW_STAGE_OPTIONS, annexure.workflow_stage)}</span>
          </div>
        </div>

        <section>
          <h4 className="text-label-md font-black text-on-surface">Mapping Details</h4>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <ReadOnlyValue label="Requirement type" value={annexure.requirement_type === 'MANDATORY' ? 'Mandatory' : 'Optional'} />
            <ReadOnlyValue label="Workflow stage" value={optionLabel(WORKFLOW_STAGE_OPTIONS, annexure.workflow_stage)} />
            <ReadOnlyValue label="Visibility" value={optionLabel(VISIBILITY_SCOPE_OPTIONS, annexure.visibility_scope)} />
            <ReadOnlyValue label="Owner role" value={optionLabel(ROLE_OPTIONS, annexure.checklist_owner_role)} />
            <ReadOnlyValue label="Priority" value={String(annexure.priority)} />
            <ReadOnlyValue label="Compatibility" value={compatible ? 'Compatible with this department' : 'Shared cross-department mapping'} />
            <ReadOnlyValue label="Current state" value={annexure.active ? 'Active mapping' : 'Inactive mapping'} />
            <ReadOnlyValue label="Mapping history" value={annexure.mapping_id ? `Mapping ${annexure.mapping_id}` : 'Legacy annexure mapping'} />
          </div>
        </section>

        <section className="border-t border-outline-variant pt-4">
          <h4 className="text-label-md font-black text-on-surface">Configure Mapping</h4>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            <SegmentedControl label="Requirement type" value={form.requirement_type} onChange={(value) => setForm({ ...form, requirement_type: value })} options={REQUIREMENT_OPTIONS} />
            <SegmentedControl label="Visibility scope" value={form.visibility_scope} onChange={(value) => setForm({ ...form, visibility_scope: value })} options={VISIBILITY_SCOPE_OPTIONS} />
            <FixedSelect label="Owner role" value={form.checklist_owner_role} options={ROLE_OPTIONS} onChange={(value) => setForm({ ...form, checklist_owner_role: value })} />
            <FixedSelect label="Workflow stage" value={form.workflow_stage} options={WORKFLOW_STAGE_OPTIONS} onChange={(value) => setForm({ ...form, workflow_stage: value })} />
            <Stepper label="Priority" value={form.priority} onChange={(value) => setForm({ ...form, priority: value })} step={10} />
            <SegmentedControl label="Current state" value={form.active ? 'ACTIVE' : 'INACTIVE'} options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]} onChange={(value) => setForm({ ...form, active: value === 'ACTIVE' })} />
          </div>
        </section>
      </div>
      <div className="flex flex-col gap-3 border-t border-outline-variant px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2">
          <button disabled={busy || !annexure.active} onClick={onDisable} className="rounded border border-outline-variant px-4 py-2 text-label-md font-bold disabled:opacity-40">Disable</button>
          <button disabled={busy || !annexure.mapping_id} onClick={onRemove} className="rounded border border-error/30 px-4 py-2 text-label-md font-bold text-error disabled:opacity-40">Remove</button>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="rounded border border-outline-variant px-4 py-2 text-label-md font-bold">Close</button>
          <button disabled={busy} onClick={() => onSubmit(form)} className="rounded bg-primary px-4 py-2 text-label-md font-bold text-on-primary disabled:opacity-50">Save Configuration</button>
        </div>
      </div>
    </DialogShell>
  );
};

const UnitConfigDrawer: React.FC<{
  unit: OperationalUnit;
  busy: boolean;
  areaOwnerOptions: Option[];
  onClose: () => void;
  onSubmit: (payload: Parameters<typeof api.configureDepartmentUnit>[1]) => void;
}> = ({ unit, busy, areaOwnerOptions, onClose, onSubmit }) => {
  const [form, setForm] = useState({
    unit_id: unit.id,
    visibility: unit.visibility,
    workflow_scope: unit.workflow_scope,
    area_owner_user_id: unit.area_owner_user_id ?? null,
    active: unit.active,
  });
  return (
    <DialogShell title={`Configure ${unit.code}`} onClose={onClose} maxWidth="max-w-xl">
      <div className="p-5 space-y-4">
        <SegmentedControl label="Visibility" value={form.visibility} onChange={(value) => setForm({ ...form, visibility: value })} options={UNIT_VISIBILITY_OPTIONS} />
        <FixedSelect label="Workflow scope" value={form.workflow_scope} options={WORKFLOW_SCOPE_OPTIONS} onChange={(value) => setForm({ ...form, workflow_scope: value })} />
        <SearchableSelect label="Area owner" value={form.area_owner_user_id ? String(form.area_owner_user_id) : ''} options={[{ value: '', label: 'Not assigned' }, ...areaOwnerOptions]} onChange={(value) => setForm({ ...form, area_owner_user_id: value ? Number(value) : null })} />
        <label className="flex items-center gap-2 text-body-sm text-on-surface-variant"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Active unit mapping</label>
      </div>
      <DialogActions onClose={onClose} submitLabel="Save Unit" disabled={busy} onSubmit={() => onSubmit(form)} />
    </DialogShell>
  );
};

const WorkflowConfigDrawer: React.FC<{
  row: DepartmentWorkflowResponsibility;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: Omit<DepartmentWorkflowResponsibility, 'id'>) => void;
}> = ({ row, busy, onClose, onSubmit }) => {
  const [form, setForm] = useState<Omit<DepartmentWorkflowResponsibility, 'id'>>({
    stage: row.stage,
    responsibility: row.responsibility,
    owner_role: row.owner_role,
    escalation_owner_role: row.escalation_owner_role,
    due_days: row.due_days,
    punch_point_owner: row.punch_point_owner,
    approval_required: row.approval_required,
    active: row.active,
  });
  return (
    <DialogShell title={`Configure ${row.stage}`} onClose={onClose} maxWidth="max-w-2xl">
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <FixedSelect label="Workflow stage" value={form.stage} options={WORKFLOW_STAGE_OPTIONS} onChange={(value) => setForm({ ...form, stage: value })} />
        <FixedSelect label="Checklist owner" value={form.owner_role} options={ROLE_OPTIONS} onChange={(value) => setForm({ ...form, owner_role: value })} />
        <FixedSelect label="Escalation owner" value={form.escalation_owner_role} options={ROLE_OPTIONS} onChange={(value) => setForm({ ...form, escalation_owner_role: value })} />
        <Stepper label="Due days" value={form.due_days} onChange={(value) => setForm({ ...form, due_days: value })} />
        <SegmentedControl label="Punch point owner" value={form.punch_point_owner} options={VISIBILITY_SCOPE_OPTIONS} onChange={(value) => setForm({ ...form, punch_point_owner: value })} />
        <SegmentedControl label="Approval required" value={form.approval_required ? 'YES' : 'NO'} options={[{ value: 'NO', label: 'No' }, { value: 'YES', label: 'Yes' }]} onChange={(value) => setForm({ ...form, approval_required: value === 'YES' })} />
        <label className="block md:col-span-2">
          <span className="text-label-sm font-bold text-on-surface-variant">Responsibility</span>
          <textarea value={form.responsibility} onChange={(event) => setForm({ ...form, responsibility: event.target.value })} className="mt-1 w-full min-h-24 px-3 py-2 border border-outline-variant rounded bg-surface text-body-sm outline-none focus:border-primary" />
        </label>
      </div>
      <DialogActions onClose={onClose} submitLabel="Save Responsibility" disabled={busy} onSubmit={() => onSubmit(form)} />
    </DialogShell>
  );
};

const AreaOwnerConfigDrawer: React.FC<{
  row: DepartmentAreaOwner;
  units: OperationalUnit[];
  users: AdminUser[];
  areaOwnerOptions: Option[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: Parameters<typeof api.configureDepartmentAreaOwner>[1]) => void;
}> = ({ row, units, users, areaOwnerOptions, busy, onClose, onSubmit }) => {
  const userOptions = toUserOptions(users);
  const [form, setForm] = useState({
    area_owner_user_id: row.area_owner_user_id,
    unit_id: row.unit_id ?? null,
    approval_scope: row.approval_scope,
    escalation_user_id: row.escalation_user_id ?? null,
    active: row.active,
  });
  return (
    <DialogShell title={`Configure ${row.area_owner_name}`} onClose={onClose} maxWidth="max-w-xl">
      <div className="p-5 space-y-4">
        <SearchableSelect label="Area owner" value={String(form.area_owner_user_id)} options={areaOwnerOptions} onChange={(value) => setForm({ ...form, area_owner_user_id: Number(value) || row.area_owner_user_id })} />
        <SearchableSelect label="Operational unit" value={form.unit_id ? String(form.unit_id) : ''} options={[{ value: '', label: 'Department-wide' }, ...units.map((unit) => ({ value: String(unit.id), label: `${unit.code} · ${unit.name}`, helper: unit.zone }))]} onChange={(value) => setForm({ ...form, unit_id: value ? Number(value) : null })} />
        <SegmentedControl label="Approval scope" value={form.approval_scope} options={APPROVAL_SCOPE_OPTIONS} onChange={(value) => setForm({ ...form, approval_scope: value })} />
        <SearchableSelect label="Escalation owner" value={form.escalation_user_id ? String(form.escalation_user_id) : ''} options={[{ value: '', label: 'Not assigned' }, ...userOptions]} onChange={(value) => setForm({ ...form, escalation_user_id: value ? Number(value) : null })} />
        <label className="flex items-center gap-2 text-body-sm text-on-surface-variant"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Active routing</label>
      </div>
      <DialogActions onClose={onClose} submitLabel="Save Routing" disabled={busy} onSubmit={() => onSubmit(form)} />
    </DialogShell>
  );
};

const TeamMemberCard: React.FC<{
  user: DepartmentUser;
  busy: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onView: () => void;
  onEdit: () => void;
  onStatus: () => void;
  onInitiator: () => void;
  onReset: () => void;
  onDelete: () => void;
}> = ({ user, busy, menuOpen, onToggleMenu, onCloseMenu, onView, onEdit, onStatus, onInitiator, onReset, onDelete }) => (
  <section className="relative rounded border border-outline-variant bg-surface p-4 shadow-sm">
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(220px,0.9fr)_170px] gap-4 lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-body-md font-bold text-on-surface truncate">{user.full_name}</p>
          <StatusBadge status={user.active ? 'Active' : 'Inactive'} type={user.active ? 'success' : 'warning'} />
        </div>
        <p className="text-[11px] text-on-surface-variant mt-1 break-all">{user.employee_id} · {user.email}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-2 text-body-sm">
        <LabeledValue label="Role" value={user.role} />
        <LabeledValue label="Unit" value={user.operational_unit || user.plant_location || 'Not mapped'} />
        <LabeledValue label="Initiator" value={user.is_pssr_initiator ? 'Enabled' : 'Standard'} />
      </div>

      <div className="flex items-center justify-between lg:justify-end gap-3">
        <div className="grid grid-cols-2 gap-2">
          <MiniMetric label="Active" value={user.assigned_pssr_count} />
          <MiniMetric label="Pending" value={user.pending_tasks_count ?? user.assigned_pssr_count} />
        </div>
        <button onClick={onToggleMenu} className="h-10 w-10 border border-outline-variant rounded text-on-surface-variant hover:text-primary hover:bg-surface-container-low inline-flex items-center justify-center" aria-label={`Actions for ${user.full_name}`}>
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
    </div>
    {menuOpen && (
      <ActionMenu
        user={user}
        busy={busy}
        onClose={onCloseMenu}
        onView={onView}
        onEdit={onEdit}
        onStatus={onStatus}
        onInitiator={onInitiator}
        onReset={onReset}
        onDelete={onDelete}
      />
    )}
  </section>
);

const ActionMenu: React.FC<{
  user: DepartmentUser;
  busy: boolean;
  onClose: () => void;
  onView: () => void;
  onEdit: () => void;
  onStatus: () => void;
  onInitiator: () => void;
  onReset: () => void;
  onDelete: () => void;
}> = ({ user, busy, onClose, onView, onEdit, onStatus, onInitiator, onReset, onDelete }) => {
  const item = (label: string, icon: React.ComponentType<{ className?: string }>, action: () => void, disabled = false, danger = false) => {
    const Icon = icon;
    return (
      <button
        disabled={disabled}
        onClick={() => {
          action();
          onClose();
        }}
        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-label-sm font-bold hover:bg-surface-container-low disabled:opacity-40 ${danger ? 'text-error' : 'text-on-surface'}`}
      >
        <Icon className="w-4 h-4" />
        {label}
      </button>
    );
  };
  return (
    <div className="absolute right-4 top-12 z-30 w-56 bg-surface-container-lowest border border-outline-variant rounded shadow-xl py-1">
      {item('View Profile', Eye, onView)}
      {item('Edit User', Edit2, onEdit)}
      {item(user.active ? 'Disable User' : 'Enable User', user.active ? ShieldOff : ShieldCheck, onStatus, busy, user.active)}
      {item(user.is_pssr_initiator ? 'Revoke Initiator' : 'Grant Initiator', user.is_pssr_initiator ? ShieldOff : ShieldCheck, onInitiator, busy || user.role !== 'TEAM_MEMBER', user.is_pssr_initiator)}
      {item('Reset Permissions', KeyRound, onReset, busy, true)}
      {item('Soft Delete', UserX, onDelete, busy || !user.active, true)}
    </div>
  );
};

const DepartmentDialog: React.FC<{
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: { code: string; name: string; description?: string }) => void;
}> = ({ busy, onClose, onSubmit }) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  return (
    <DialogShell title="Create Department" onClose={onClose} maxWidth="max-w-lg">
      <div className="p-5 space-y-4">
        <div className="rounded-lg border border-border bg-surface-container-low p-3">
          <p className="text-body-sm font-bold text-on-surface">This creates the department shell, then opens the setup wizard for units, annexures, permissions, personnel, and workflow routing.</p>
        </div>
        <Field label="Department Code" value={code} onChange={setCode} />
        <Field label="Department Name" value={name} onChange={setName} />
        <label className="block">
          <span className="text-label-sm font-bold text-on-surface-variant">Description</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 w-full min-h-28 px-3 py-2 border border-outline-variant rounded bg-surface text-body-sm outline-none focus:border-primary" />
        </label>
      </div>
      <DialogActions onClose={onClose} submitLabel="Create & Configure" disabled={busy || !code.trim() || !name.trim()} onSubmit={() => onSubmit({ code, name, description })} />
    </DialogShell>
  );
};

const UserEditDialog: React.FC<{ user: DepartmentUser; busy: boolean; onClose: () => void; onSubmit: (payload: UpdateUserPayload) => void }> = ({ user, busy, onClose, onSubmit }) => {
  const [form, setForm] = useState<UpdateUserPayload>({
    role: user.role,
    department: user.department,
    plant_location: user.plant_location ?? '',
    active: user.active,
  });
  const [initiatorEnabled, setInitiatorEnabled] = useState(user.is_pssr_initiator);
  const enableInitiator = useEnableInitiator();
  const disableInitiator = useDisableInitiator();
  const update = (field: keyof UpdateUserPayload, value: string | boolean) => setForm((current) => ({ ...current, [field]: value }));
  const save = () => {
    onSubmit(form);
    if (initiatorEnabled !== user.is_pssr_initiator) {
      const reason = `Updated from ${user.department || 'department'} personnel access panel.`;
      if (initiatorEnabled) {
        enableInitiator.mutate({ userId: user.id, reason });
      } else {
        disableInitiator.mutate({ userId: user.id, reason });
      }
    }
  };

  return (
    <DialogShell title="Personnel Access" onClose={onClose} maxWidth="max-w-2xl">
      <div className="p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ReadOnlyValue label="Employee ID" value={user.employee_id} />
          <ReadOnlyValue label="Employee Name" value={user.full_name} />
          <ReadOnlyValue label="Email" value={user.email} />
          <ReadOnlyValue label="Refinery Location" value={user.operational_unit || user.plant_location || 'Directory managed'} />
        </div>
        <TileSelector
          label="Workflow persona"
          value={form.role ?? 'TEAM_MEMBER'}
          options={USER_ROLE_TILE_OPTIONS}
          onChange={(value) => {
            update('role', value);
            if (value !== 'TEAM_MEMBER') setInitiatorEnabled(false);
          }}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Department" value={form.department ?? ''} onChange={(value) => update('department', value)} />
        <Field label="Operational Unit Assignment" value={form.plant_location ?? ''} onChange={(value) => update('plant_location', value)} />
        </div>
        <SegmentedControl label="PSSR initiator capability" value={initiatorEnabled ? 'ENABLED' : 'DISABLED'} options={[{ value: 'DISABLED', label: 'Standard team member' }, { value: 'ENABLED', label: 'Can initiate PSSR' }]} onChange={(value) => setInitiatorEnabled(value === 'ENABLED' && form.role === 'TEAM_MEMBER')} />
        {form.role !== 'TEAM_MEMBER' && <p className="text-body-sm font-semibold text-on-surface-variant">PSSR initiator access is available only to Department Team Members.</p>}
        <SegmentedControl label="Access status" value={form.active ? 'ACTIVE' : 'INACTIVE'} options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]} onChange={(value) => update('active', value === 'ACTIVE')} />
      </div>
      <DialogActions onClose={onClose} submitLabel="Save Access" disabled={busy || enableInitiator.isPending || disableInitiator.isPending} onSubmit={save} />
    </DialogShell>
  );
};

const UserDetailDialog: React.FC<{ user: DepartmentUser; onClose: () => void }> = ({ user, onClose }) => (
  <DialogShell title="User Profile" onClose={onClose} maxWidth="max-w-xl">
    <div className="p-5 space-y-4">
      <div>
        <p className="text-xl font-black text-on-surface">{user.full_name}</p>
        <p className="text-body-sm text-on-surface-variant">{user.employee_id} | {user.email}</p>
      </div>
      <ProfileGrid items={[
        ['Workflow Persona', optionLabel(ROLE_OPTIONS, user.role)],
        ['Department', user.department || 'Not assigned'],
        ['Designation', user.designation || 'Not assigned'],
        ['Operational Unit', user.operational_unit || user.plant_location || 'Not mapped'],
        ['PSSR Initiator Access', user.is_pssr_initiator ? 'Enabled' : 'Standard team member'],
        ['Area Owner Designation', user.role === 'AREA_OWNER' ? 'Yes' : 'No'],
        ['Status', user.active ? 'Active' : 'Inactive'],
        ['PSSR Workload', String(user.assigned_pssr_count)],
        ['Pending Tasks', String(user.pending_tasks_count ?? user.assigned_pssr_count)],
      ]} />
      <div>
        <p className="text-label-sm font-black text-outline uppercase mb-2">Annexure Responsibilities</p>
        <SummaryChips items={user.annexure_responsibilities.map((item) => ({ key: item.code, label: item.code, title: item.title }))} visible={6} empty="No annexure responsibilities mapped" />
      </div>
    </div>
  </DialogShell>
);

const ConfirmDialog: React.FC<{ state: NonNullable<ConfirmState>; onClose: () => void }> = ({ state, onClose }) => (
  <DialogShell title={state.title} onClose={onClose} maxWidth="max-w-md">
    <div className="p-5">
      <p className="text-body-sm text-on-surface-variant">{state.detail}</p>
    </div>
    <div className="px-5 py-4 border-t border-outline-variant flex justify-end gap-3">
      <button onClick={onClose} className="px-4 py-2 border border-outline-variant rounded text-label-md font-bold">Cancel</button>
      <button
        onClick={() => {
          state.onConfirm();
          onClose();
        }}
        className={`px-4 py-2 rounded text-label-md font-bold ${state.tone === 'danger' ? 'bg-error text-on-primary' : 'bg-primary text-on-primary'}`}
      >
        {state.actionLabel}
      </button>
    </div>
  </DialogShell>
);

const DialogShell: React.FC<{ title: string; onClose: () => void; maxWidth: string; children: React.ReactNode }> = ({ title, onClose, maxWidth, children }) => (
  <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
    <div className={`w-full ${maxWidth} max-h-[90vh] overflow-hidden bg-surface-container-lowest border border-outline-variant rounded shadow-2xl`}>
      <div className="px-5 py-4 border-b border-outline-variant flex items-center justify-between">
        <h3 className="text-headline-sm font-bold text-on-surface">{title}</h3>
        <button onClick={onClose} className="p-2 hover:bg-surface-container rounded" aria-label={`Close ${title}`}>
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="max-h-[calc(90vh-74px)] overflow-y-auto">{children}</div>
    </div>
  </div>
);

const DialogActions: React.FC<{ onClose: () => void; onSubmit: () => void; submitLabel: string; disabled?: boolean }> = ({ onClose, onSubmit, submitLabel, disabled }) => (
  <div className="px-5 py-4 border-t border-outline-variant flex justify-end gap-3">
    <button onClick={onClose} className="px-4 py-2 border border-outline-variant rounded text-label-md font-bold">Cancel</button>
    <button disabled={disabled} onClick={onSubmit} className="px-4 py-2 bg-primary text-on-primary rounded text-label-md font-bold disabled:opacity-50">{submitLabel}</button>
  </div>
);

const Select: React.FC<{ value: string; options: Array<[string, string]>; onChange: (value: string) => void }> = ({ value, options, onChange }) => (
  <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full px-3 py-2 border border-outline-variant rounded bg-surface-container-lowest text-body-sm outline-none focus:border-primary">
    {options.map(([optionValue, label]) => <option key={optionValue || label} value={optionValue}>{label}</option>)}
  </select>
);

const Field: React.FC<{ label: string; value: string; onChange: (value: string) => void }> = ({ label, value, onChange }) => (
  <label className="block">
    <span className="text-label-sm font-bold text-on-surface-variant">{label}</span>
    <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full px-3 py-2 border border-outline-variant rounded bg-surface text-body-sm outline-none focus:border-primary" />
  </label>
);

const ReadOnlyValue: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-lg border border-border bg-surface-container-low px-3 py-2">
    <p className="text-label-sm font-bold uppercase text-muted-foreground">{label}</p>
    <p className="mt-1 text-body-sm font-black text-on-surface wrap-break-words">{value}</p>
  </div>
);

const ActivityList: React.FC<{ rows: RefineryDepartment['activity_history']; empty: string }> = ({ rows, empty }) => (
  <div className="border border-outline-variant rounded bg-surface divide-y divide-outline-variant">
    {rows.length === 0 ? <EmptyPanel message={empty} /> : rows.map((row) => (
      <div key={row.id} className="p-4 flex gap-3">
        <div className="w-9 h-9 rounded bg-surface-container text-on-surface-variant flex items-center justify-center shrink-0">
          <History className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-body-sm font-black text-on-surface">{row.action.replaceAll('_', ' ')}</p>
          <p className="text-body-sm text-on-surface-variant mt-1">{row.summary}</p>
          <p className="text-[11px] text-outline mt-2">{row.actor_name || 'System'} · {new Date(row.created_at).toLocaleString()}</p>
        </div>
      </div>
    ))}
  </div>
);

const SectionHeader: React.FC<{ title: string; detail: string }> = ({ title, detail }) => (
  <div>
    <h3 className="text-headline-sm font-black text-on-surface">{title}</h3>
    <p className="text-body-sm text-on-surface-variant mt-1">{detail}</p>
  </div>
);

const Metric: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="bg-surface-container-lowest border border-outline-variant rounded p-4 shadow-sm">
    <p className="text-[10px] font-black text-outline uppercase">{label}</p>
    <p className="text-3xl font-black text-on-surface mt-1">{value}</p>
  </div>
);

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

const LoadingRows: React.FC<{ compact?: boolean }> = ({ compact }) => (
  <div className={`${compact ? 'p-3' : 'p-6'} space-y-3`}>
    {[0, 1, 2].map((item) => (
      <div key={item} className={`${compact ? 'h-16' : 'h-20'} bg-surface-container-low rounded animate-pulse`} />
    ))}
  </div>
);
