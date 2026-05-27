import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock, AlertCircle, FileText, Terminal, BadgeCheck, ClipboardList, PlusCircle, X, Save, Send, UserRound, ListChecks, Search } from 'lucide-react';
import { motion } from 'motion/react';

import { PageTitle } from '../../components/shared/UIItems';
import { ActivityFeedSkeleton, DashboardCardSkeleton } from '../../components/shared/Skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useTeamDirectory } from '../../hooks/useTeamDirectory';
import { useTeamMemberDashboard } from '../../hooks/useTeamMemberDashboard';
import type { AdminUser } from '../../services/api';
import type { TeamDashboardTask } from '../../types/team-dashboard.types';
import { canInitiatePSSR } from '../../utils/rbac';

type TeamDashboardTab = 'todo' | 'inprogress' | 'completed';
type PSSRKind = 'MOC' | 'NON_MOC';
type DepartmentName = 'Safety / PSM' | 'Operations' | 'Process' | 'Mechanical' | 'Inspection' | 'Civil' | 'Electrical' | 'Instrumentation' | 'Fire' | 'Others';

interface PSSRTeamMemberRow {
  department: DepartmentName;
  employeeId: string;
}

interface PSSRFormState {
  plantUnit: string;
  date: string;
  time: string;
  equipmentSystem: string;
  type: PSSRKind;
  mocNumber: string;
  leaderId: string;
  teamMembers: PSSRTeamMemberRow[];
  questionnaireEnabled: boolean;
  annexure: string;
}

const emptyTasks: TeamDashboardTask[] = [];

const PSSR_DEPARTMENTS: DepartmentName[] = [
  'Safety / PSM',
  'Operations',
  'Process',
  'Mechanical',
  'Inspection',
  'Civil',
  'Electrical',
  'Instrumentation',
  'Fire',
  'Others',
];

const ANNEXURE_OPTIONS = [
  { value: 'annexure-01', label: 'Annexure 1 - Document Review' },
  { value: 'annexure-02', label: 'Annexure 2 - Safety Signage & Area Readiness' },
  { value: 'annexure-03', label: 'Annexure 3 - Process Readiness' },
  { value: 'annexure-04', label: 'Annexure 4 - Mechanical Readiness' },
  { value: 'annexure-05', label: 'Annexure 5 - Electrical Readiness' },
  { value: 'annexure-06', label: 'Annexure 6 - Instrumentation Readiness' },
];

const defaultPSSRForm = (): PSSRFormState => ({
  plantUnit: '',
  date: new Date().toISOString().slice(0, 10),
  time: new Date().toTimeString().slice(0, 5),
  equipmentSystem: '',
  type: 'NON_MOC',
  mocNumber: '',
  leaderId: '',
  teamMembers: PSSR_DEPARTMENTS.map((department) => ({ department, employeeId: '' })),
  questionnaireEnabled: false,
  annexure: 'annexure-02',
});

export const TeamMemberDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TeamDashboardTab>('todo');
  const [showPSSRForm, setShowPSSRForm] = useState(false);
  const { user } = useAuth();
  const { data, isLoading, error } = useTeamMemberDashboard();

  const todo = data?.todo ?? emptyTasks;
  const inProgress = data?.in_progress ?? emptyTasks;
  const completed = data?.completed ?? emptyTasks;
  const activity = data?.activity ?? [];
  const isInitiator = canInitiatePSSR(user);

  const stats = useMemo(() => {
    const dashboardStats = data?.stats;
    return [
      { label: 'To Do', value: String(dashboardStats?.todo_count ?? 0), icon: Clock, trend: 'Assigned', color: 'text-tertiary' },
      { label: 'In Progress', value: String(dashboardStats?.in_progress_count ?? 0), icon: AlertCircle, trend: 'Active Work', color: 'text-primary' },
      { label: 'Completed', value: String(dashboardStats?.completed_count ?? 0), icon: CheckCircle2, trend: 'Submitted', color: 'text-green-600' },
      { label: 'Pending Review', value: String(dashboardStats?.pending_review_count ?? 0), icon: FileText, trend: 'Review Queue', color: 'text-on-surface-variant' },
    ];
  }, [data?.stats]);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <PageTitle title="My Work Dashboard" subtitle="Loading assigned PSSR work..." breadcrumbs={['My Work', 'Dashboard']} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[0, 1, 2, 3].map((item) => <DashboardCardSkeleton key={item} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant p-6 rounded shadow-sm">
            <ActivityFeedSkeleton />
          </div>
          <div className="bg-surface-container-highest border border-on-surface/5 p-6 rounded shadow-sm">
            <ActivityFeedSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageTitle title="My Work Dashboard" subtitle="Unable to load assigned work." breadcrumbs={['My Work', 'Dashboard']} />
        <div className="bg-error/5 border border-error/20 rounded p-6">
          <p className="text-error font-black uppercase tracking-wider">Dashboard Load Failed</p>
          <p className="text-body-sm text-on-surface-variant mt-2">{error.message}</p>
        </div>
      </div>
    );
  }

  const visibleTasks = activeTab === 'todo' ? todo : activeTab === 'inprogress' ? inProgress : completed;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <PageTitle
          title={isInitiator ? 'PSSR Initiator Dashboard' : 'My Work Dashboard'}
          subtitle={isInitiator ? 'Create new PSSR workflows and track records you own, are assigned to, or that involve your department.' : 'Manage assigned PSSR tasks and track completion status.'}
          breadcrumbs={['My Work', 'Dashboard']}
        />
        {isInitiator && (
          <span className="inline-flex items-center gap-2 px-3 py-2 bg-primary/10 text-primary border border-primary/20 rounded text-label-md font-black uppercase w-fit">
            <BadgeCheck className="w-4 h-4" />
            PSSR INITIATOR
          </span>
        )}
      </div>

      {isInitiator && (
        <div className="bg-surface-container-lowest border border-primary/25 rounded shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-outline-variant flex items-center justify-between">
            <div>
              <h2 className="text-headline-sm font-bold text-on-surface">Initiator Workflow</h2>
              <p className="text-body-sm text-on-surface-variant">Your capability is user-based. It permits new PSSR creation without changing your TEAM_MEMBER role.</p>
            </div>
            <ClipboardList className="w-5 h-5 text-primary" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-0 border-b border-outline-variant">
            {[
              { label: 'Draft PSSR', value: data?.initiator_stats.draft_pssr ?? 0 },
              { label: 'In Progress', value: data?.initiator_stats.in_progress ?? 0 },
              { label: 'Area Owner Approval', value: data?.initiator_stats.pending_area_owner_approval ?? 0 },
              { label: 'Approved', value: data?.initiator_stats.approved ?? 0 },
              { label: 'Punch Points', value: data?.initiator_stats.open_punch_points ?? 0 },
              { label: 'My PSSR', value: data?.initiator_stats.my_pssr ?? 0 },
            ].map((item) => (
              <div key={item.label} className="p-4 border-b md:border-b-0 md:border-r last:border-r-0 border-outline-variant">
                <p className="text-[10px] font-black text-outline uppercase">{item.label}</p>
                <p className="text-2xl font-black text-on-surface mt-1">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-label-md font-black uppercase">Workflow Ownership</h3>
              <p className="text-body-sm text-on-surface-variant mt-1">Dashboard data remains scoped to created records, assigned work, and department involvement.</p>
            </div>
            <button
              onClick={() => setShowPSSRForm(true)}
              className="inline-flex items-center justify-center gap-2 bg-primary text-on-primary px-4 py-2 rounded text-label-md font-bold shadow-sm hover:bg-primary/90 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Create New PSSR
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-surface-container-lowest border border-outline-variant p-5 rounded shadow-sm group hover:border-primary transition-colors"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-surface-container-low rounded">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <span className="text-[10px] font-black tracking-widest text-outline uppercase">{stat.trend}</span>
            </div>
            <p className="text-label-sm text-outline uppercase tracking-wider mb-1 font-bold">{stat.label}</p>
            <h3 className="text-3xl font-black text-on-surface">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant p-6 rounded shadow-sm min-h-[560px]">
          <div className="flex flex-wrap gap-2 mb-6 border-b border-outline-variant pb-4">
            <TabButton active={activeTab === 'todo'} onClick={() => setActiveTab('todo')} label={`To Do (${todo.length})`} />
            <TabButton active={activeTab === 'inprogress'} onClick={() => setActiveTab('inprogress')} label={`In Progress (${inProgress.length})`} />
            <TabButton active={activeTab === 'completed'} onClick={() => setActiveTab('completed')} label={`Completed (${completed.length})`} />
          </div>

          <div className="space-y-3">
            {visibleTasks.length === 0 ? (
              <EmptyPanel message="No live PSSR work is assigned in this queue." />
            ) : (
              visibleTasks.map((item, idx) => (
                <TaskCard key={item.id} task={item} tab={activeTab} index={idx} />
              ))
            )}
          </div>
        </div>

        <div className="bg-surface-container-highest border border-on-surface/5 p-6 rounded shadow-sm text-on-surface min-h-[560px]">
          <div className="flex items-center space-x-2 mb-6">
            <Terminal className="w-4 h-4 text-primary" />
            <h3 className="text-label-md font-black uppercase tracking-widest">Recent Activity</h3>
          </div>
          <div className="space-y-4 font-mono text-[11px] leading-relaxed opacity-80">
            {activity.length === 0 ? (
              <p className="text-on-surface-variant">No recent activity available.</p>
            ) : (
              activity.map((item) => (
                <div key={item.id} className="border-l-2 border-primary pl-3 py-1">
                  <p className="text-on-surface-variant italic">{item.timestamp}</p>
                  <p className="text-on-surface font-bold underline">{item.action}</p>
                  <p className="text-on-surface-variant text-[10px]">{item.pssr_id}: {item.detail}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showPSSRForm && <CreatePSSRPanel onClose={() => setShowPSSRForm(false)} />}
    </div>
  );
};

export const TeamDashboardPage = TeamMemberDashboard;

const CreatePSSRPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [form, setForm] = useState<PSSRFormState>(() => defaultPSSRForm());
  const [activeDirectorySearch, setActiveDirectorySearch] = useState('');
  const [directorySearches, setDirectorySearches] = useState<Record<string, string>>({});
  const [selectedUsers, setSelectedUsers] = useState<Record<string, AdminUser>>({});
  const debouncedDirectorySearch = useDebouncedValue(activeDirectorySearch, 350);
  const directoryQuery = useTeamDirectory({
    page: 1,
    limit: 100,
    search: debouncedDirectorySearch.trim() || undefined,
  });
  const directoryUsers = useMemo(() => {
    const byId = new Map<string, AdminUser>();
    Object.values(selectedUsers).forEach((employee) => byId.set(String(employee.id), employee));
    directoryQuery.data?.records.forEach((employee) => byId.set(String(employee.id), employee));
    return Array.from(byId.values());
  }, [directoryQuery.data?.records, selectedUsers]);
  const leader = selectedUsers[form.leaderId] ?? directoryUsers.find((employee) => String(employee.id) === form.leaderId);
  const selectedAnnexure = ANNEXURE_OPTIONS.find((annexure) => annexure.value === form.annexure);

  const update = <K extends keyof PSSRFormState>(key: K, value: PSSRFormState[K]) => {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'type' && value === 'NON_MOC' ? { mocNumber: '' } : {}),
    }));
  };

  const rememberUser = (employee: AdminUser | undefined) => {
    if (!employee) return;
    setSelectedUsers((current) => ({ ...current, [String(employee.id)]: employee }));
  };

  const updateDirectorySearch = (key: string, value: string) => {
    setDirectorySearches((current) => ({ ...current, [key]: value }));
    setActiveDirectorySearch(value);
  };

  const updateMember = (department: DepartmentName, employee: AdminUser | undefined) => {
    setForm((current) => ({
      ...current,
      teamMembers: current.teamMembers.map((row) => row.department === department ? { ...row, employeeId: employee ? String(employee.id) : '' } : row),
    }));
    rememberUser(employee);
  };

  const employeeById = (employeeId: string) => selectedUsers[employeeId] ?? directoryUsers.find((employee) => String(employee.id) === employeeId);

  const membersWithEmployees = form.teamMembers.map((row) => ({
    ...row,
    employee: employeeById(row.employeeId),
  }));

  return (
    <div className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-sm p-3 md:p-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-7xl bg-surface-container-lowest border border-outline-variant rounded shadow-xl"
      >
        <div className="sticky top-0 z-10 bg-surface-container-lowest border-b border-outline-variant px-4 md:px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">Frontend draft</p>
            <h2 className="text-headline-sm font-black text-on-surface">Create New PSSR</h2>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center justify-center gap-2 border border-outline-variant px-3 py-2 rounded text-label-md font-bold text-on-surface hover:bg-surface-container-low">
              <Save className="w-4 h-4" />
              Save Draft
            </button>
            <button className="inline-flex items-center justify-center gap-2 bg-primary text-on-primary px-3 py-2 rounded text-label-md font-bold hover:bg-primary/90">
              <Send className="w-4 h-4" />
              Submit
            </button>
            <button
              onClick={onClose}
              aria-label="Close create PSSR form"
              className="inline-flex h-10 w-10 items-center justify-center border border-outline-variant rounded text-on-surface hover:bg-surface-container-low"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 md:p-6 space-y-6">
          <section className="border border-outline-variant rounded overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_180px_160px] border-b border-outline-variant">
              <LabeledInput label="Name of Plant / Unit" value={form.plantUnit} onChange={(value) => update('plantUnit', value)} placeholder="Enter plant or unit" />
              <LabeledInput label="Date" type="date" value={form.date} onChange={(value) => update('date', value)} />
              <LabeledInput label="Time" type="time" value={form.time} onChange={(value) => update('time', value)} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] border-b border-outline-variant">
              <div className="bg-surface-container-low px-4 py-3 text-label-md font-black text-on-surface border-b lg:border-b-0 lg:border-r border-outline-variant">Equipment / System</div>
              <input
                value={form.equipmentSystem}
                onChange={(event) => update('equipmentSystem', event.target.value)}
                placeholder="Enter equipment or system"
                className="w-full px-4 py-3 bg-transparent text-body-sm text-on-surface outline-none"
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr]">
              <div className="bg-surface-container-low px-4 py-3 text-label-md font-black text-on-surface border-b lg:border-b-0 lg:border-r border-outline-variant">PSSR Type</div>
              <div className="p-3 flex flex-col md:flex-row gap-3">
                <SegmentChoice label="Non MOC PSSR" active={form.type === 'NON_MOC'} onClick={() => update('type', 'NON_MOC')} />
                <SegmentChoice label="MOC PSSR" active={form.type === 'MOC'} onClick={() => update('type', 'MOC')} />
              </div>
            </div>
            {form.type === 'MOC' && (
              <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] border-t border-outline-variant">
                <div className="bg-surface-container-low px-4 py-3 text-label-md font-black text-on-surface border-b lg:border-b-0 lg:border-r border-outline-variant">MOC Number & Description</div>
                <input
                  value={form.mocNumber}
                  onChange={(event) => update('mocNumber', event.target.value)}
                  placeholder="Enter MOC number and brief description"
                  className="w-full px-4 py-3 bg-transparent text-body-sm text-on-surface outline-none"
                />
              </div>
            )}
          </section>

          <section className="border border-outline-variant rounded overflow-hidden">
            <div className="bg-surface-container-low px-4 py-3 border-b border-outline-variant flex items-center gap-2">
              <UserRound className="w-4 h-4 text-primary" />
              <h3 className="text-label-md font-black uppercase text-on-surface">PSSR Team Leader</h3>
            </div>
            <DirectoryStatus query={directoryQuery} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left border-collapse">
                <thead className="bg-surface-container-low text-[11px] uppercase text-on-surface">
                  <tr>
                    <th className="px-3 py-3 border-r border-outline-variant w-[34%]">Name of PSSR Team Leader</th>
                    <th className="px-3 py-3 border-r border-outline-variant">Emp. Code</th>
                    <th className="px-3 py-3 border-r border-outline-variant">Designation</th>
                    <th className="px-3 py-3 border-r border-outline-variant">Dept.</th>
                    <th className="px-3 py-3">Sign</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-outline-variant">
                    <td className="px-3 py-2 border-r border-outline-variant">
                      <UserDirectorySelect
                        value={form.leaderId}
                        onChange={(employee) => {
                          update('leaderId', employee ? String(employee.id) : '');
                          rememberUser(employee);
                        }}
                        users={directoryUsers}
                        search={directorySearches.leader ?? ''}
                        onSearch={(value) => updateDirectorySearch('leader', value)}
                        placeholder="Search leader by name, email, or ID"
                        loading={directoryQuery.isFetching}
                      />
                    </td>
                    <AutoCell value={leader?.employee_id} />
                    <AutoCell value={leader?.designation} />
                    <AutoCell value={leader?.department} />
                    <td className="px-3 py-2 text-body-sm text-on-surface-variant">Pending e-sign</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="border border-outline-variant rounded overflow-hidden">
            <div className="bg-surface-container-low px-4 py-3 border-b border-outline-variant flex items-center gap-2">
              <UserRound className="w-4 h-4 text-primary" />
              <h3 className="text-label-md font-black uppercase text-on-surface">PSSR Team Members</h3>
            </div>
            <DirectoryStatus query={directoryQuery} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left border-collapse">
                <thead className="bg-surface-container-low text-[11px] uppercase text-on-surface">
                  <tr>
                    <th className="px-3 py-3 border-r border-outline-variant w-[30%]">Name of PSSR Team Members</th>
                    <th className="px-3 py-3 border-r border-outline-variant">Emp. Code</th>
                    <th className="px-3 py-3 border-r border-outline-variant">Designation</th>
                    <th className="px-3 py-3 border-r border-outline-variant">Dept.</th>
                    <th className="px-3 py-3">Sign</th>
                  </tr>
                </thead>
                <tbody>
                  {membersWithEmployees.map((row) => (
                    <tr key={row.department} className="border-t border-outline-variant">
                      <td className="px-3 py-2 border-r border-outline-variant">
                        <UserDirectorySelect
                          value={row.employeeId}
                          onChange={(employee) => updateMember(row.department, employee)}
                          users={directoryUsers.filter((employee) => departmentMatches(row.department, employee.department))}
                          search={directorySearches[row.department] ?? ''}
                          onSearch={(value) => updateDirectorySearch(row.department, value)}
                          placeholder={`Search ${row.department} member`}
                          loading={directoryQuery.isFetching}
                        />
                      </td>
                      <AutoCell value={row.employee?.employee_id} />
                      <AutoCell value={row.employee?.designation} />
                      <td className="px-3 py-2 border-r border-outline-variant text-body-sm font-bold text-on-surface">{row.employee?.department ?? row.department}</td>
                      <td className="px-3 py-2 text-body-sm text-on-surface-variant">Pending e-sign</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="border border-outline-variant rounded overflow-hidden">
            <div className="bg-surface-container-low px-4 py-3 border-b border-outline-variant flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-primary" />
                <h3 className="text-label-md font-black uppercase text-on-surface">Questionnaire</h3>
              </div>
              <label className="inline-flex items-center gap-2 text-label-md font-bold text-on-surface">
                <input
                  type="checkbox"
                  checked={form.questionnaireEnabled}
                  onChange={(event) => update('questionnaireEnabled', event.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                Attach questionnaire
              </label>
            </div>
            {form.questionnaireEnabled && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
                  <label className="space-y-2">
                    <span className="text-label-sm font-black uppercase text-outline">Choose annexure</span>
                    <select
                      value={form.annexure}
                      onChange={(event) => update('annexure', event.target.value)}
                      className="w-full border border-outline-variant rounded bg-surface-container-lowest px-3 py-2 text-body-sm text-on-surface outline-none focus:border-primary"
                    >
                      {ANNEXURE_OPTIONS.map((annexure) => (
                        <option key={annexure.value} value={annexure.value}>{annexure.label}</option>
                      ))}
                    </select>
                  </label>
                  <button className="inline-flex items-center justify-center gap-2 self-end bg-primary text-on-primary px-4 py-2 rounded text-label-md font-bold hover:bg-primary/90">
                    <PlusCircle className="w-4 h-4" />
                    Add Questions From Annexure
                  </button>
                </div>

                <div className="overflow-x-auto border border-outline-variant rounded">
                  <table className="w-full min-w-[760px] text-left border-collapse">
                    <thead className="bg-surface-container-low text-[11px] uppercase text-on-surface">
                      <tr>
                        <th className="px-3 py-3 border-r border-outline-variant w-20">S. N</th>
                        <th className="px-3 py-3 border-r border-outline-variant">Description</th>
                        <th className="px-3 py-3 border-r border-outline-variant">Category of Punch Point</th>
                        <th className="px-3 py-3 border-r border-outline-variant">Checked by</th>
                        <th className="px-3 py-3">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {membersWithEmployees.filter((row) => row.employee).map((row, index) => (
                        <tr key={row.department} className="border-t border-outline-variant">
                          <td className="px-3 py-3 border-r border-outline-variant text-body-sm">{index + 1}</td>
                          <td className="px-3 py-3 border-r border-outline-variant text-body-sm text-on-surface-variant">{selectedAnnexure?.label}</td>
                          <td className="px-3 py-3 border-r border-outline-variant text-body-sm">{row.department}</td>
                          <td className="px-3 py-3 border-r border-outline-variant text-body-sm font-bold text-on-surface">{row.employee?.full_name}</td>
                          <td className="px-3 py-3 text-body-sm text-on-surface-variant">-</td>
                        </tr>
                      ))}
                      {membersWithEmployees.every((row) => !row.employee) && (
                        <tr>
                          <td colSpan={5} className="px-3 py-5 text-center text-body-sm text-on-surface-variant">
                            Select PSSR team members to auto-populate the checked by column.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>
      </motion.div>
    </div>
  );
};

interface LabeledInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: React.HTMLInputTypeAttribute;
  placeholder?: string;
}

const LabeledInput: React.FC<LabeledInputProps> = ({ label, value, onChange, type = 'text', placeholder }) => (
  <label className="grid grid-cols-1 border-b lg:border-b-0 lg:border-r last:border-r-0 border-outline-variant">
    <span className="bg-surface-container-low px-4 py-2 text-label-md font-black text-on-surface border-b border-outline-variant">{label}</span>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full px-4 py-3 bg-transparent text-body-sm text-on-surface outline-none"
    />
  </label>
);

const SegmentChoice: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-4 py-2 rounded border text-label-md font-bold transition-colors ${active ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-lowest text-on-surface border-outline-variant hover:border-primary'}`}
  >
    {label}
  </button>
);

const UserDirectorySelect: React.FC<{
  value: string;
  onChange: (employee: AdminUser | undefined) => void;
  users: AdminUser[];
  search: string;
  onSearch: (value: string) => void;
  placeholder: string;
  loading?: boolean;
}> = ({ value, onChange, users, search, onSearch, placeholder, loading }) => {
  const selected = users.find((employee) => String(employee.id) === value);
  const visibleUsers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((employee) => userSearchText(employee).includes(needle));
  }, [search, users]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={selected ? `${selected.full_name} (${selected.employee_id})` : placeholder}
          className="h-10 w-full rounded border border-outline-variant bg-surface-container-lowest pl-9 pr-3 text-body-sm text-on-surface outline-none focus:border-primary"
        />
      </div>
      <select
        value={value}
        onChange={(event) => onChange(users.find((employee) => String(employee.id) === event.target.value))}
        className="w-full min-w-0 border border-outline-variant rounded bg-surface-container-lowest px-3 py-2 text-body-sm text-on-surface outline-none focus:border-primary"
      >
        <option value="">{loading ? 'Searching user directory...' : 'Select from user directory'}</option>
        {visibleUsers.map((employee) => (
          <option key={employee.id} value={employee.id}>
            {employee.full_name} | {employee.employee_id} | {employee.email}
          </option>
        ))}
      </select>
    </div>
  );
};

const DirectoryStatus: React.FC<{ query: { isFetching: boolean; error: Error | null; data?: { pagination: { total_records: number } } } }> = ({ query }) => {
  if (query.error) {
    return (
      <div className="border-b border-outline-variant bg-error/5 px-4 py-2 text-body-sm font-semibold text-error">
        User directory could not be loaded: {query.error.message}
      </div>
    );
  }

  return (
    <div className="border-b border-outline-variant bg-surface-container-lowest px-4 py-2 text-label-sm font-bold text-on-surface-variant">
      {query.isFetching ? 'Searching user directory...' : `Showing user directory results${query.data ? ` (${query.data.pagination.total_records} matched)` : ''}. Search by name, email, or employee ID.`}
    </div>
  );
};

function userSearchText(employee: AdminUser): string {
  return `${employee.full_name} ${employee.email} ${employee.employee_id} ${employee.department ?? ''} ${employee.designation ?? ''}`.toLowerCase();
}

function departmentMatches(rowDepartment: DepartmentName, userDepartment?: string | null): boolean {
  const department = (userDepartment ?? '').toLowerCase();
  if (!department) return rowDepartment === 'Others';
  if (rowDepartment === 'Safety / PSM') return department.includes('safety') || department.includes('psm');
  if (rowDepartment === 'Operations') return department.includes('operation');
  if (rowDepartment === 'Instrumentation') return department.includes('instrument');
  if (rowDepartment === 'Others') return department.includes('other') || department.includes('it') || department.includes('admin');
  return department.includes(rowDepartment.toLowerCase());
}

const AutoCell: React.FC<{ value?: string }> = ({ value }) => (
  <td className="px-3 py-2 border-r border-outline-variant text-body-sm text-on-surface">
    {value ?? <span className="text-on-surface-variant">Auto-filled</span>}
  </td>
);

interface TabButtonProps {
  active: boolean;
  label: string;
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ active, label, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 text-label-md font-bold uppercase transition-all ${active ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-primary'}`}
  >
    {label}
  </button>
);

interface TaskCardProps {
  task: TeamDashboardTask;
  tab: TeamDashboardTab;
  index: number;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, tab, index }) => (
  <motion.div
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: index * 0.05 }}
    className="border border-outline-variant p-4 rounded hover:bg-surface-container-low transition-colors bg-surface-container-lowest shadow-sm"
  >
    <div className="flex justify-between items-start mb-3 gap-4">
      <div className="flex-1">
        <p className="text-label-md font-bold text-on-surface">{task.id}</p>
        <p className="text-body-sm text-on-surface-variant mt-1">{task.pssr_title}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-[11px] text-on-surface-variant">
          <span>Unit: <span className="font-bold text-on-surface">{task.unit}</span></span>
          {task.department && <span>Department: <span className="font-bold text-on-surface">{task.department}</span></span>}
          {task.due_date && <span>Due: <span className="font-bold text-error">{task.due_date}</span></span>}
          {task.submitted_date && <span>Submitted: <span>{task.submitted_date}</span></span>}
          {task.priority && <span className={`font-bold px-2 py-0.5 rounded ${priorityClass(task.priority)}`}>{task.priority}</span>}
          {tab === 'inprogress' && <span>Answered: <span className="font-bold text-primary">{task.questions_answered}/{task.total_questions}</span></span>}
        </div>
      </div>
    </div>

    {tab === 'inprogress' && (
      <div className="mb-3">
        <div className="flex justify-between text-label-xs font-bold mb-1">
          <span className="text-on-surface-variant">Progress</span>
          <span className="text-primary">{task.progress}%</span>
        </div>
        <div className="h-2 bg-surface-container-low rounded-full overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${task.progress}%` }} transition={{ delay: 0.3, duration: 1 }} className="h-full bg-primary" />
        </div>
      </div>
    )}

    {task.reviewer_name && (
      <p className="text-label-xs text-on-surface-variant mb-3">Reviewed by: <span className="font-bold text-on-surface">{task.reviewer_name}</span></p>
    )}

    <div className="flex space-x-2 pt-3 border-t border-outline-variant">
      {tab === 'todo' && (
        <>
          <button className="text-label-sm font-bold text-primary hover:underline">Start</button>
          <button className="text-label-sm font-bold text-primary hover:underline">Details</button>
        </>
      )}
      {tab === 'inprogress' && (
        <>
          <button className="text-label-sm font-bold text-primary hover:underline">Continue</button>
          <button className="text-label-sm font-bold text-primary hover:underline">Upload</button>
        </>
      )}
      {tab === 'completed' && task.status === 'Completed' && (
        <span className="text-label-sm font-bold text-green-600 flex items-center space-x-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Completed</span>
        </span>
      )}
      {tab === 'completed' && task.status === 'Pending Review' && (
        <span className="text-label-sm font-bold text-primary flex items-center space-x-1">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Pending Review</span>
        </span>
      )}
    </div>
  </motion.div>
);

function priorityClass(priority: TeamDashboardTask['priority']): string {
  if (priority === 'CRITICAL' || priority === 'HIGH') return 'bg-error/10 text-error';
  if (priority === 'MEDIUM') return 'bg-tertiary/10 text-tertiary';
  return 'bg-outline/10 text-outline';
}

const EmptyPanel: React.FC<{ message: string }> = ({ message }) => (
  <div className="border border-outline-variant p-6 rounded text-center bg-surface-container-low">
    <p className="text-label-md font-black text-on-surface uppercase tracking-widest">{message}</p>
  </div>
);
