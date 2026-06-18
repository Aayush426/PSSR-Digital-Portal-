import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, AlertCircle, Terminal, BadgeCheck, ClipboardList, PlusCircle, X, Save, Send, UserRound, ListChecks, Search, UserCheck, RefreshCw, ChevronDown, Filter, Trash2, UsersRound } from 'lucide-react';
import { motion } from 'motion/react';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';

import { PageTitle } from '../../components/shared/UIItems';
import { ActivityFeedSkeleton, DashboardCardSkeleton } from '../../components/shared/Skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { useAnnexureDetail, useAnnexures } from '../../hooks/useAnnexures';
import { useCreatePSSR } from '../../hooks/useCreatePSSR';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { usePSSRDetail } from '../../hooks/usePSSRDetail';
import { useTeamDirectory } from '../../hooks/useTeamDirectory';
import { useTeamMemberDashboard } from '../../hooks/useTeamMemberDashboard';
import { annexureService } from '../../services/annexureService';
import { api, type AdminUser, type CheckpointAttachment, type CheckpointAttachmentPayload, type PSSRWorkflowDetail } from '../../services/api';
import type { AnnexureQuestion, AnnexureSummary } from '../../types/annexure.types';
import type { TeamDashboardTask } from '../../types/team-dashboard.types';
import { canInitiatePSSR } from '../../utils/rbac';

type TeamDashboardTab = 'preparation' | 'todo' | 'in_progress' | 'completed' | 'approval' | 'approved' | 'closed' | 'rejected' | 'assigned_punch_points';
type PSSRDetailTab = 'details' | 'punchlist' | 'assigned_punch_points' | 'history';
type PSSRKind = 'MOC' | 'NON_MOC';
type DepartmentName = string;
type CheckpointType = 'DOCUMENT' | 'FIELD';
type PunchPoint = NonNullable<PSSRWorkflowDetail['punch_points']>[number];
type PunchPayload = {
  title: string;
  description: string;
  category: 'A' | 'B' | 'C';
  owning_department: string;
  assigned_to_user_id?: number | null;
  due_date?: string | null;
  progress_remarks?: string | null;
  closure_remarks?: string | null;
  closure_evidence?: string | null;
  status?: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  question_id?: number | null;
};

interface PSSRTeamMemberRow {
  department: DepartmentName;
  employeeIds: string[];
}

interface PSSRCustomQuestion {
  id: string;
  questionText: string;
  description: string;
  checkpointType: CheckpointType;
  departmentOwner: DepartmentName;
  assignedMemberId: string;
  category: string;
  mandatory: boolean;
  remarks: string;
  attachments: Array<{ name: string; size: number; type: string }>;
}

interface SelectedChecklistQuestion {
  id: string;
  source: 'annexure' | 'custom';
  annexureId?: number;
  annexureCode: string;
  annexureTitle: string;
  questionId?: number;
  questionText: string;
  checkpointType: CheckpointType;
  departmentOwner: DepartmentName;
  assignedMemberId: string;
  category: string;
  mandatory: boolean;
  preview?: string | null;
  punchCategory: string;
  remarks?: string | null;
  attachments?: Array<Record<string, unknown>>;
}

interface MemberDisplayUser {
  id: number;
  employee_id: string;
  full_name: string;
  email: string;
  department?: string | null;
  designation?: string | null;
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
  annexureIds: string[];
  customQuestions: PSSRCustomQuestion[];
}

const emptyTasks: TeamDashboardTask[] = [];

const PSSR_DEPARTMENTS: DepartmentName[] = [
  'Safety / PSM',
  'PM Operation',
  'Process',
  'Mechanical',
  'Inspection',
  'Civil',
  'Electrical',
  'Instrumentation',
  'Fire',
  'Others',
];

const SELECT_FIELD_CLASS = 'rounded border border-outline-variant bg-surface-container-lowest px-3 text-body-sm text-on-surface outline-none focus:border-primary disabled:bg-surface-container-low disabled:text-on-surface-variant disabled:opacity-60 [&_option]:bg-surface-container-lowest [&_option]:text-on-surface';

const defaultPSSRForm = (): PSSRFormState => ({
  plantUnit: '',
  date: new Date().toISOString().slice(0, 10),
  time: new Date().toTimeString().slice(0, 5),
  equipmentSystem: '',
  type: 'NON_MOC',
  mocNumber: '',
  leaderId: '',
  teamMembers: PSSR_DEPARTMENTS.map((department) => ({ department, employeeIds: [] })),
  questionnaireEnabled: false,
  annexureIds: [],
  customQuestions: [],
});

function useScrollLock() {
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = originalStyle; };
  }, []);
}

export const TeamMemberDashboard: React.FC = () => {
  const isAssignedWorkspace = window.location.pathname.startsWith('/team/assigned');
  const isInitiatedWorkspace = window.location.pathname.startsWith('/team/initiated');
  const isDashboardWorkspace = window.location.pathname === '/team/dashboard';
  const [activeTab, setActiveTab] = useState<TeamDashboardTab>(isAssignedWorkspace ? 'todo' : 'preparation');
  const [showPSSRForm, setShowPSSRForm] = useState(false);
  const [detailPSSRId, setDetailPSSRId] = useState<string | undefined>();
  const { user } = useAuth();
  const { data, isLoading, error } = useTeamMemberDashboard();

  const monitorOnly = (task: TeamDashboardTask) => task.ownership === 'initiator';
  const executionOnly = (task: TeamDashboardTask) => task.ownership !== 'initiator';
  const initiatedTasks = [
    ...(data?.draft ?? emptyTasks),
    ...(data?.todo ?? emptyTasks),
    ...(data?.assigned ?? emptyTasks),
    ...(data?.in_progress ?? emptyTasks),
    ...(data?.completed ?? emptyTasks),
    ...(data?.pending_review ?? emptyTasks),
    ...(data?.approved ?? emptyTasks),
  ].filter(monitorOnly);
  const underPreparation = isAssignedWorkspace ? emptyTasks : (data?.draft ?? []).filter(monitorOnly);
  const todo = isAssignedWorkspace
    ? (data?.assigned ?? data?.todo ?? emptyTasks).filter(executionOnly)
    : initiatedTasks.filter((task) => task.workflow_state === 'SUBMITTED' || task.workflow_state === 'TODO' || task.status === 'To Do');
  const inProgress = isAssignedWorkspace ? (data?.in_progress ?? emptyTasks).filter(executionOnly) : emptyTasks;
  const completed = isAssignedWorkspace
    ? (data?.completed ?? emptyTasks).filter(executionOnly)
    : initiatedTasks.filter((task) => task.workflow_state === 'COMPLETED_BY_DEPARTMENT' || task.workflow_state === 'COMPLETED_BY_TEAM' || task.workflow_state === 'COMPLETED');
  const pendingApproval = (data?.pending_review ?? emptyTasks).filter(monitorOnly);
  const approved = (data?.approved ?? emptyTasks).filter(monitorOnly);
  const assignedPunchPoints = data?.assigned_punch_points ?? emptyTasks;
  const closed = initiatedTasks.filter((task) => task.workflow_state === 'CLOSED');
  const rejected = initiatedTasks.filter((task) => task.workflow_state === 'REJECTED');
  const initiatedInProgress = initiatedTasks.filter((task) => task.workflow_state === 'IN_PROGRESS' || task.status === 'In Progress');
  const activity = data?.activity ?? [];
  const isInitiator = canInitiatePSSR(user);

  useEffect(() => {
    setActiveTab(isAssignedWorkspace ? 'todo' : 'preparation');
  }, [isAssignedWorkspace, isInitiatedWorkspace]);

  const stats = useMemo(() => {
    if (!isAssignedWorkspace) {
      return [
        { label: 'Under Preparation', value: String(underPreparation.length), icon: Clock, trend: 'Editable', color: 'text-tertiary' },
        { label: 'To Do', value: String(todo.length), icon: ClipboardList, trend: 'Submitted', color: 'text-primary' },
        { label: 'In Progress', value: String(initiatedInProgress.length), icon: AlertCircle, trend: 'Active', color: 'text-primary' },
        { label: 'Completed by Dept.', value: String(completed.length), icon: CheckCircle2, trend: 'Dept Done', color: 'text-green-600' },
        { label: 'Area Approval', value: String(pendingApproval.length), icon: AlertCircle, trend: 'Owner', color: 'text-tertiary' },
        { label: 'Approved', value: String(approved.filter((task) => task.workflow_state === 'APPROVED').length), icon: BadgeCheck, trend: 'Owner OK', color: 'text-green-700' },
      ];
    }
    return [
      { label: 'To Do', value: String(todo.length), icon: ClipboardList, trend: 'Ready', color: 'text-on-surface-variant' },
      { label: 'In Progress', value: String(inProgress.length), icon: AlertCircle, trend: 'Active Work', color: 'text-primary' },
      { label: 'Completed', value: String(completed.length), icon: CheckCircle2, trend: 'Done', color: 'text-green-600' },
      { label: 'Punch Points', value: String(assignedPunchPoints.length), icon: ClipboardList, trend: 'Assigned', color: 'text-tertiary' },
    ];
  }, [approved, assignedPunchPoints.length, completed.length, inProgress.length, initiatedInProgress.length, isAssignedWorkspace, pendingApproval.length, todo.length, underPreparation.length]);

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

  if (isDashboardWorkspace) {
    const summaryStats = isInitiator
      ? [
          { label: 'Total Drafts', value: String(underPreparation.length), icon: Clock, trend: 'Draft', color: 'text-tertiary' },
          { label: 'Total Active', value: String(todo.length + initiatedInProgress.length), icon: AlertCircle, trend: 'Live', color: 'text-primary' },
          { label: 'Pending Approvals', value: String(pendingApproval.length), icon: ClipboardList, trend: 'Area Owner', color: 'text-tertiary' },
          { label: 'Total Completed', value: String(completed.length + approved.filter((task) => task.workflow_state !== 'REJECTED').length), icon: CheckCircle2, trend: 'Done', color: 'text-green-600' },
        ]
      : [
          { label: 'To Do', value: String(todo.length), icon: ClipboardList, trend: 'Ready', color: 'text-on-surface-variant' },
          { label: 'In Progress', value: String(inProgress.length), icon: AlertCircle, trend: 'Active', color: 'text-primary' },
          { label: 'Completed', value: String(completed.length), icon: CheckCircle2, trend: 'Done', color: 'text-green-600' },
          { label: 'Recent Activity', value: String(activity.length), icon: Terminal, trend: 'Latest', color: 'text-primary' },
        ];
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <PageTitle
          title="Dashboard"
          subtitle="Summary of your PSSR workload and recent activity."
          breadcrumbs={['My Work', 'Dashboard']}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {summaryStats.map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-surface-container-lowest border border-outline-variant p-5 rounded shadow-sm"
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
        <div className="bg-surface-container-highest border border-on-surface/5 p-6 rounded shadow-sm text-on-surface">
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
    );
  }

  const visibleTasks = activeTab === 'preparation'
    ? underPreparation
    : activeTab === 'assigned_punch_points'
      ? assignedPunchPoints
    : activeTab === 'todo'
      ? todo
      : activeTab === 'in_progress'
        ? (isAssignedWorkspace ? inProgress : initiatedInProgress)
        : activeTab === 'approval'
          ? pendingApproval
          : activeTab === 'approved'
              ? approved.filter((task) => task.workflow_state === 'APPROVED')
              : activeTab === 'closed'
                ? closed
                : activeTab === 'rejected'
                  ? rejected
                  : completed;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <PageTitle
          title={isAssignedWorkspace ? 'Assigned PSSR' : 'Initiated PSSR'}
          subtitle={isAssignedWorkspace ? 'Execute assigned PSSR work for your department or team-leader scope.' : 'Manage initiated PSSR workflows across their full lifecycle.'}
          breadcrumbs={['My Work', 'Dashboard']}
        />
        {isInitiator && (
          <span className="inline-flex items-center gap-2 px-3 py-2 bg-primary/10 text-primary border border-primary/20 rounded text-label-md font-black uppercase w-fit">
            <BadgeCheck className="w-4 h-4" />
            PSSR INITIATOR
          </span>
        )}
      </div>

      {isInitiator && !isAssignedWorkspace && (
        <div className="bg-surface-container-lowest border border-primary/25 rounded shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-outline-variant flex items-center justify-between">
            <div>
              <h2 className="text-headline-sm font-bold text-on-surface">My Initiated PSSR</h2>
              <p className="text-body-sm text-on-surface-variant">Your capability is user-based. It permits new PSSR creation without changing your TEAM_MEMBER role.</p>
            </div>
            <ClipboardList className="w-5 h-5 text-primary" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-0 border-b border-outline-variant">
            {[
              { label: 'Under Preparation', value: data?.initiator_stats.under_preparation ?? data?.initiator_stats.draft_pssr ?? 0 },
              { label: 'To Do', value: data?.initiator_stats.todo ?? 0 },
              { label: 'In Progress', value: data?.initiator_stats.in_progress ?? 0 },
              { label: 'Completed', value: data?.initiator_stats.completed_by_team ?? 0 },
              { label: 'Area Approval', value: data?.initiator_stats.pending_area_owner_approval ?? 0 },
              { label: 'Approved', value: data?.initiator_stats.approved ?? 0 },
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
              <p className="text-body-sm text-on-surface-variant mt-1">Drafts, submitted workflows, active work, and completed records are fetched from the database.</p>
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
            {!isAssignedWorkspace && <TabButton active={activeTab === 'preparation'} onClick={() => setActiveTab('preparation')} label={`Under Preparation (${underPreparation.length})`} />}
            {!isAssignedWorkspace && <TabButton active={activeTab === 'todo'} onClick={() => setActiveTab('todo')} label={`Submitted (${todo.length})`} />}
            {isAssignedWorkspace && <TabButton active={activeTab === 'todo'} onClick={() => setActiveTab('todo')} label={`To Do (${todo.length})`} />}
            <TabButton active={activeTab === 'in_progress'} onClick={() => setActiveTab('in_progress')} label={`In Progress (${isAssignedWorkspace ? inProgress.length : initiatedInProgress.length})`} />
            {isAssignedWorkspace && <TabButton active={activeTab === 'completed'} onClick={() => setActiveTab('completed')} label={`Completed (${completed.length})`} />}
            {isAssignedWorkspace && <TabButton active={activeTab === 'assigned_punch_points'} onClick={() => setActiveTab('assigned_punch_points')} label={`Assigned Punch Points (${assignedPunchPoints.length})`} />}
            {!isAssignedWorkspace && <TabButton active={activeTab === 'completed'} onClick={() => setActiveTab('completed')} label={`Department Completed (${completed.length})`} />}
            {!isAssignedWorkspace && <TabButton active={activeTab === 'approval'} onClick={() => setActiveTab('approval')} label={`Pending Area Owner Approval (${pendingApproval.length})`} />}
            {!isAssignedWorkspace && <TabButton active={activeTab === 'approved'} onClick={() => setActiveTab('approved')} label={`Approved (${approved.filter((task) => task.workflow_state === 'APPROVED').length})`} />}
            {!isAssignedWorkspace && <TabButton active={activeTab === 'closed'} onClick={() => setActiveTab('closed')} label={`Closed (${closed.length})`} />}
            {!isAssignedWorkspace && <TabButton active={activeTab === 'rejected'} onClick={() => setActiveTab('rejected')} label={`Rejected (${rejected.length})`} />}
          </div>

          <div className="space-y-3">
            {visibleTasks.length === 0 ? (
              <EmptyPanel message={isAssignedWorkspace ? 'No live PSSR work is assigned in this queue.' : 'No initiated PSSR records are in this monitoring state.'} />
            ) : (
              visibleTasks.map((item, idx) => (
                <TaskCard key={`${item.id}-${item.department ?? 'task'}`} task={item} tab={activeTab} index={idx} onDetails={() => setDetailPSSRId(item.id)} />
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
      {detailPSSRId && <PSSRDetailsPanel pssrId={detailPSSRId} onClose={() => setDetailPSSRId(undefined)} />}
    </div>
  );
};

export const TeamDashboardPage = TeamMemberDashboard;

const CreatePSSRPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  useScrollLock();
  const [form, setForm] = useState<PSSRFormState>(() => defaultPSSRForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [leaderSearch, setLeaderSearch] = useState('');
  const [annexureSearch, setAnnexureSearch] = useState('');
  const [directorySearches, setDirectorySearches] = useState<Record<string, string>>({});
  const [selectedUsers, setSelectedUsers] = useState<Record<string, AdminUser>>({});
  const [expandedAnnexureId, setExpandedAnnexureId] = useState<number | null>(null);
  const createPSSR = useCreatePSSR();
  const annexuresQuery = useAnnexures({ page: 1, limit: 100, active: true, archived: false });
  const debouncedLeaderSearch = useDebouncedValue(leaderSearch, 350);
  const directoryQuery = useTeamDirectory({
    page: 1,
    limit: 25,
    search: debouncedLeaderSearch.trim() || undefined,
    includeAllRoles: true,
    role: 'TEAM_MEMBER',
  });
  const leaderUsers = useMemo(() => {
    const byId = new Map<string, AdminUser>();
    Object.values(selectedUsers).forEach((employee) => byId.set(String(employee.id), employee));
    directoryQuery.data?.records.forEach((employee) => byId.set(String(employee.id), employee));
    return Array.from(byId.values());
  }, [directoryQuery.data?.records, selectedUsers]);
  const leader = selectedUsers[form.leaderId] ?? leaderUsers.find((employee) => String(employee.id) === form.leaderId);
  const allAnnexures = useMemo(() => annexuresQuery.data?.records ?? [], [annexuresQuery.data?.records]);
  const annexures = useMemo(() => {
    const records = allAnnexures;
    const needle = annexureSearch.trim().toLowerCase();
    if (!needle) return records;
    return records.filter((annexure) => `${annexure.code} ${annexure.title} ${annexure.departments.join(' ')}`.toLowerCase().includes(needle));
  }, [allAnnexures, annexureSearch]);
  const selectedAnnexures = allAnnexures.filter((annexure) => form.annexureIds.includes(String(annexure.id)));
  const annexureDetailQueries = useQueries({
    queries: selectedAnnexures.map((annexure) => ({
      queryKey: ['annexure-detail', annexure.id, undefined],
      queryFn: () => annexureService.detail(annexure.id),
      enabled: form.questionnaireEnabled,
      staleTime: 5 * 60 * 1000,
    })),
  });
  const generatedCheckpoints = useMemo(() => {
    return selectedAnnexures.flatMap((annexure, index) => {
      const detail = annexureDetailQueries[index]?.data;
      return (detail?.sections.flatMap((section) => section.questions) ?? []).map((question) => toSelectedQuestion(annexure, question));
    });
  }, [annexureDetailQueries, selectedAnnexures]);
  const selectedCheckpointCount = selectedAnnexures.reduce((total, annexure) => total + (annexure.questions_count ?? 0), 0);
  const checkpointsLoading = annexureDetailQueries.some((query) => query.isFetching);

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
  };

  const updateMember = (department: DepartmentName, employee: AdminUser | undefined) => {
    if (!employee) return;
    setForm((current) => ({
      ...current,
      teamMembers: current.teamMembers.map((row) => row.department === department
        ? { ...row, employeeIds: [String(employee.id)] }
        : row),
    }));
    rememberUser(employee);
    updateDirectorySearch(department, '');
  };

  const removeMember = (department: DepartmentName, employeeId: string) => {
    setForm((current) => ({
      ...current,
      teamMembers: current.teamMembers.map((row) => row.department === department ? { ...row, employeeIds: row.employeeIds.filter((id) => id !== employeeId) } : row),
      customQuestions: current.customQuestions.map((question) => question.departmentOwner === department ? { ...question, assignedMemberId: '' } : question),
    }));
  };

  const employeeById = (employeeId: string) => selectedUsers[employeeId];

  const membersWithEmployees = form.teamMembers.map((row) => ({
    ...row,
    employees: row.employeeIds.map(employeeById).filter(Boolean),
  }));
  const departmentsWithMembers = membersWithEmployees.filter((row) => row.employees.length > 0);
  const departmentAssignments = useMemo(() => {
    const assignments = new Map<string, { department: string; userId: string; user?: AdminUser }>();
    departmentsWithMembers.forEach((row) => {
      const user = row.employees[0];
      if (!user) return;
      assignments.set(row.department, {
        department: row.department,
        userId: String(user.id),
        user,
      });
    });
    return assignments;
  }, [departmentsWithMembers]);

  const toggleAnnexureType = (annexureId: number, selected: boolean) => {
    setForm((current) => {
      const annexureIds = new Set(current.annexureIds);
      if (selected) {
        annexureIds.add(String(annexureId));
      } else {
        annexureIds.delete(String(annexureId));
      }
      return {
        ...current,
        annexureIds: Array.from(annexureIds),
      };
    });
  };

  const addCustomQuestion = () => {
    setForm((current) => ({
      ...current,
      customQuestions: [
        ...current.customQuestions,
        {
          id: `custom-${Date.now()}`,
          questionText: '',
          description: '',
          checkpointType: 'FIELD',
          departmentOwner: '',
          assignedMemberId: '',
          category: 'Custom',
          mandatory: true,
          remarks: '',
          attachments: [],
        },
      ],
    }));
  };

  const updateCustomQuestion = (id: string, patch: Partial<PSSRCustomQuestion>) => {
    setForm((current) => ({
      ...current,
      customQuestions: current.customQuestions.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...patch };
        if (patch.departmentOwner !== undefined) {
          next.assignedMemberId = memberIdForDepartment(departmentsWithMembers, patch.departmentOwner);
        }
        return next;
      }),
    }));
  };

  const removeCustomQuestion = (id: string) => {
    setForm((current) => ({
      ...current,
      customQuestions: current.customQuestions.filter((item) => item.id !== id),
    }));
  };

  const validateAndSubmit = (workflowState: 'UNDER_PREPARATION' | 'TODO') => {
    setFormError(null);
    setFormSuccess(null);
    const assignments = Array.from(departmentAssignments.values())
      .map((assignment) => ({ department: assignment.department, user_id: Number(assignment.userId) }));
    const selectedAnnexureQuestions = generatedCheckpoints.filter((question) => question.source === 'annexure');
    const customQuestionDrafts = form.customQuestions.filter((question) => question.questionText.trim());
    const activeDepartments = Array.from(new Set([
      ...selectedAnnexureQuestions.map((question) => question.departmentOwner).filter(Boolean),
      ...customQuestionDrafts.map((question) => question.departmentOwner).filter(Boolean),
    ]));
    const validationDepartments = activeDepartments.map((departmentName) => {
      const generatedCount = selectedAnnexureQuestions.filter((question) => departmentMatches(departmentName, question.departmentOwner) || departmentMatches(question.departmentOwner, departmentName)).length;
      const customCount = customQuestionDrafts.filter((question) => departmentMatches(departmentName, question.departmentOwner) || departmentMatches(question.departmentOwner, departmentName)).length;
      const assignedMember = memberFromDepartmentAssignments(departmentAssignments, departmentName);
      return {
        departmentName,
        assignedMember,
        checkpointCount: generatedCount + customCount,
      };
    }).filter((item) => item.checkpointCount > 0);
    const logDepartmentValidation = (departmentName?: string) => {
      const failing = validationDepartments.find((item) => item.departmentName === departmentName);
      console.log('PSSR validation state', {
        activeDepartments,
        selectedAnnexures,
        generatedCheckpoints,
        departmentAssignments: Array.from(departmentAssignments.values()),
        teamMembers: form.teamMembers,
        validationDepartments,
      });
      if (failing) {
        console.log(
          'Department validation',
          failing.departmentName,
          failing.assignedMember,
          failing.checkpointCount
        );
      }
    };
    if (!form.plantUnit.trim() || !form.equipmentSystem.trim()) {
      setFormError('Plant/unit and equipment/system are required.');
      return;
    }
    if (form.type === 'MOC' && !form.mocNumber.trim()) {
      setFormError('MOC number is required for MOC PSSR.');
      return;
    }
    if (!assignments.length) {
      setFormError('Assign at least one department team member.');
      return;
    }
    if (!form.questionnaireEnabled || selectedAnnexures.length === 0) {
      setFormError('Select at least one annexure template.');
      return;
    }
    if (checkpointsLoading && selectedCheckpointCount > 0) {
      setFormError('Checkpoint templates are still loading from selected annexures. Try again in a moment.');
      return;
    }
    if (selectedCheckpointCount > 0 && selectedAnnexureQuestions.length < selectedCheckpointCount) {
      console.log('PSSR validation state', {
        activeDepartments,
        selectedAnnexures,
        generatedCheckpoints,
        departmentAssignments: Array.from(departmentAssignments.values()),
        teamMembers: form.teamMembers,
        validationDepartments,
      });
      setFormError('Checkpoint templates are still synchronizing from selected annexures. Try again in a moment.');
      return;
    }
    if (selectedCheckpointCount === 0 && !customQuestionDrafts.length) {
      setFormError('At least one checkpoint must be selected or added.');
      return;
    }
    const invalidDepartment = validationDepartments.find((item) => !item.assignedMember);
    if (invalidDepartment) {
      logDepartmentValidation(invalidDepartment.departmentName);
      setFormError(`${invalidDepartment.departmentName || 'A selected'} department has checkpoints assigned but no team member selected.`);
      return;
    }
    if (customQuestionDrafts.some((question) => !question.description.trim())) {
      setFormError('Description is required for every custom checkpoint.');
      return;
    }
    const invalidQuestionOwners = customQuestionDrafts
      .filter((question) => !question.departmentOwner || !memberFromDepartmentAssignments(departmentAssignments, question.departmentOwner))
      .map((question) => question.departmentOwner || 'Unassigned');
    if (invalidQuestionOwners.length) {
      logDepartmentValidation(invalidQuestionOwners[0]);
      setFormError('Select a department with one assigned team member for every custom checkpoint.');
      return;
    }
    const customQuestions = form.customQuestions
      .filter((question) => question.questionText.trim())
      .map((question) => ({
        question_text: question.questionText.trim(),
        description: question.description.trim(),
        question_type: question.checkpointType,
        department_owner: question.departmentOwner,
        assigned_user_id: Number(memberFromDepartmentAssignments(departmentAssignments, question.departmentOwner)?.userId),
        category: question.category.trim() || 'Custom',
        mandatory: question.mandatory,
        remarks: question.remarks.trim() || null,
        attachments: question.attachments,
      }));
    const generatedCheckpointAssignments = selectedAnnexureQuestions.map((question) => ({
      checkpoint: question.questionText,
      'checkpoint.department': question.departmentOwner,
      'checkpoint.assignedTo': Number(question.assignedMemberId || memberFromDepartmentAssignments(departmentAssignments, question.departmentOwner)?.userId),
    }));
    console.log('selectedTeamMembers', form.teamMembers);
    console.log('savedDepartmentAssignments', assignments);
    console.log('generatedCheckpointAssignments', generatedCheckpointAssignments);
    createPSSR.mutate({
      plant_unit: form.plantUnit.trim(),
      equipment_system: form.equipmentSystem.trim(),
      moc_type: form.type,
      moc_number: form.type === 'MOC' ? form.mocNumber.trim() : null,
      description: form.type === 'MOC' ? form.mocNumber.trim() : null,
      workflow_state: workflowState,
      team_leader_user_id: form.leaderId ? Number(form.leaderId) : null,
      area_owner_user_id: null,
      annexure_ids: selectedAnnexures.map((annexure) => annexure.id),
      selected_questions: selectedAnnexureQuestions.map((question) => ({
        annexure_id: question.annexureId as number,
        question_id: question.questionId as number,
        question_type: question.checkpointType,
        department_owner: question.departmentOwner,
        assigned_user_id: Number(question.assignedMemberId || memberFromDepartmentAssignments(departmentAssignments, question.departmentOwner)?.userId),
      })),
      assignments,
      custom_questions: customQuestions,
    }, {
      onSuccess: (created) => {
        setFormSuccess(`${created.pssr_id} ${workflowState === 'TODO' ? 'submitted' : 'saved as draft'} with ${created.assignment_count} assignment(s) and ${created.question_count} question(s).`);
        onClose();
      },
      onError: (error) => setFormError(error.message),
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-sm p-3 md:p-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-7xl bg-surface-container-lowest border border-outline-variant rounded shadow-xl"
      >
        <div className="sticky top-0 z-10 bg-surface-container-lowest border-b border-outline-variant px-4 md:px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">PSSR Creation</p>
            <h2 className="text-headline-sm font-black text-on-surface">Create New PSSR</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => validateAndSubmit('UNDER_PREPARATION')}
              disabled={createPSSR.isPending}
              className="inline-flex items-center justify-center gap-2 border border-outline-variant px-3 py-2 rounded text-label-md font-bold text-on-surface hover:bg-surface-container-low disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Save as Draft
            </button>
            <button
              onClick={() => validateAndSubmit('TODO')}
              disabled={createPSSR.isPending}
              className="inline-flex items-center justify-center gap-2 bg-primary text-on-primary px-3 py-2 rounded text-label-md font-bold hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {createPSSR.isPending ? 'Submitting' : 'Submit PSSR'}
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
          {(formError || formSuccess) && (
            <div className={`rounded border px-4 py-3 text-body-sm font-bold ${formError ? 'border-error/30 bg-error/5 text-error' : 'border-green-500/30 bg-green-500/5 text-green-700'}`}>
              {formError || formSuccess}
            </div>
          )}
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
              <h3 className="text-label-md font-black uppercase text-on-surface">PSSR Leadership</h3>
            </div>
            <div className="p-4">
              <div>
                <p className="mb-2 text-[10px] font-black uppercase text-outline">Team Leader</p>
                <LeaderSelector
                  leader={leader}
                  users={leaderUsers}
                  search={leaderSearch}
                  loading={directoryQuery.isFetching}
                  onSearch={setLeaderSearch}
                  onSelect={(employee) => {
                    update('leaderId', employee ? String(employee.id) : '');
                    rememberUser(employee);
                    setLeaderSearch('');
                  }}
                  onClear={() => update('leaderId', '')}
                />
              </div>
            </div>
          </section>

          <section className="border border-outline-variant rounded overflow-hidden">
            <div className="bg-surface-container-low px-4 py-3 border-b border-outline-variant flex items-center gap-2">
              <UserRound className="w-4 h-4 text-primary" />
              <h3 className="text-label-md font-black uppercase text-on-surface">PSSR Team Members</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left border-collapse">
                <thead className="sticky top-0 bg-surface-container-low text-[11px] uppercase text-on-surface">
                  <tr>
                    <th className="px-3 py-3 border-r border-outline-variant w-[170px]">Department</th>
                    <th className="px-3 py-3 border-r border-outline-variant w-[30%]">Name of PSSR Team Members</th>
                    <th className="px-3 py-3 border-r border-outline-variant">Emp. Code</th>
                    <th className="px-3 py-3 border-r border-outline-variant">Designation</th>
                  </tr>
                </thead>
                <tbody>
                  {membersWithEmployees.map((row) => (
                    <DepartmentMemberRow
                      key={row.department}
                      row={row}
                      selectedUsers={selectedUsers}
                      search={directorySearches[row.department] ?? ''}
                      onSearch={(value) => updateDirectorySearch(row.department, value)}
                      onChange={(employee) => updateMember(row.department, employee)}
                      onRemove={(employeeId) => removeMember(row.department, employeeId)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="border border-outline-variant rounded overflow-hidden">
            <div className="bg-surface-container-low px-4 py-3 border-b border-outline-variant flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-primary" />
                <div>
                  <h3 className="text-label-md font-black uppercase text-on-surface">Checkpoint Selection</h3>
                  <p className="mt-1 text-label-sm text-on-surface-variant">Select annexure types. Department ownership and member assignment come from the master data and team table.</p>
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-label-md font-bold text-on-surface">
                <input
                  type="checkbox"
                  checked={form.questionnaireEnabled}
                  onChange={(event) => update('questionnaireEnabled', event.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                Include annexures
              </label>
            </div>
            {form.questionnaireEnabled && (
              <div className="p-4 space-y-4">
                <div className="space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <span className="text-label-sm font-black uppercase text-outline">Step 1: Select annexure types — Step 2: Review backend mappings</span>
                    <span className="text-label-sm font-bold text-on-surface-variant">{selectedAnnexures.length} annexure(s), {form.customQuestions.filter((item) => item.questionText.trim()).length} custom checkpoint(s)</span>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
                    <input
                      value={annexureSearch}
                      onChange={(event) => setAnnexureSearch(event.target.value)}
                      placeholder="Search annexure code or name"
                      className="h-10 w-full rounded border border-outline-variant bg-surface-container-lowest pl-9 pr-3 text-body-sm text-on-surface outline-none focus:border-primary"
                    />
                  </div>
                  {annexuresQuery.isLoading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                      {[0, 1, 2].map((item) => <div key={item} className="h-36 rounded border border-outline-variant bg-surface-container-low animate-pulse" />)}
                    </div>
                  )}
                  {annexuresQuery.error && (
                    <div className="rounded border border-error/30 bg-error/5 p-4">
                      <p className="text-label-md font-black text-error">Unable to load annexures</p>
                      <p className="mt-1 text-body-sm text-on-surface-variant">{annexuresQuery.error.message}</p>
                      <button
                        type="button"
                        onClick={() => void annexuresQuery.refetch()}
                        className="mt-3 rounded border border-outline-variant px-3 py-2 text-label-sm font-black text-primary hover:bg-primary/5"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                  <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
                    {annexures.map((annexure) => {
                      const selectedCount = generatedCheckpoints.filter((question) => question.annexureId === annexure.id).length || annexure.questions_count;
                      return (
                        <AnnexureQuestionSelector
                          key={annexure.id}
                          annexure={annexure}
                          expanded={expandedAnnexureId === annexure.id}
                          selectedCount={selectedCount}
                          active={form.annexureIds.includes(String(annexure.id))}
                          onToggleExpand={() => setExpandedAnnexureId((current) => current === annexure.id ? null : annexure.id)}
                          onToggleAnnexure={(selected) => toggleAnnexureType(annexure.id, selected)}
                        />
                      );
                    })}
                    {!annexuresQuery.isLoading && annexures.length === 0 && (
                      <div className="border border-dashed border-outline-variant rounded p-6 text-center text-body-sm text-on-surface-variant">No active annexures available.</div>
                    )}
                  </div>
                </div>

                <CustomQuestionBuilder
                  questions={form.customQuestions}
                  departmentsWithMembers={departmentsWithMembers}
                  onAdd={addCustomQuestion}
                  onUpdate={updateCustomQuestion}
                  onRemove={removeCustomQuestion}
                />

                <div className="border border-outline-variant rounded">
                  <div className="bg-surface-container-low px-4 py-3 border-b border-outline-variant">
                    <p className="text-label-md font-black uppercase text-on-surface">Selected Checkpoints</p>
                    <p className="mt-1 text-label-sm text-on-surface-variant">Department owner and assigned member are previewed from backend annexure mappings and the team table.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px] text-left border-collapse">
                      <thead className="bg-surface-container-lowest text-[10px] uppercase text-on-surface-variant font-black">
                        <tr>
                          <th className="px-3 py-3 border-r border-outline-variant w-12">#</th>
                          <th className="px-3 py-3 border-r border-outline-variant flex-1">Checkpoint</th>
                          <th className="px-3 py-3 border-r border-outline-variant w-24">Type</th>
                          <th className="px-3 py-3 border-r border-outline-variant">Department</th>
                          <th className="px-3 py-3">Member</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedAnnexures.map((annexure) => (
                          <SelectedAnnexureCheckpointRows
                            key={annexure.id}
                            annexure={annexure}
                            departmentsWithMembers={departmentsWithMembers}
                            offset={0}
                          />
                        ))}
                        {form.customQuestions.filter((item) => item.questionText.trim()).map((item, index) => {
                          const question = toSelectedCustomQuestion({
                            ...item,
                            assignedMemberId: memberIdForDepartment(departmentsWithMembers, item.departmentOwner),
                          });
                          return (
                            <SelectedCheckpointRow
                              key={question.id}
                              index={index + 1}
                              question={question}
                              memberName={selectedUsers[question.assignedMemberId]?.full_name}
                            />
                          );
                        })}
                        {selectedAnnexures.length === 0 && form.customQuestions.every((item) => !item.questionText.trim()) && (
                          <tr>
                            <td colSpan={5} className="px-3 py-6 text-center text-body-sm text-on-surface-variant">
                              Select annexure types above. Their checkpoints will be created from backend mappings.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
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

const LeaderSelector: React.FC<{
  leader?: AdminUser;
  users: AdminUser[];
  search: string;
  loading?: boolean;
  onSearch: (value: string) => void;
  onSelect: (employee: AdminUser | undefined) => void;
  onClear: () => void;
}> = ({ leader, users, search, loading, onSearch, onSelect, onClear }) => {
  const [open, setOpen] = useState(false);

  if (leader) {
    return (
      <SelectedUserCard
        employee={leader}
        label="Selected leader"
        onClear={onClear}
        action={<button type="button" onClick={onClear} className="inline-flex items-center gap-2 rounded border border-outline-variant px-3 py-2 text-label-sm font-black text-primary hover:bg-primary/5"><RefreshCw className="h-3.5 w-3.5" />Change Leader</button>}
      />
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded border border-outline-variant px-3 py-2 text-label-sm font-black text-primary hover:bg-primary/5"
      >
        <PlusCircle className="h-4 w-4" />
        Add Team Leader
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <UserDirectorySelect
        value=""
        onChange={(employee) => {
          onSelect(employee);
          setOpen(false);
        }}
        users={users}
        search={search}
        onSearch={onSearch}
        placeholder="Search leader by name, email, employee ID, or designation"
        loading={loading}
        groupByDepartment={false}
      />
      <button type="button" onClick={() => setOpen(false)} className="inline-flex items-center gap-2 rounded border border-outline-variant px-3 py-2 text-label-sm font-black text-on-surface-variant hover:bg-surface-container-low">
        <X className="h-3.5 w-3.5" />
        Cancel
      </button>
    </div>
  );
};

const DepartmentMemberRow: React.FC<{
  row: PSSRTeamMemberRow & { employees: AdminUser[] };
  selectedUsers: Record<string, AdminUser>;
  search: string;
  onSearch: (value: string) => void;
  onChange: (employee: AdminUser | undefined) => void;
  onRemove: (employeeId: string) => void;
}> = ({ row, selectedUsers, search, onSearch, onChange, onRemove }) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 350);
  const query = useTeamDirectory({
    page: 1,
    limit: 20,
    department: row.department,
    search: debouncedSearch.trim() || undefined,
  });
  const users = useMemo(() => {
    const byId = new Map<string, AdminUser>();
    row.employees.forEach((employee) => byId.set(String(employee.id), employee));
    Object.values(selectedUsers).forEach((employee) => {
      if (departmentMatches(row.department, employee.department)) byId.set(String(employee.id), employee);
    });
    query.data?.records.forEach((employee) => byId.set(String(employee.id), employee));
    return Array.from(byId.values());
  }, [query.data?.records, row.department, row.employees, selectedUsers]);
  const availableUsers = users.filter((employee) => !row.employeeIds.includes(String(employee.id)));
  const assigned = row.employees[0];

  return (
    <tr className="border-t border-outline-variant align-top">
      <td className="px-3 py-3 border-r border-outline-variant">
        <span className="inline-flex rounded bg-primary/10 px-2.5 py-1 text-label-sm font-black text-primary">{row.department}</span>
      </td>
      <td className="px-3 py-2 border-r border-outline-variant">
        <div className="space-y-2">
          {assigned && (
            <div className="grid grid-cols-1 gap-2">
              <SelectedUserCard employee={assigned} label="Assigned member" compact onClear={() => onRemove(String(assigned.id))} />
            </div>
          )}
          {pickerOpen ? (
            <UserDirectorySelect
              value=""
              onChange={(employee) => {
                onChange(employee);
                setPickerOpen(false);
              }}
              users={availableUsers}
              search={search}
              onSearch={onSearch}
              placeholder={`Search ${row.department} member`}
              loading={query.isFetching}
            />
          ) : assigned ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded border border-outline-variant px-3 py-2 text-label-sm font-black text-primary hover:bg-primary/5"
              >
                <RefreshCw className="h-4 w-4" />
                Edit
              </button>
              <button
                type="button"
                onClick={() => onRemove(String(assigned.id))}
                className="inline-flex items-center justify-center gap-2 rounded border border-outline-variant px-3 py-2 text-label-sm font-black text-error hover:bg-error/5"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded border border-outline-variant px-3 py-2 text-label-sm font-black text-primary hover:bg-primary/5"
            >
              <PlusCircle className="h-4 w-4" />
              Add Team Member
            </button>
          )}
        </div>
        {query.error && <p className="mt-2 text-label-sm font-semibold text-error">{query.error.message}</p>}
      </td>
      <AutoCell value={row.employees.map((employee) => employee.employee_id).join(', ')} />
      <AutoCell value={row.employees.map((employee) => employee.designation).filter(Boolean).join(', ')} />
    </tr>
  );
};

const SelectedUserCard: React.FC<{
  employee: AdminUser;
  label: string;
  compact?: boolean;
  action?: React.ReactNode;
  onClear: () => void;
}> = ({ employee, label, compact, action, onClear }) => {
  const initials = employee.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return (
    <div className={`flex items-center justify-between gap-3 rounded border border-outline-variant bg-surface-container-lowest ${compact ? 'p-2' : 'p-4'}`}>
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-primary text-on-primary text-label-md font-black">{initials || 'TM'}</div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-outline">{label}</p>
          <p className="truncate text-body-sm font-black text-on-surface">{employee.full_name}</p>
          <p className="truncate text-label-sm font-bold text-on-surface-variant">{employee.department ?? 'No department'} | {employee.designation ?? 'No designation'} | {employee.employee_id}</p>
          <p className="truncate text-label-sm font-bold text-on-surface-variant">{employee.email}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action}
        <button type="button" onClick={onClear} aria-label={`Remove ${employee.full_name}`} className="inline-flex h-9 w-9 items-center justify-center rounded border border-outline-variant text-on-surface-variant hover:bg-error/5 hover:text-error">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

const UserDirectorySelect: React.FC<{
  value: string;
  onChange: (employee: AdminUser | undefined) => void;
  users: AdminUser[];
  search: string;
  onSearch: (value: string) => void;
  placeholder: string;
  loading?: boolean;
  groupByDepartment?: boolean;
}> = ({ value, onChange, users, search, onSearch, placeholder, loading, groupByDepartment = true }) => {
  const selected = users.find((employee) => String(employee.id) === value);
  const visibleUsers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((employee) => userSearchText(employee).includes(needle));
  }, [search, users]);
  const groupedUsers = useMemo(() => {
    const groups = new Map<string, AdminUser[]>();
    visibleUsers.forEach((employee) => {
      const department = employee.department || 'Unassigned';
      groups.set(department, [...(groups.get(department) ?? []), employee]);
    });
    return Array.from(groups.entries());
  }, [visibleUsers]);

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
      <div className="max-h-64 overflow-y-auto rounded border border-outline-variant bg-surface-container-lowest shadow-sm">
        {loading && <p className="px-3 py-3 text-body-sm font-bold text-on-surface-variant">Searching user directory...</p>}
        {!loading && visibleUsers.length === 0 && <p className="px-3 py-3 text-body-sm font-bold text-on-surface-variant">No matching active users found.</p>}
        {(groupByDepartment ? groupedUsers : [['All users', visibleUsers] as [string, AdminUser[]]]).map(([department, employees]) => (
          <div key={department}>
            {groupByDepartment && (
              <div className="sticky top-0 z-[1] flex items-center gap-2 border-b border-outline-variant bg-surface-container-low px-3 py-1.5 text-[10px] font-black uppercase text-outline">
                <UsersRound className="h-3 w-3" />
                {department}
              </div>
            )}
            {employees.map((employee) => (
              <button
                key={employee.id}
                type="button"
                onClick={() => onChange(employee)}
                className="flex w-full items-center gap-3 border-b border-outline-variant px-3 py-2 text-left last:border-b-0 hover:bg-primary/5 focus:bg-primary/5 focus:outline-none"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-primary/10 text-label-sm font-black text-primary">
                  {initialsFor(employee.full_name) || <UserCheck className="h-4 w-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-body-sm font-black text-on-surface">{employee.full_name}</span>
                  <span className="block truncate text-label-sm font-bold text-on-surface-variant">{employee.department ?? 'No department'} | {employee.designation ?? 'No designation'} | {employee.employee_id}</span>
                  <span className="block truncate text-label-sm font-bold text-on-surface-variant">{employee.email}</span>
                </span>
                <span className="ml-auto shrink-0 rounded bg-surface-container-low px-2 py-1 text-[10px] font-black uppercase text-outline">{employee.role}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

const AnnexureQuestionSelector: React.FC<{
  annexure: AnnexureSummary;
  expanded: boolean;
  active: boolean;
  selectedCount: number;
  onToggleExpand: () => void;
  onToggleAnnexure: (selected: boolean) => void;
}> = ({ annexure, expanded, active, onToggleExpand, onToggleAnnexure }) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | CheckpointType>('ALL');
  const detailQuery = useAnnexureDetail(expanded ? annexure.id : undefined);
  
  const questions = useMemo(() => {
    const all = detailQuery.data?.sections.flatMap((section) => section.questions) ?? [];
    const needle = search.trim().toLowerCase();
    return all.filter((question) => {
      const checkpointType = questionCheckpointType(question);
      const matchesType = typeFilter === 'ALL' || checkpointType === typeFilter;
      const text = `${question.question_text} ${checkpointType} ${question.help_text ?? ''}`.toLowerCase();
      return matchesType && (!needle || text.includes(needle));
    });
  }, [detailQuery.data?.sections, search, typeFilter]);
  
  return (
    <div className={`border rounded transition-all ${active ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20' : 'border-outline-variant bg-surface-container-lowest'}`}>
      <div className="w-full p-4 text-left">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">{annexure.code}</p>
            <p className="mt-1 text-body-sm font-bold text-on-surface">{annexure.title}</p>
            <p className="mt-2 text-label-sm text-on-surface-variant">{annexure.questions_count} checkpoints available</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:flex-nowrap">
            <button
              type="button"
              onClick={() => onToggleAnnexure(!active)}
              className={`inline-flex items-center justify-center rounded border px-4 py-2 text-label-sm font-black transition-colors ${
                active 
                  ? 'border-green-600/40 bg-green-600/10 text-green-700' 
                  : 'border-outline-variant text-primary hover:bg-primary/5'
              }`}
            >
              {active ? '✓ Selected' : 'Select'}
            </button>
            <button
              type="button"
              onClick={onToggleExpand}
              className="inline-flex items-center justify-center gap-2 rounded border border-outline-variant px-4 py-2 text-label-sm font-black text-primary hover:bg-primary/5"
            >
              View Checkpoints
              <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-outline-variant bg-surface-container-low p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_200px_auto] gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search checkpoint text"
                className="h-10 w-full rounded border border-outline-variant bg-surface-container-lowest pl-9 pr-3 text-body-sm text-on-surface outline-none focus:border-primary"
              />
            </div>
            <label className="relative">
              <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as 'ALL' | CheckpointType)}
                className="h-10 w-full rounded border border-outline-variant bg-surface-container-lowest pl-9 pr-3 text-body-sm text-on-surface outline-none focus:border-primary"
              >
                <option value="ALL">All types</option>
                <option value="DOCUMENT">Document</option>
                <option value="FIELD">Field</option>
              </select>
            </label>
            <div className="inline-flex h-10 items-center justify-center rounded border border-outline-variant px-4 text-label-sm font-black text-on-surface-variant">
              {questions.length} mapped
            </div>
          </div>

          {detailQuery.isFetching && (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-20 rounded border border-outline-variant bg-surface-container-lowest animate-pulse" />
              ))}
            </div>
          )}

          {!detailQuery.isFetching && questions.length === 0 && (
            <div className="rounded border border-dashed border-outline-variant p-6 text-center">
              <p className="text-body-sm text-on-surface-variant">No checkpoints match your filters.</p>
            </div>
          )}

          <div className="space-y-3">
            {questions.map((question) => {
              const key = questionKey(annexure.id, question.id);
              const checkpointType = questionCheckpointType(question);

              return (
                <div key={key} className="rounded border border-outline-variant bg-surface-container-lowest p-4 transition-all">
                  <div className="flex gap-3">
                    <ListChecks className="mt-1 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-body-sm font-bold text-on-surface leading-relaxed">{question.question_text}</p>
                      
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase text-outline mb-1">Type</p>
                          <span className="inline-block rounded bg-surface-container-lowest px-3 py-1 text-label-sm font-bold text-on-surface">
                            {checkpointTypeLabel(checkpointType)}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] font-black uppercase text-outline">Department</span>
                          <p className="min-h-9 rounded border border-outline-variant bg-surface-container-low px-3 py-2 text-label-sm font-bold text-on-surface">
                            {question.department_owner || question.checked_by_department || 'Unmapped'}
                          </p>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] font-black uppercase text-outline">Assignment</span>
                          <p className="min-h-9 rounded border border-outline-variant bg-surface-container-low px-3 py-2 text-label-sm font-bold text-on-surface">
                            Auto from team member
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const SelectedAnnexureCheckpointRows: React.FC<{
  annexure: AnnexureSummary;
  departmentsWithMembers: Array<PSSRTeamMemberRow & { employees: AdminUser[] }>;
  offset: number;
}> = ({ annexure, departmentsWithMembers, offset }) => {
  const detailQuery = useAnnexureDetail(annexure.id);
  const questions = detailQuery.data?.sections.flatMap((section) => section.questions) ?? [];

  if (detailQuery.isLoading) {
    return (
      <tr className="border-t border-outline-variant">
        <td colSpan={5} className="px-3 py-4 text-body-sm font-bold text-on-surface-variant">
          Loading {annexure.code} checkpoints...
        </td>
      </tr>
    );
  }

  if (questions.length === 0) {
    return (
      <tr className="border-t border-outline-variant">
        <td colSpan={5} className="px-3 py-4 text-body-sm text-on-surface-variant">
          {annexure.code} has no active mapped checkpoints.
        </td>
      </tr>
    );
  }

  return (
    <>
      {questions.map((question, index) => {
        const department = question.department_owner || question.checked_by_department || 'Unmapped';
        const member = memberForDepartment(departmentsWithMembers, department);
        return (
          <SelectedCheckpointRow
            key={`${annexure.id}-${question.id}`}
            index={offset + index + 1}
            question={{
              id: questionKey(annexure.id, question.id),
              source: 'annexure',
              annexureId: annexure.id,
              annexureCode: annexure.code,
              annexureTitle: annexure.title,
              questionId: question.id,
              questionText: question.question_text,
              checkpointType: questionCheckpointType(question),
              departmentOwner: department,
              assignedMemberId: member ? String(member.id) : '',
              category: question.category || 'General',
              mandatory: question.required,
              preview: question.help_text || question.expected_evidence || question.guidance_notes,
              punchCategory: punchCategory(question),
            }}
            memberName={member?.full_name}
          />
        );
      })}
    </>
  );
};

const SelectedCheckpointRow: React.FC<{
  index: number;
  question: SelectedChecklistQuestion;
  memberName?: string;
}> = ({ index, question, memberName }) => (
  <tr className="border-t border-outline-variant hover:bg-surface-container-low transition-colors">
    <td className="px-3 py-3 border-r border-outline-variant text-label-sm font-black text-on-surface">{index}</td>
    <td className="px-3 py-3 border-r border-outline-variant">
      <p className="text-body-sm font-bold text-on-surface">{question.questionText}</p>
      <p className="mt-0.5 text-label-sm text-on-surface-variant">{question.annexureCode}</p>
    </td>
    <td className="px-3 py-3 border-r border-outline-variant">
      <span className="inline-block rounded bg-surface-container-low px-2 py-1 text-label-sm font-bold text-on-surface">
        {checkpointTypeLabel(question.checkpointType)}
      </span>
    </td>
    <td className="px-3 py-3 border-r border-outline-variant text-body-sm font-bold text-on-surface">
      {question.departmentOwner || <span className="text-error">Not mapped</span>}
    </td>
    <td className="px-3 py-3 text-body-sm text-on-surface">
      {memberName ?? <span className="text-error">No member selected</span>}
    </td>
  </tr>
);

const CustomQuestionBuilder: React.FC<{
  questions: PSSRCustomQuestion[];
  departmentsWithMembers: Array<PSSRTeamMemberRow & { employees: AdminUser[] }>;
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<PSSRCustomQuestion>) => void;
  onRemove: (id: string) => void;
}> = ({ questions, departmentsWithMembers, onAdd, onUpdate, onRemove }) => (
  <div className="rounded border border-outline-variant">
    <div className="flex flex-col gap-3 border-b border-outline-variant bg-surface-container-low px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-label-md font-black uppercase text-on-surface">Custom Checkpoints</p>
        <p className="mt-1 text-label-sm text-on-surface-variant">Add site-specific checks for this PSSR.</p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center justify-center gap-2 rounded bg-primary px-4 py-2 text-label-sm font-black text-on-primary hover:bg-primary/90"
      >
        <PlusCircle className="h-4 w-4" />
        Add Question
      </button>
    </div>
    <div className="space-y-3 p-4">
      {questions.length === 0 && (
        <p className="text-body-sm text-on-surface-variant py-4">No custom questions added. You can add site-specific checks that aren't covered by the standard annexures.</p>
      )}
      {questions.map((question) => (
        <div key={question.id} className="rounded border border-outline-variant bg-surface-container-lowest p-4 space-y-3">
          <input
            value={question.questionText}
            onChange={(event) => onUpdate(question.id, { questionText: event.target.value })}
            placeholder="Checkpoint title *"
            className="h-10 w-full rounded border border-outline-variant bg-transparent px-3 text-body-sm font-bold text-on-surface outline-none focus:border-primary"
          />
          <textarea
            value={question.description}
            onChange={(event) => onUpdate(question.id, { description: event.target.value })}
            rows={2}
            placeholder="Description *"
            className="w-full resize-none rounded border border-outline-variant bg-transparent px-3 py-2 text-body-sm text-on-surface outline-none focus:border-primary"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase text-outline">Type</span>
              <select
                value={question.checkpointType}
                onChange={(event) => onUpdate(question.id, { checkpointType: event.target.value as CheckpointType })}
                className="h-10 w-full rounded border border-outline-variant bg-surface-container-lowest px-3 text-label-sm text-on-surface outline-none focus:border-primary"
              >
                <option value="DOCUMENT">Document checkpoint</option>
                <option value="FIELD">Field checkpoint</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase text-outline">Department</span>
              <select
                value={question.departmentOwner}
                onChange={(event) => onUpdate(question.id, { departmentOwner: event.target.value, assignedMemberId: '' })}
                className="h-10 w-full rounded border border-outline-variant bg-surface-container-lowest px-3 text-label-sm text-on-surface outline-none focus:border-primary"
              >
                <option value="">Select department</option>
                {departmentsWithMembers.map((row) => (
                  <option key={row.department} value={row.department}>
                    {row.department}
                  </option>
                ))}
              </select>
            </label>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-outline">Assigned to</span>
              <p className="flex h-10 items-center rounded border border-outline-variant bg-surface-container-low px-3 text-label-sm font-bold text-on-surface">
                {departmentsWithMembers.find((row) => row.department === question.departmentOwner)?.employees[0]?.full_name ?? 'Select department member first'}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-outline-variant">
            <span className="text-label-sm font-bold text-on-surface-variant">
              {checkpointTypeLabel(question.checkpointType)}
            </span>
            <button
              type="button"
              onClick={() => onRemove(question.id)}
              className="inline-flex items-center justify-center gap-2 rounded border border-outline-variant px-3 py-2 text-label-sm font-black text-error hover:bg-error/5"
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
);

function userSearchText(employee: AdminUser): string {
  return `${employee.full_name} ${employee.email} ${employee.employee_id} ${employee.department ?? ''} ${employee.designation ?? ''}`.toLowerCase();
}

function isAllowedCheckpointAttachment(file: File): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase();
  return Boolean(extension && ['pdf', 'jpg', 'jpeg', 'png'].includes(extension));
}

function initialsFor(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function questionKey(annexureId: number, questionId: number): string {
  return `${annexureId}:${questionId}`;
}

function punchCategory(question: AnnexureQuestion | PSSRCustomQuestion): string {
  if (question.category && /category\s*[abc]\b/i.test(question.category)) return question.category;
  const mandatory = 'required' in question ? question.required : question.mandatory;
  return mandatory ? 'A' : 'B';
}

function questionCheckpointType(question: AnnexureQuestion): CheckpointType {
  return (question.question_type as CheckpointType) || 'FIELD';
}

function checkpointTypeLabel(type: CheckpointType): string {
  return type === 'DOCUMENT' ? 'Document Checkpoint' : 'Field Checkpoint';
}

function memberIdForDepartment(rows: Array<PSSRTeamMemberRow & { employees: AdminUser[] }>, department: string): string {
  const member = memberForDepartment(rows, department);
  return member ? String(member.id) : '';
}

function memberForDepartment(rows: Array<PSSRTeamMemberRow & { employees: AdminUser[] }>, department: string): AdminUser | undefined {
  return rows.find((row) => row.department === department || departmentMatches(row.department, department))?.employees[0];
}

function memberFromDepartmentAssignments(
  assignments: Map<string, { department: string; userId: string; user?: AdminUser }>,
  department: string
): { department: string; userId: string; user?: AdminUser } | undefined {
  return Array.from(assignments.values()).find((assignment) => (
    assignment.department === department
    || departmentMatches(assignment.department, department)
    || departmentMatches(department, assignment.department)
  ));
}

const MemberIdentity: React.FC<{ user?: MemberDisplayUser | null; fallbackId?: number | string }> = ({ user, fallbackId }) => {
  if (!user) return <span>{fallbackId ? `User ${fallbackId}` : 'Unassigned'}</span>;
  return (
    <span className="block leading-relaxed">
      <span className="block font-bold text-on-surface">{user.full_name}</span>
      <span className="block">{user.department || 'Department not set'}</span>
      <span className="block">{user.designation || 'Designation not set'}</span>
      <span className="block">{user.employee_id}</span>
      <span className="block break-all">{user.email}</span>
    </span>
  );
};

const CompactIdentity: React.FC<{ user?: MemberDisplayUser | null; fallback?: string; muted?: boolean }> = ({ user, fallback = 'Unassigned', muted = false }) => {
  const initials = user?.full_name
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '--';
  if (!user) {
    return (
      <div className={`flex min-w-0 items-center gap-2 rounded border border-dashed border-outline-variant px-2 py-1.5 ${muted ? 'bg-surface-container-low text-on-surface-variant' : 'bg-surface-container-lowest'}`}>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-surface-container text-[10px] font-black text-outline">--</div>
        <div className="min-w-0">
          <p className="truncate text-label-sm font-black">{fallback}</p>
          <p className="truncate text-[10px] font-bold text-on-surface-variant">Search and assign member</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex min-w-0 items-center gap-2 rounded border border-outline-variant bg-surface-container-lowest px-2 py-1.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-black text-primary">{initials}</div>
      <div className="min-w-0">
        <p className="truncate text-label-sm font-black text-on-surface">{user.full_name}</p>
        <p className="truncate text-[10px] font-bold text-on-surface-variant">
          {user.department || 'Department not set'} | {user.designation || 'Designation not set'} | {user.employee_id} | {user.email}
        </p>
      </div>
    </div>
  );
};

function memberOptionLabel(user: MemberDisplayUser): string {
  return [
    user.full_name,
    user.department || 'Department not set',
    user.designation || 'Designation not set',
    user.employee_id,
    user.email,
  ].join(' | ');
}

function PSSRWorkflowMemberForDepartment(rows: EditAssignmentDraft[], department: string): string {
  return rows.find((row) => row.userId && (row.department === department || departmentMatches(row.department, department) || departmentMatches(department, row.department)))?.userId ?? '';
}

function toSelectedQuestion(annexure: AnnexureSummary, question: AnnexureQuestion): SelectedChecklistQuestion {
  return {
    id: questionKey(annexure.id, question.id),
    source: 'annexure',
    annexureId: annexure.id,
    annexureCode: annexure.code,
    annexureTitle: annexure.title,
    questionId: question.id,
    questionText: question.question_text,
    checkpointType: questionCheckpointType(question),
    departmentOwner: question.department_owner || question.checked_by_department || '',
    assignedMemberId: '',
    category: question.category || 'General',
    mandatory: question.required,
    preview: question.help_text || question.expected_evidence || question.guidance_notes,
    punchCategory: punchCategory(question),
  };
}

function toSelectedCustomQuestion(question: PSSRCustomQuestion): SelectedChecklistQuestion {
  return {
    id: question.id,
    source: 'custom',
    annexureCode: 'CUSTOM',
    annexureTitle: 'Site-specific question',
    questionText: question.questionText,
    checkpointType: question.checkpointType,
    departmentOwner: question.departmentOwner,
    assignedMemberId: question.assignedMemberId,
    category: question.category || 'Custom',
    mandatory: question.mandatory,
    preview: question.remarks,
    punchCategory: punchCategory(question),
    remarks: question.remarks,
    attachments: question.attachments,
  };
}

function departmentMatches(rowDepartment: DepartmentName, userDepartment?: string | null): boolean {
  const department = (userDepartment ?? '').toLowerCase();
  if (!department) return rowDepartment === 'Others';
  if (rowDepartment === 'Safety / PSM') return department.includes('safety') || department.includes('psm');
  if (rowDepartment === 'Operations' || rowDepartment === 'PM Operation') return department.includes('operation') || department.includes('pm');
  if (rowDepartment === 'Instrumentation') return department.includes('instrument');
  if (rowDepartment === 'Others') return department.includes('other') || department.includes('it') || department.includes('admin');
  return department.includes(rowDepartment.toLowerCase());
}

function punchTitleForQuestion(question: NonNullable<PSSRWorkflowDetail['questions']>[number]): string {
  return `PSSR question failed: ${question.category || question.department_owner}`;
}

function toDateInputValue(value?: string | null): string {
  return value ? value.slice(0, 10) : '';
}

const AutoCell: React.FC<{ value?: string }> = ({ value }) => (
  <td className="px-3 py-2 border-r border-outline-variant text-body-sm text-on-surface">
    {value || <span className="text-on-surface-variant">Auto-filled</span>}
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
  onDetails: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, tab, index, onDetails }) => (
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
        {task.ownership === 'punch_point' && (
          <div className="mt-3 rounded border border-outline-variant bg-surface-container-low p-3">
            <p className="text-[10px] font-black uppercase text-primary">Assigned Punch Point</p>
            <p className="mt-1 font-black text-on-surface">{task.punch_point_title}</p>
            <p className="mt-1 text-body-sm text-on-surface-variant">{task.punch_point_description}</p>
            {task.punch_checkpoint_question && <div className="mt-3 border-t border-outline-variant pt-3">
              <p className="text-[10px] font-black uppercase text-outline">What Failed</p>
              <p className="mt-1 font-bold text-on-surface">{task.punch_question_number ? `${task.punch_question_number}. ` : ''}{task.punch_checkpoint_question}</p>
              <p className="mt-1 text-on-surface-variant">Original answer: <span className="font-black text-on-surface">{task.punch_original_answer ?? 'PENDING'}</span> | Remarks: <span className="font-bold text-on-surface">{task.punch_original_remarks ?? '-'}</span></p>
              <p className="mt-1 text-on-surface-variant">Annexure: <span className="font-bold text-on-surface">{task.punch_annexure_name ?? '-'}</span></p>
            </div>}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-on-surface-variant">
              <span>Priority: <span className="font-bold text-on-surface">{task.priority ?? '-'}</span></span>
              <span>Raised By: <span className="font-bold text-on-surface">{task.raised_by?.full_name ?? '-'}</span></span>
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-[11px] text-on-surface-variant">
          <span>Unit: <span className="font-bold text-on-surface">{task.unit}</span></span>
          {task.department && <span>Department: <span className="font-bold text-on-surface">{task.department}</span></span>}
          {task.due_date && <span>Due: <span className="font-bold text-error">{task.due_date}</span></span>}
          {task.submitted_date && <span>Submitted: <span>{task.submitted_date}</span></span>}
        </div>
      </div>
    </div>

    {task.reviewer_name && (
      <p className="text-label-xs text-on-surface-variant mb-3">Reviewed by: <span className="font-bold text-on-surface">{task.reviewer_name}</span></p>
    )}

    <div className="flex space-x-2 pt-3 border-t border-outline-variant">
      <button onClick={onDetails} className="text-label-sm font-bold text-primary hover:underline">Details</button>
    </div>
  </motion.div>
);

const PSSRDetailsPanel: React.FC<{ pssrId: string; onClose: () => void }> = ({ pssrId, onClose }) => {
  useScrollLock();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const detailQuery = usePSSRDetail(pssrId);
  const [responses, setResponses] = useState<Record<number, { response: 'YES' | 'NO' | 'NA' | 'PENDING'; remarks: string; attachments: CheckpointAttachmentPayload[] }>>({});
  const [uploads, setUploads] = useState<Record<number, File | undefined>>({});
  const [punchDrafts, setPunchDrafts] = useState<Record<number, Partial<PunchPayload>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PSSRDetailTab>('details');
  const [showEditWorkspace, setShowEditWorkspace] = useState(false);
  const [showReopenWorkspace, setShowReopenWorkspace] = useState(false);
  const [areaOwnerSearch, setAreaOwnerSearch] = useState('');
  const [areaOwnerId, setAreaOwnerId] = useState('');
  const [areaOwnerComments, setAreaOwnerComments] = useState('');
  const areaOwnerDirectory = useTeamDirectory({ page: 1, limit: 50, search: areaOwnerSearch.trim() || undefined, includeAllRoles: true, role: 'AREA_OWNER' });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['pssr-detail', pssrId] });
    void queryClient.invalidateQueries({ queryKey: ['team-member-dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['pssr-records'] });
  };
  const submitMutation = useMutation({
    mutationFn: () => api.submitPSSR(pssrId),
    onSuccess: () => {
      setMessage('PSSR submitted and assigned to the department team.');
      invalidate();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const respondMutation = useMutation({
    mutationFn: async ({ questionId, payload, file }: { questionId: number; payload: { response: 'YES' | 'NO' | 'NA' | 'PENDING'; remarks?: string | null; attachments?: CheckpointAttachmentPayload[] }; file?: File }) => {
      const attachment = file ? await api.uploadCheckpointAttachment(pssrId, questionId, file) : undefined;
      return api.respondToPSSRQuestion(pssrId, questionId, {
        ...payload,
        attachments: attachment ? [attachment] : payload.attachments,
      });
    },
    onSuccess: () => {
      setMessage('Response saved.');
      invalidate();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const saveAllMutation = useMutation({
    mutationFn: async () => {
      const questionsToSave = detailQuery.data?.questions?.filter(q => Boolean(q.can_answer)) ?? [];
      for (const question of questionsToSave) {
        const draft = responses[question.id] ?? {
          response: (question.latest_response?.response as 'YES' | 'NO' | 'NA' | 'PENDING' | undefined) ?? 'PENDING',
          remarks: question.latest_response?.remarks ?? '',
          attachments: question.latest_response?.attachments ?? [],
        };
        const file = uploads[question.id];
        const attachment = file ? await api.uploadCheckpointAttachment(pssrId, question.id, file) : undefined;
        const payload = { ...draft, attachments: attachment ? [attachment] : draft.attachments };
        await api.respondToPSSRQuestion(pssrId, question.id, payload);
      }
    },
    onSuccess: () => {
      setMessage('All responses saved.');
      invalidate();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const completeMutation = useMutation({
    mutationFn: () => api.completeMyPSSRSide(pssrId),
    onSuccess: () => {
      setMessage('Your side is completed. You can still edit responses until Area Owner approval.');
      invalidate();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const areaOwnerSubmitMutation = useMutation({
    mutationFn: () => api.transitionPSSR(pssrId, 'PENDING_AREA_OWNER_APPROVAL', areaOwnerComments.trim() || null, areaOwnerId ? Number(areaOwnerId) : null),
    onSuccess: () => {
      setMessage('Workflow submitted to area owner for approval.');
      invalidate();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const finalizeMutation = useMutation({
    mutationFn: () => api.finalizeDepartmentWork(pssrId),
    onSuccess: () => {
      setMessage('Department work finalized.');
      invalidate();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const closeMutation = useMutation({
    mutationFn: () => api.transitionPSSR(pssrId, 'CLOSED'),
    onSuccess: () => {
      setMessage('Workflow closed.');
      invalidate();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const punchMutation = useMutation({
    mutationFn: ({ pointId, payload }: { pointId?: number; payload: PunchPayload }) => (
      pointId
        ? api.updatePSSRPunchPoint(pssrId, pointId, payload)
        : api.createPSSRPunchPoint(pssrId, payload)
    ),
    onSuccess: () => {
      setMessage('Punchlist item saved.');
      invalidate();
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const detail = detailQuery.data;
  const isAdmin = user?.role === 'ADMIN';
  const canSubmit = Boolean(detail?.permissions?.can_submit);
  const canCompleteMySide = Boolean(detail?.permissions?.can_complete_my_side);
  const canFinalizeDepartmentWork = Boolean(detail?.permissions?.can_finalize_department_work);
  const canEditPunchlist = Boolean(detail?.permissions?.can_edit_punchlist);
  const canSubmitToAreaOwner = Boolean(detail?.permissions?.can_send_to_area_owner);
  const canCloseWorkflow = Boolean(detail?.permissions?.is_initiator && detail.workflow_state === 'APPROVED');
  const selectedRoutingAreaOwner = areaOwnerDirectory.data?.records.find((owner) => String(owner.id) === areaOwnerId) ?? detail?.area_owner ?? null;
  const departmentProgress = useMemo(() => {
    if (!detail) return [];
    if (detail.department_progress?.length) {
      return detail.department_progress.map((row) => {
        const assignedMembers = (detail.assignments ?? []).filter((assignment) => assignment.id === row.assignment_id);
        return {
          department: row.department,
          totalQuestions: row.total_questions,
          answered: row.answered_questions,
          pending: row.pending_questions,
          assignedMembers,
          completed: row.completed,
          applicable: row.applicable,
          openPunchPoints: row.open_punch_points,
        };
      });
    }
    const questions = detail.questions ?? [];
    const assignments = detail.assignments ?? [];
    const departments = Array.from(new Set([...assignments.map((item) => item.department), ...questions.map((item) => item.department_owner)]));
    return departments.map((department) => {
      const departmentQuestions = questions.filter((question) => departmentMatches(department, question.department_owner) || departmentMatches(question.department_owner, department));
      const departmentPunchPoints = (detail.punch_points ?? []).filter((point) => departmentMatches(department, point.owning_department) || departmentMatches(point.owning_department, department));
      const openPunchPoints = departmentPunchPoints.filter((point) => point.status !== 'CLOSED').length;
      const answered = departmentQuestions.filter((question) => question.latest_response && question.latest_response.response !== 'PENDING').length;
      const assignedMembers = assignments.filter((assignment) => departmentMatches(department, assignment.department) || departmentMatches(assignment.department, department));
      const applicable = departmentQuestions.length > 0 || departmentPunchPoints.length > 0;
      const completed = departmentQuestions.every((question) => !question.mandatory || (question.latest_response && question.latest_response.response !== 'PENDING'))
        && assignedMembers.length > 0
        && applicable;
      return { department, totalQuestions: departmentQuestions.length, answered, pending: Math.max(departmentQuestions.length - answered, 0), assignedMembers, completed, applicable, openPunchPoints };
    });
  }, [detail]);
  const annexureProgress = useMemo(() => {
    if (!detail) return [];
    const questions = detail.questions ?? [];
    return (detail.annexures ?? []).map((annexure) => {
      const annexureQuestions = questions.filter((question) => question.annexure_id === annexure.id);
      const answered = annexureQuestions.filter((question) => question.latest_response && question.latest_response.response !== 'PENDING').length;
      return { ...annexure, total: annexureQuestions.length, answered };
    });
  }, [detail]);
  const failedQuestions = useMemo(() => (
    (detail?.questions ?? []).filter((question) => question.latest_response?.response === 'NO')
  ), [detail]);
  const punchForQuestion = (question: NonNullable<PSSRWorkflowDetail['questions']>[number]): PunchPoint | undefined => (
    (detail?.punch_points ?? []).find((point) => (
      point.question_id === question.annexure_question_id
      || point.question_id === question.id
      || (point.owning_department === question.department_owner && point.title === punchTitleForQuestion(question))
    ))
  );
  const membersForDepartment = (department: string) => (
    (detail?.assignments ?? []).filter((assignment) => (
      assignment.status !== 'NOT_APPLICABLE'
      && (departmentMatches(department, assignment.department) || departmentMatches(assignment.department, department))
    ))
  );
  const draftPunchForQuestion = (
    question: NonNullable<PSSRWorkflowDetail['questions']>[number],
    patch: Partial<PunchPayload>,
  ) => {
    setPunchDrafts((current) => ({ ...current, [question.id]: { ...(current[question.id] ?? {}), ...patch } }));
  };
  const commitPunchForQuestion = (
    question: NonNullable<PSSRWorkflowDetail['questions']>[number],
    point: PunchPoint | undefined,
  ) => {
    const nextDraft = punchDrafts[question.id] ?? {};
    const payload: PunchPayload = {
      title: nextDraft.title ?? point?.title ?? punchTitleForQuestion(question),
      description: (nextDraft.description ?? point?.description ?? question.latest_response?.remarks ?? question.question_text).trim(),
      category: (nextDraft.category ?? point?.category ?? (question.mandatory ? 'A' : 'B')) as 'A' | 'B' | 'C',
      owning_department: nextDraft.owning_department ?? point?.owning_department ?? question.department_owner,
      assigned_to_user_id: nextDraft.assigned_to_user_id !== undefined ? nextDraft.assigned_to_user_id : (point?.assigned_to_user_id ?? null),
      due_date: nextDraft.due_date !== undefined ? nextDraft.due_date : (point?.due_date ?? null),
      progress_remarks: nextDraft.progress_remarks !== undefined ? nextDraft.progress_remarks : (point?.progress_remarks ?? point?.remarks ?? null),
      closure_remarks: nextDraft.closure_remarks !== undefined ? nextDraft.closure_remarks : (point?.closure_remarks ?? point?.remarks ?? null),
      closure_evidence: nextDraft.closure_evidence !== undefined ? nextDraft.closure_evidence : (point?.closure_evidence ?? null),
      status: (nextDraft.status ?? point?.status ?? 'OPEN') as 'OPEN' | 'IN_PROGRESS' | 'CLOSED',
      question_id: question.annexure_question_id ?? question.id,
    };
    if (!payload.description || payload.description.length < 3) {
      setMessage('Punchlist remarks must be at least 3 characters.');
      return;
    }
    punchMutation.mutate({ pointId: point?.id, payload });
  };
  const commitPunchPoint = (point: PunchPoint, patch: Partial<PunchPayload> = {}) => {
    const payload: PunchPayload = {
      title: point.title,
      description: (point.description ?? point.title).trim(),
      category: point.category as 'A' | 'B' | 'C',
      owning_department: point.owning_department,
      assigned_to_user_id: point.assigned_to_user_id ?? null,
      due_date: point.due_date ?? null,
      progress_remarks: point.progress_remarks ?? point.remarks ?? null,
      closure_remarks: point.closure_remarks ?? point.remarks ?? null,
      closure_evidence: point.closure_evidence ?? null,
      status: point.status as 'OPEN' | 'IN_PROGRESS' | 'CLOSED',
      question_id: point.question_id ?? null,
      ...patch,
    };
    punchMutation.mutate({ pointId: point.id, payload });
  };

  const updateDraft = (questionId: number, patch: Partial<{ response: 'YES' | 'NO' | 'NA' | 'PENDING'; remarks: string; attachments: CheckpointAttachmentPayload[] }>) => {
    setResponses((current) => {
      const question = detail?.questions?.find((item) => item.id === questionId);
      const existing = current[questionId] ?? {
        response: (question?.latest_response?.response as 'YES' | 'NO' | 'NA' | 'PENDING' | undefined) ?? 'PENDING',
        remarks: question?.latest_response?.remarks ?? '',
        attachments: question?.latest_response?.attachments ?? [],
      };
      return { ...current, [questionId]: { ...existing, ...patch } };
    });
  };

  return (
    <div className={`fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-sm p-3 md:p-6 ${showEditWorkspace || showReopenWorkspace ? 'overflow-hidden' : 'overflow-y-auto'}`}>
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-6xl bg-surface-container-lowest border border-outline-variant rounded shadow-xl">
        <div className="sticky top-0 z-10 bg-surface-container-lowest border-b border-outline-variant px-4 md:px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">PSSR Details</p>
            <h2 className="text-headline-sm font-black text-on-surface">{pssrId}</h2>
          </div>
          <div className="flex items-center gap-2">
            {canSubmit && <button disabled={submitMutation.isPending} onClick={() => submitMutation.mutate()} className="inline-flex items-center gap-2 rounded bg-primary px-3 py-2 text-label-sm font-black text-on-primary disabled:opacity-50"><Send className="h-4 w-4" />Submit PSSR</button>}
            {canCompleteMySide && (
              <button
                disabled={completeMutation.isPending}
                onClick={() => {
                  if (window.confirm('Mark your side complete? You can still edit responses until Area Owner approval.')) {
                    completeMutation.mutate();
                  }
                }}
                className="inline-flex items-center gap-2 rounded bg-green-700 px-3 py-2 text-label-sm font-black text-white disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                Complete From Your Side
              </button>
            )}
            {canFinalizeDepartmentWork && (
              <button
                disabled={finalizeMutation.isPending}
                onClick={() => finalizeMutation.mutate()}
                className="inline-flex items-center gap-2 rounded border border-outline-variant px-3 py-2 text-label-sm font-black text-primary disabled:opacity-50"
              >
                <BadgeCheck className="h-4 w-4" />
                Complete From Department Side
              </button>
            )}
            {detail?.permissions?.is_initiator && !['APPROVED', 'CLOSED'].includes(detail.workflow_state) && (
              <>
                <button onClick={() => setShowEditWorkspace(true)} className="rounded border border-outline-variant px-3 py-2 text-label-sm font-black text-on-surface">Edit PSSR</button>
                <button onClick={() => setShowReopenWorkspace(true)} className="rounded border border-outline-variant px-3 py-2 text-label-sm font-black text-on-surface">Reopen Work</button>
              </>
            )}
            {canCloseWorkflow && (
              <button disabled={closeMutation.isPending} onClick={() => closeMutation.mutate()} className="rounded bg-on-surface px-3 py-2 text-label-sm font-black text-surface disabled:opacity-50">Close Workflow</button>
            )}
            <button onClick={onClose} aria-label="Close PSSR details" className="inline-flex h-10 w-10 items-center justify-center border border-outline-variant rounded text-on-surface hover:bg-surface-container-low"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="p-4 md:p-6 space-y-5">
          <div className="flex flex-wrap gap-2 border-b border-outline-variant pb-3">
            <TabButton active={activeTab === 'details'} onClick={() => setActiveTab('details')} label="PSSR Details" />
            <TabButton active={activeTab === 'punchlist'} onClick={() => setActiveTab('punchlist')} label="Punchlist" />
            <TabButton active={activeTab === 'assigned_punch_points'} onClick={() => setActiveTab('assigned_punch_points')} label="Assigned Punch Points" />
            <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} label="History" />
          </div>
          {message && <div className="rounded border border-outline-variant bg-surface-container-low px-4 py-3 text-body-sm font-bold text-on-surface">{message}</div>}
          {detailQuery.isLoading && <div className="h-40 rounded border border-outline-variant bg-surface-container-low animate-pulse" />}
          {detailQuery.error && <div className="rounded border border-error/30 bg-error/5 px-4 py-3 text-body-sm font-bold text-error">{detailQuery.error.message}</div>}
          {!detailQuery.isLoading && !detailQuery.error && !detail && (
            <EmptyPanel message="No PSSR selected" />
          )}
          {detail && (
            <>
              {activeTab === 'details' && <section className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <ReadOnlyValue label="Plant / Unit" value={detail.plant_unit} />
                <ReadOnlyValue label="Equipment / System" value={detail.equipment_system} />
                <ReadOnlyValue label="MOC Details" value={detail.moc_type === 'MOC' ? (detail.moc_number ?? 'MOC number pending') : 'Non MOC PSSR'} />
                <ReadOnlyValue label="Initiator" value={detail.initiator?.full_name ?? (detail.initiator_user_id ? `User ${detail.initiator_user_id}` : 'Not recorded')} />
                <ReadOnlyValue label="Team Leader" value={detail.team_leader?.full_name ?? (detail.team_leader_user_id ? `User ${detail.team_leader_user_id}` : 'Not assigned')} />
                <div className="md:col-span-2"><CompactIdentity user={detail.area_owner} fallback="Area owner not assigned" muted /></div>
                <ReadOnlyValue label="Workflow Stage" value={workflowStateLabel(detail.workflow_state)} />
                <ReadOnlyValue label="Completion" value={`${detail.progress ?? 0}%`} />
                <ReadOnlyValue label="Open Punch Points" value={String(detail.open_punch_points)} />
                <ReadOnlyValue label="Submitted" value={detail.submitted_at ? new Date(detail.submitted_at).toLocaleString() : 'Not submitted'} />
                <ReadOnlyValue label="Completed" value={detail.completed_at ? new Date(detail.completed_at).toLocaleString() : 'Not completed'} />
                <ReadOnlyValue label="Approved" value={detail.approved_at ? new Date(detail.approved_at).toLocaleString() : 'Not approved'} />
                <ReadOnlyValue label="Created" value={detail.created_at ? new Date(detail.created_at).toLocaleString() : 'Not recorded'} />
              </section>}

              {activeTab === 'details' && <section className="border border-outline-variant rounded overflow-hidden">
                <div className="bg-surface-container-low px-4 py-3 text-label-md font-black uppercase text-on-surface">Department Progress</div>
                <div className="divide-y divide-outline-variant">
                  {departmentProgress.map((row) => (
                    <div key={row.department} className={`grid grid-cols-1 gap-2 px-4 py-3 text-body-sm md:grid-cols-[1fr_180px_160px] ${row.applicable ? '' : 'bg-surface-container-low text-on-surface-variant opacity-75'}`}>
                      <span className="font-bold text-on-surface">
                        {row.department}
                        <span className="mt-1 block space-y-1 text-label-sm text-on-surface-variant">
                          {row.assignedMembers.length ? row.assignedMembers.map((assignment) => <MemberIdentity key={assignment.id} user={assignment.user} fallbackId={assignment.user_id} />) : 'No assigned members'}
                        </span>
                      </span>
                      <span className="text-on-surface-variant">{row.applicable ? `${row.answered}/${row.totalQuestions} answered${row.openPunchPoints ? `, ${row.openPunchPoints} open punch` : ''}` : 'No checkpoints assigned'}</span>
                      <span className={row.completed ? 'text-green-700 font-bold' : 'text-on-surface-variant'}>{row.completed ? 'Completed' : row.applicable ? `${row.pending} checkpoint pending` : 'Not Applicable'}</span>
                    </div>
                  ))}
                  {departmentProgress.length === 0 && <p className="px-4 py-3 text-body-sm text-on-surface-variant">No department progress recorded.</p>}
                </div>
              </section>}

              {activeTab === 'details' && <section className="border border-outline-variant rounded overflow-hidden">
                <div className="bg-surface-container-low px-4 py-3 text-label-md font-black uppercase text-on-surface">Department Approval Status</div>
                <div className="divide-y divide-outline-variant">
                  {(detail.assignments ?? []).map((assignment) => (
                    <div key={assignment.id} className="grid grid-cols-1 md:grid-cols-[1fr_180px_220px] gap-2 px-4 py-3 text-body-sm">
                      <span className="font-bold text-on-surface">{assignment.department}<span className="mt-1 block text-label-sm text-on-surface-variant"><MemberIdentity user={assignment.user} fallbackId={assignment.user_id} /></span></span>
                      <span className="text-on-surface-variant">{assignment.status === 'MEMBER_COMPLETED' || assignment.status === 'COMPLETED' ? 'Completed' : assignment.status === 'NOT_APPLICABLE' ? 'Not Applicable' : 'Pending'}</span>
                      <span className={assignment.status === 'COMPLETED' ? 'font-bold text-green-700' : 'text-on-surface-variant'}>{assignment.status === 'COMPLETED' ? 'Finalized' : assignment.status === 'MEMBER_COMPLETED' ? 'Pending Leader Approval' : assignment.status === 'NOT_APPLICABLE' ? 'Not Applicable' : 'Pending Member Completion'}</span>
                    </div>
                  ))}
                  {(detail.assignments ?? []).length === 0 && <p className="px-4 py-3 text-body-sm text-on-surface-variant">No department assignments recorded.</p>}
                </div>
              </section>}

              {activeTab === 'details' && detail.permissions?.is_initiator && !canSubmitToAreaOwner && ['SUBMITTED', 'TODO', 'IN_PROGRESS', 'COMPLETED_BY_DEPARTMENT', 'COMPLETED_BY_TEAM'].includes(detail.workflow_state) && (
                <section className="rounded border border-outline-variant bg-surface-container-lowest p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-label-md font-black text-on-surface">Area Owner Approval Routing</p>
                      <p className="text-body-sm text-on-surface-variant">Cannot send for approval until all active departments are leader-finalized and mandatory checkpoints are answered. Open punch points do not block routing.</p>
                    </div>
                    <button disabled className="inline-flex items-center gap-2 rounded border border-outline-variant px-4 py-2 text-label-sm font-black text-on-surface-variant opacity-60">
                      <Send className="h-4 w-4" />
                      Send For Area Owner Approval
                    </button>
                  </div>
                </section>
              )}

              {activeTab === 'details' && canSubmitToAreaOwner && <section className="rounded border border-outline-variant bg-surface-container-lowest p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-label-md font-black text-on-surface">Area Owner Approval Routing</p>
                    <p className="text-body-sm text-on-surface-variant">Route the completed workflow to an active AREA_OWNER.</p>
                  </div>
                  <span className="rounded bg-green-50 px-3 py-2 text-label-sm font-black text-green-700">Departments completed</span>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr]">
                  <input value={areaOwnerSearch} onChange={(event) => setAreaOwnerSearch(event.target.value)} placeholder="Search area owners" className="h-10 rounded border border-outline-variant bg-transparent px-3 text-body-sm outline-none" />
                  <select value={areaOwnerId} onChange={(event) => setAreaOwnerId(event.target.value)} className={`h-10 ${SELECT_FIELD_CLASS}`}>
                    <option value="">Select area owner</option>
                    {(areaOwnerDirectory.data?.records ?? []).map((owner) => <option key={owner.id} value={owner.id}>{memberOptionLabel(owner)}</option>)}
                  </select>
                </div>
                <div className="mt-3">
                  <CompactIdentity user={selectedRoutingAreaOwner} fallback="Select an area owner for approval routing" muted />
                </div>
                <textarea value={areaOwnerComments} onChange={(event) => setAreaOwnerComments(event.target.value)} placeholder="Approval routing comments" className="mt-3 min-h-20 w-full rounded border border-outline-variant bg-transparent px-3 py-2 text-body-sm outline-none" />
                <div className="mt-3 flex justify-end">
                  <button disabled={areaOwnerSubmitMutation.isPending || !areaOwnerId} onClick={() => areaOwnerSubmitMutation.mutate()} className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-label-sm font-black text-on-primary disabled:opacity-50">
                    <Send className="h-4 w-4" />
                    Send For Area Owner Approval
                  </button>
                </div>
              </section>}

              {activeTab === 'details' && <section className="border border-outline-variant rounded overflow-hidden">
                <div className="bg-surface-container-low px-4 py-3 text-label-md font-black uppercase text-on-surface">Annexures</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3">
                  {annexureProgress.map((annexure) => <div key={annexure.id} className="rounded border border-outline-variant p-3"><p className="text-label-sm font-black text-primary">{annexure.code}</p><p className="text-body-sm font-bold text-on-surface">{annexure.title}</p><p className="mt-1 text-label-sm font-bold text-on-surface-variant">{annexure.answered}/{annexure.total} questions answered</p></div>)}
                  {(detail.annexures ?? []).length === 0 && <p className="text-body-sm text-on-surface-variant">No annexures selected.</p>}
                </div>
              </section>}

              {activeTab === 'punchlist' && <section className="border border-outline-variant rounded overflow-hidden">
                <div className="bg-surface-container-low px-4 py-3 text-label-md font-black uppercase text-on-surface">Punchlist</div>
                <div className="divide-y divide-outline-variant">
                  {failedQuestions.map((question) => {
                    const point = punchForQuestion(question);
                    const draft = punchDrafts[question.id] ?? {};
                    const selectedUserId = draft.assigned_to_user_id !== undefined ? draft.assigned_to_user_id : point?.assigned_to_user_id;
                    const dueDateValue = toDateInputValue(draft.due_date ?? point?.due_date);
                    const canUpdateThisPunch = canEditPunchlist || point?.assigned_to_user_id === user?.id;
                    const assignedMember = point?.assigned_to_user ?? null;
                    return (
                      <div key={question.id} className="px-4 py-4 text-body-sm">
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div>
                              <p className="text-label-sm font-black uppercase text-primary">{question.department_owner}</p>
                              <p className="mt-1 font-bold text-on-surface">{question.sequence}. {question.question_text}</p>
                              <p className="mt-1 text-on-surface-variant">{point?.description ?? question.latest_response?.remarks ?? 'No remarks recorded.'}</p>
                            </div>
                            <span className={`w-fit rounded px-2 py-1 text-[10px] font-black uppercase ${point?.status === 'CLOSED' ? 'bg-green-50 text-green-700' : 'bg-error/10 text-error'}`}>
                              {point?.status ?? 'OPEN'}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-[140px_1fr_170px_240px_130px_auto]">
                            <select
                              disabled={!canEditPunchlist || punchMutation.isPending}
                              value={draft.category ?? point?.category ?? (question.mandatory ? 'A' : 'B')}
                              onChange={(event) => draftPunchForQuestion(question, { category: event.target.value as 'A' | 'B' | 'C' })}
                              className={`h-10 ${SELECT_FIELD_CLASS}`}
                            >
                              <option value="A">Category A</option>
                              <option value="B">Category B</option>
                              <option value="C">Category C</option>
                            </select>
                            <input
                              disabled={!canUpdateThisPunch || punchMutation.isPending}
                              value={draft.description ?? point?.description ?? question.latest_response?.remarks ?? ''}
                              onChange={(event) => setPunchDrafts((current) => ({ ...current, [question.id]: { ...(current[question.id] ?? {}), description: event.target.value } }))}
                              placeholder="Remarks"
                              className="h-10 rounded border border-outline-variant bg-transparent px-3 text-body-sm outline-none disabled:opacity-60"
                            />
                            <input
                              disabled={!canEditPunchlist || punchMutation.isPending}
                              type="date"
                              value={dueDateValue}
                              onChange={(event) => draftPunchForQuestion(question, { due_date: event.target.value ? `${event.target.value}T00:00:00` : null })}
                              className="h-10 rounded border border-outline-variant bg-transparent px-3 text-body-sm outline-none disabled:opacity-60"
                            />
                            <PunchAssigneeSelect
                              department={question.department_owner}
                              value={selectedUserId ? String(selectedUserId) : ''}
                              currentUser={point?.assigned_to_user ?? undefined}
                              disabled={!canEditPunchlist || punchMutation.isPending}
                              onChange={(value) => draftPunchForQuestion(question, { assigned_to_user_id: value ? Number(value) : null })}
                            />
                            <select
                              disabled={!canUpdateThisPunch || punchMutation.isPending || !point}
                              value={draft.status ?? point?.status ?? 'OPEN'}
                              onChange={(event) => draftPunchForQuestion(question, { status: event.target.value as 'OPEN' | 'IN_PROGRESS' | 'CLOSED' })}
                              className={`h-10 font-bold ${SELECT_FIELD_CLASS}`}
                            >
                              <option value="OPEN">Open</option>
                              <option value="IN_PROGRESS">In Progress</option>
                              <option value="CLOSED">Closed</option>
                            </select>
                            <button
                              disabled={!canUpdateThisPunch || punchMutation.isPending}
                              onClick={() => commitPunchForQuestion(question, point)}
                              className="inline-flex h-10 items-center justify-center gap-2 rounded bg-primary px-3 text-label-sm font-black text-on-primary disabled:opacity-50"
                            >
                              <Save className="h-4 w-4" />
                              {point?.assigned_to_user_id ? 'Save' : 'Assign'}
                            </button>
                          </div>
                          <div className="grid grid-cols-1 gap-2 text-label-sm text-on-surface-variant md:grid-cols-4">
                            <span>Assigned: <span className="font-bold text-on-surface">{assignedMember?.full_name ?? 'Unassigned'}</span></span>
                            <span>Email: <span className="font-bold text-on-surface">{assignedMember?.email ?? '-'}</span></span>
                            <span>Due: <span className="font-bold text-on-surface">{dueDateValue || '-'}</span></span>
                            <span>Department: <span className="font-bold text-on-surface">{question.department_owner}</span></span>
                            <span>Assigned By: <span className="font-bold text-on-surface">{point?.assigned_by?.full_name ?? '-'}</span></span>
                          </div>
                          {point && <div className="mt-3 space-y-2 border-t border-outline-variant pt-3">
                            <p className="text-[10px] font-black uppercase text-outline">Closure Evidence</p>
                            {(point.evidence_attachments ?? []).map((evidence) => <PunchEvidenceRow key={evidence.id} evidence={evidence} onError={setMessage} />)}
                            {(point.evidence_attachments ?? []).length === 0 && <p className="text-label-sm text-on-surface-variant">No closure evidence uploaded.</p>}
                          </div>}
                        </div>
                      </div>
                    );
                  })}
                  {failedQuestions.length === 0 && <p className="px-4 py-3 text-body-sm text-on-surface-variant">No failed checkpoints recorded.</p>}
                </div>
              </section>}

              {activeTab === 'assigned_punch_points' && <section className="border border-outline-variant rounded overflow-hidden">
                <div className="bg-surface-container-low px-4 py-3 text-label-md font-black uppercase text-on-surface">Assigned Punch Points</div>
                <div className="divide-y divide-outline-variant">
                  {(detail.punch_points ?? []).filter((point) => point.assigned_to_user_id === user?.id).map((point) => (
                    <AssignedPunchPointRow
                      key={point.id}
                      point={point}
                      pssrId={detail.pssr_id}
                      canEditAssignment={canEditPunchlist}
                      canUpdate={canEditPunchlist || point.assigned_to_user_id === user?.id}
                      busy={punchMutation.isPending}
                      onSave={commitPunchPoint}
                    />
                  ))}
                  {(detail.punch_points ?? []).filter((point) => point.assigned_to_user_id === user?.id).length === 0 && <p className="px-4 py-3 text-body-sm text-on-surface-variant">No punch points assigned to you for this PSSR.</p>}
                </div>
              </section>}

              {activeTab === 'details' && <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-label-md font-black uppercase text-on-surface">Questions</h3>
                  {(detail.questions ?? []).some((q) => q.can_answer) && !isAdmin && (
                    <button disabled={saveAllMutation.isPending || respondMutation.isPending} onClick={() => saveAllMutation.mutate()} className="h-8 rounded bg-primary px-3 text-label-sm font-black text-on-primary disabled:opacity-50 hover:bg-primary/90">Save All</button>
                  )}
                </div>
                {(detail.questions ?? []).map((question) => {
                  const canAnswer = Boolean(question.can_answer) && !isAdmin;
                  const draft = responses[question.id] ?? {
                    response: (question.latest_response?.response as 'YES' | 'NO' | 'NA' | 'PENDING' | undefined) ?? 'PENDING',
                    remarks: question.latest_response?.remarks ?? '',
                    attachments: question.latest_response?.attachments ?? [],
                  };
                  return (
                    <div key={question.id} className="rounded border border-outline-variant p-4 bg-surface-container-lowest">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <input type="checkbox" checked={Boolean(question.latest_response && question.latest_response.response !== 'PENDING')} readOnly className="mt-1 h-4 w-4 accent-primary" />
                          <div>
                            <p className="text-label-sm font-black uppercase text-primary">{question.department_owner}</p>
                            <p className="mt-1 text-body-sm font-bold text-on-surface">{question.sequence}. {question.question_text}</p>
                          </div>
                        </div>
                      </div>
                      {canAnswer ? (
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-[140px_1fr_180px_auto] gap-2">
                          <select value={draft.response} onChange={(event) => updateDraft(question.id, { response: event.target.value as 'YES' | 'NO' | 'NA' | 'PENDING' })} className={`h-10 ${SELECT_FIELD_CLASS}`}>
                            {['PENDING', 'YES', 'NO', 'NA'].map((item) => <option key={item} value={item}>{item}</option>)}
                          </select>
                          <input value={draft.remarks} onChange={(event) => updateDraft(question.id, { remarks: event.target.value })} placeholder="Remarks or evidence reference" className="h-10 rounded border border-outline-variant bg-transparent px-3 text-body-sm outline-none" />
                          <label className="flex h-10 cursor-pointer items-center justify-center rounded border border-outline-variant bg-surface-container-lowest px-3 text-[11px] font-bold text-on-surface hover:bg-surface-container-low transition-colors">
                            <span>Add Attachment</span>
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file && !isAllowedCheckpointAttachment(file)) {
                                  setMessage('Only PDF, JPG, JPEG, and PNG attachments are allowed.');
                                  event.target.value = '';
                                  return;
                                }
                                setUploads((current) => ({ ...current, [question.id]: file }));
                              }}
                              className="hidden"
                            />
                          </label>
                          <button disabled={respondMutation.isPending} onClick={() => {
                            const file = uploads[question.id];
                            respondMutation.mutate({ questionId: question.id, payload: {
                              ...draft,
                              attachments: draft.attachments,
                            }, file });
                          }} className="h-10 rounded bg-primary px-3 text-label-sm font-black text-on-primary disabled:opacity-50">Save</button>
                        </div>
                      ) : (
                        <p className="mt-3 text-label-sm font-bold text-on-surface-variant">{question.latest_response ? `${question.latest_response.response} - ${question.latest_response.remarks ?? 'No remarks'}` : 'Read-only for your role or department.'}</p>
                      )}
                      <CheckpointAuditBlock pssrId={pssrId} response={question.latest_response} />
                      {(draft.attachments?.length > 0 || uploads[question.id]) && (
                        <div className="mt-2 text-[11px] text-on-surface-variant font-medium">
                          {uploads[question.id] ? `Pending upload: ${uploads[question.id]?.name}` : `Attached: ${draft.attachments[0]?.file_name ?? 'Document'}`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>}

              {activeTab === 'history' && <section className="border border-outline-variant rounded overflow-hidden">
                <div className="bg-surface-container-low px-4 py-3 text-label-md font-black uppercase text-on-surface">History</div>
                <div className="divide-y divide-outline-variant">
                  {(detail.audit_timeline ?? []).map((row) => (
                    <div key={row.id} className="grid grid-cols-1 md:grid-cols-[150px_180px_160px_1fr_190px] gap-2 px-4 py-3 text-body-sm">
                      <p className="font-black text-on-surface">{historyActionLabel(row.action)}</p>
                      <p className="text-on-surface-variant">{row.actor?.full_name ?? (row.actor_user_id ? `User ${row.actor_user_id}` : 'System')}</p>
                      <p className="text-on-surface-variant">{row.department ?? String(row.metadata?.department ?? '-')}</p>
                      <p className="text-on-surface-variant">
                        {row.summary}
                        {row.action === 'PUNCH_EVIDENCE_UPLOADED' && row.metadata?.evidence_id != null && row.metadata?.punch_point_id != null && (
                          <button onClick={() => void api.viewPunchEvidence(detail.pssr_id, Number(row.metadata.punch_point_id), Number(row.metadata.evidence_id))} className="ml-2 font-black text-primary hover:underline">View Evidence</button>
                        )}
                      </p>
                      <p className="text-[10px] font-bold uppercase text-outline">{new Date(row.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                  {(detail.audit_timeline ?? []).length === 0 && <p className="px-4 py-3 text-body-sm text-on-surface-variant">No history recorded.</p>}
                </div>
              </section>}
            </>
          )}
        </div>
      </motion.div>
      {detail && showEditWorkspace && (
        <PSSREditWorkspace
          pssr={detail}
          onClose={() => setShowEditWorkspace(false)}
          onSaved={() => {
            setShowEditWorkspace(false);
            invalidate();
          }}
        />
      )}
      {detail && showReopenWorkspace && (
        <ReopenWorkDialog
          pssr={detail}
          onClose={() => setShowReopenWorkspace(false)}
          onSaved={() => {
            setShowReopenWorkspace(false);
            invalidate();
          }}
        />
      )}
    </div>
  );
};

interface EditAssignmentDraft {
  department: string;
  userId: string;
}

interface EditQuestionDraft {
  id?: number | null;
  annexureId?: number | null;
  annexureQuestionId?: number | null;
  questionText: string;
  description: string;
  checkpointType: CheckpointType;
  departmentOwner: string;
  assignedUserId: string;
  category: string;
  mandatory: boolean;
  custom: boolean;
  remarks: string;
}

function initialEditAssignments(pssr: PSSRWorkflowDetail): EditAssignmentDraft[] {
  const existing = new Map((pssr.assignments ?? []).map((item) => [item.department, String(item.user_id)]));
  const fixedRows = PSSR_DEPARTMENTS.map((department) => ({ department, userId: existing.get(department) ?? '' }));
  const customRows = (pssr.assignments ?? [])
    .filter((item) => !PSSR_DEPARTMENTS.some((department) => departmentMatches(department, item.department)))
    .map((item) => ({ department: item.department, userId: String(item.user_id) }));
  return [...fixedRows, ...customRows];
}

const PSSREditWorkspace: React.FC<{ pssr: PSSRWorkflowDetail; onClose: () => void; onSaved: () => void }> = ({ pssr, onClose, onSaved }) => {
  useScrollLock();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [plantUnit, setPlantUnit] = useState(pssr.plant_unit);
  const [equipmentSystem, setEquipmentSystem] = useState(pssr.equipment_system);
  const [mocType, setMocType] = useState<PSSRKind>(pssr.moc_type === 'MOC' ? 'MOC' : 'NON_MOC');
  const [mocNumber, setMocNumber] = useState(pssr.moc_number ?? '');
  const [teamLeaderId, setTeamLeaderId] = useState(pssr.team_leader_user_id ? String(pssr.team_leader_user_id) : '');
  const [areaOwnerId, setAreaOwnerId] = useState(pssr.area_owner_user_id ? String(pssr.area_owner_user_id) : '');
  const [annexureIds, setAnnexureIds] = useState<string[]>((pssr.annexures ?? []).map((item) => String(item.id)));
  const [assignments, setAssignments] = useState<EditAssignmentDraft[]>(() => initialEditAssignments(pssr));
  const [questions, setQuestions] = useState<EditQuestionDraft[]>(() => (pssr.questions ?? []).map((item) => ({
    id: item.id,
    annexureId: item.annexure_id ?? null,
    annexureQuestionId: item.annexure_question_id ?? null,
    questionText: item.question_text,
    description: item.question_description ?? '',
    checkpointType: item.question_type ?? 'FIELD',
    departmentOwner: item.department_owner,
    assignedUserId: item.assigned_user_id ? String(item.assigned_user_id) : '',
    category: item.category,
    mandatory: item.mandatory,
    custom: item.custom,
    remarks: item.remarks ?? '',
  })));
  const directoryQuery = useTeamDirectory({ page: 1, limit: 100, search: search.trim() || undefined, role: 'TEAM_MEMBER' });
  const areaOwnerDirectory = useTeamDirectory({ page: 1, limit: 100, search: search.trim() || undefined, includeAllRoles: true, role: 'AREA_OWNER' });
  const annexuresQuery = useAnnexures({ page: 1, limit: 100, active: true, archived: false });
  const knownUsers = useMemo(() => {
    const byId = new Map<string, AdminUser>();
    directoryQuery.data?.records.forEach((item) => byId.set(String(item.id), item));
    (pssr.assignments ?? []).forEach((assignment) => {
      if (assignment.user) byId.set(String(assignment.user.id), {
        ...assignment.user,
        role: 'TEAM_MEMBER',
        active: true,
        dashboard_path: '/team/dashboard',
        is_pssr_initiator: false,
      } as AdminUser);
    });
    if (pssr.team_leader) byId.set(String(pssr.team_leader.id), {
      ...pssr.team_leader,
      role: 'TEAM_MEMBER',
      active: true,
      dashboard_path: '/team/dashboard',
      is_pssr_initiator: false,
    } as AdminUser);
    if (pssr.area_owner) byId.set(String(pssr.area_owner.id), {
      ...pssr.area_owner,
      role: 'AREA_OWNER',
      active: true,
      dashboard_path: '/area-owner/dashboard',
      is_pssr_initiator: false,
    } as AdminUser);
    return Array.from(byId.values());
  }, [directoryQuery.data?.records, pssr.assignments, pssr.team_leader, pssr.area_owner]);
  const teamMembers = knownUsers.filter((item) => item.role === 'TEAM_MEMBER');
  const areaOwners = useMemo(() => {
    const byId = new Map<string, AdminUser>();
    areaOwnerDirectory.data?.records.forEach((item) => byId.set(String(item.id), item));
    if (pssr.area_owner) byId.set(String(pssr.area_owner.id), {
      ...pssr.area_owner,
      role: 'AREA_OWNER',
      active: true,
      dashboard_path: '/area-owner/dashboard',
      is_pssr_initiator: false,
    } as AdminUser);
    return Array.from(byId.values());
  }, [areaOwnerDirectory.data?.records, pssr.area_owner]);
  const selectedLeader = teamMembers.find((item) => String(item.id) === teamLeaderId) ?? null;
  const selectedAreaOwner = areaOwners.find((item) => String(item.id) === areaOwnerId) ?? null;
  const selectedAnnexures = annexuresQuery.data?.records ?? [];
  const assignedByDepartment = useMemo(() => new Map(assignments.filter((item) => item.department && item.userId).map((item) => [item.department, item.userId])), [assignments]);
  const validateDraft = () => {
    if (!plantUnit.trim() || !equipmentSystem.trim()) return 'Plant / Unit and Equipment / System are required.';
    if (mocType === 'MOC' && !mocNumber.trim()) return 'MOC Number is required for MOC PSSR.';
    if (!teamLeaderId) return 'Select a PSSR team leader before saving.';
    const filledAssignments = assignments.filter((item) => item.department.trim() && item.userId);
    if (!filledAssignments.length) return 'Assign at least one department team member.';
    const duplicateDepartments = filledAssignments.map((item) => item.department).filter((department, index, rows) => rows.indexOf(department) !== index);
    if (duplicateDepartments.length) return `Only one member can be assigned to ${duplicateDepartments[0]}.`;
    const invalidQuestion = questions.find((question) => question.questionText.trim() && !PSSR_DEPARTMENTS.some((department) => departmentMatches(department, question.departmentOwner)) && !assignedByDepartment.has(question.departmentOwner));
    if (invalidQuestion) return `${invalidQuestion.departmentOwner} is not a controlled PSSR department.`;
    const unmappedQuestion = questions.find((question) => question.questionText.trim() && !PSSRWorkflowMemberForDepartment(assignments, question.departmentOwner));
    if (unmappedQuestion) return `${unmappedQuestion.departmentOwner} has checkpoints but no assigned team member.`;
    return null;
  };
  const updateMutation = useMutation({
    mutationFn: () => {
      const validation = validateDraft();
      if (validation) throw new Error(validation);
      return api.updatePSSR(pssr.pssr_id, {
      plant_unit: plantUnit.trim(),
      equipment_system: equipmentSystem.trim(),
      moc_type: mocType,
      moc_number: mocType === 'MOC' ? mocNumber.trim() : null,
      description: mocType === 'MOC' ? mocNumber.trim() : null,
      team_leader_user_id: teamLeaderId ? Number(teamLeaderId) : null,
      area_owner_user_id: areaOwnerId ? Number(areaOwnerId) : null,
      annexure_ids: annexureIds.map(Number),
      assignments: assignments.filter((item) => item.department.trim() && item.userId).map((item) => ({ department: item.department.trim(), user_id: Number(item.userId) })),
      questions: questions.filter((item) => item.questionText.trim()).map((item) => ({
        id: item.id ?? null,
        annexure_id: item.annexureId ?? null,
        annexure_question_id: item.annexureQuestionId ?? null,
        question_text: item.questionText.trim(),
        description: item.description.trim() || null,
        question_type: item.checkpointType,
        department_owner: item.departmentOwner,
        assigned_user_id: item.assignedUserId ? Number(item.assignedUserId) : null,
        category: item.category.trim() || 'General',
        mandatory: item.mandatory,
        custom: item.custom,
        remarks: item.remarks.trim() || null,
        attachments: [],
      })),
    });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pssr-detail', pssr.pssr_id] });
      void queryClient.invalidateQueries({ queryKey: ['team-member-dashboard'] });
      onSaved();
    },
    onError: (err: Error) => setError(err.message),
  });
  const updateAssignment = (index: number, patch: Partial<EditAssignmentDraft>) => {
    setAssignments((current) => current.map((item, idx) => {
      if (idx !== index) return item;
      const next = { ...item, ...patch };
      return patch.department && patch.department !== item.department ? { ...next, userId: '' } : next;
    }));
    if (patch.userId !== undefined) {
      const department = assignments[index]?.department;
      setQuestions((current) => current.map((question) => question.departmentOwner === department ? { ...question, assignedUserId: patch.userId ?? '' } : question));
    }
  };
  const addAssignment = () => setAssignments((current) => [...current, { department: '', userId: '' }]);
  const addCustomQuestion = () => setQuestions((current) => [...current, { id: null, questionText: '', description: '', checkpointType: 'FIELD', departmentOwner: assignments[0]?.department ?? 'Others', assignedUserId: assignments[0]?.userId ?? '', category: 'Custom', mandatory: true, custom: true, remarks: '' }]);
  const toggleAnnexure = async (id: number) => {
    const strId = String(id);
    if (annexureIds.includes(strId)) {
      setQuestions((items) => items.filter((question) => question.annexureId !== id));
      setAnnexureIds((current) => current.filter((item) => item !== strId));
    } else {
      setAnnexureIds((current) => [...current, strId]);
      try {
        const detail = await queryClient.fetchQuery({
          queryKey: ['annexure-detail', id, undefined],
          queryFn: () => annexureService.detail(id),
          staleTime: 5 * 60 * 1000,
        });
        if (detail) {
          setQuestions((current) => {
            const newQuestions = detail.sections.flatMap(s => s.questions).map((q) => ({
              id: null,
              annexureId: id,
              annexureQuestionId: q.id,
              questionText: q.question_text,
              description: q.help_text ?? q.expected_evidence ?? q.guidance_notes ?? '',
              checkpointType: q.question_type ?? 'FIELD',
              departmentOwner: q.department_owner,
              assignedUserId: assignments.find((a) => a.department === q.department_owner)?.userId ?? '',
              category: 'Annexure',
              mandatory: true,
              custom: false,
              remarks: '',
            }));
            return [...current, ...newQuestions];
          });
        }
      } catch (err) {
        console.error('Failed to load annexure questions', err);
      }
    }
  };
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-on-surface/50 p-3 backdrop-blur-sm sm:p-6 overscroll-none">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex w-full max-w-7xl flex-col overflow-hidden rounded border border-outline-variant bg-surface-container-lowest shadow-xl" style={{ maxHeight: '100%' }}>
        <div className="flex-none flex flex-col gap-3 border-b border-outline-variant bg-surface-container-lowest px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">Edit PSSR</p>
            <h2 className="text-headline-sm font-black text-on-surface">{pssr.pssr_id}</h2>
          </div>
          <div className="flex gap-2">
            <button disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()} className="rounded bg-primary px-4 py-2 text-label-sm font-black text-on-primary disabled:opacity-50">Save Changes</button>
            <button onClick={onClose} className="rounded border border-outline-variant px-4 py-2 text-label-sm font-black text-on-surface">Cancel Edit</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain space-y-5 p-4 md:p-6">
          {error && <div className="rounded border border-error/30 bg-error/5 px-4 py-3 text-body-sm font-bold text-error">{error}</div>}
          <section className="rounded border border-outline-variant bg-surface-container-lowest p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-label-md font-black text-on-surface">Basic PSSR Information</p>
                <p className="text-body-sm text-on-surface-variant">Controlled header fields for this workflow.</p>
              </div>
              <div className="rounded bg-surface-container px-3 py-2 text-label-sm font-black text-primary">{workflowStateLabel(pssr.workflow_state)}</div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <LabeledInput label="Plant / Unit" value={plantUnit} onChange={setPlantUnit} />
              <LabeledInput label="Equipment / System" value={equipmentSystem} onChange={setEquipmentSystem} />
              <div className="rounded border border-outline-variant p-3">
                <p className="mb-2 text-[10px] font-black uppercase text-outline">PSSR Type</p>
                <div className="flex gap-2"><SegmentChoice label="Non MOC" active={mocType === 'NON_MOC'} onClick={() => setMocType('NON_MOC')} /><SegmentChoice label="MOC" active={mocType === 'MOC'} onClick={() => setMocType('MOC')} /></div>
              </div>
              <LabeledInput label="MOC Number" value={mocNumber} onChange={setMocNumber} />
              <ReadOnlyValue label="Workflow Status" value={workflowStateLabel(pssr.workflow_state)} />
              <ReadOnlyValue label="Completion %" value={`${pssr.progress ?? 0}%`} />
            </div>
          </section>
          <section className="rounded border border-outline-variant bg-surface-container-lowest p-4">
            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-label-md font-black text-on-surface">PSSR Leadership</p>
                <p className="text-body-sm text-on-surface-variant">Area owner routing happens after department completion.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr]">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search leader or department members" className="h-10 w-full min-w-0 rounded border border-outline-variant bg-transparent px-3 text-body-sm outline-none" />
              <select value={teamLeaderId} onChange={(event) => setTeamLeaderId(event.target.value)} className={`h-10 w-full min-w-0 ${SELECT_FIELD_CLASS}`}>
                <option value="">Select team leader</option>
                {teamMembers.map((user) => <option key={user.id} value={user.id}>{memberOptionLabel(user)}</option>)}
              </select>
              <select value={areaOwnerId} onChange={(event) => setAreaOwnerId(event.target.value)} className={`h-10 w-full min-w-0 ${SELECT_FIELD_CLASS}`}>
                <option value="">Select area owner</option>
                {areaOwners.map((user) => <option key={user.id} value={user.id}>{memberOptionLabel(user)}</option>)}
              </select>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <CompactIdentity user={selectedLeader} fallback="No team leader selected" muted />
              <CompactIdentity user={selectedAreaOwner} fallback="No area owner selected" muted />
            </div>
          </section>
          <section className="rounded border border-outline-variant bg-surface-container-lowest p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-label-md font-black text-on-surface">Team Members</p>
                <p className="text-body-sm text-on-surface-variant">Members are filtered by the selected department from the backend directory.</p>
              </div>
              <button onClick={addAssignment} className="inline-flex items-center gap-2 rounded border border-outline-variant px-3 py-2 text-label-sm font-black text-primary"><PlusCircle className="h-4 w-4" />Add Team Member</button>
            </div>
            <div className="space-y-2">
              {assignments.map((assignment, index) => (
                <div key={`${assignment.department || 'new'}-${index}`} className={`rounded border ${assignment.userId ? 'border-outline-variant bg-surface-container-lowest' : 'border-outline-variant bg-surface-container-low/60'}`}>
                  <div className="flex min-h-9 items-center justify-between gap-3 border-b border-outline-variant px-3 py-2">
                    {index < PSSR_DEPARTMENTS.length ? (
                      <p className="text-label-sm font-black uppercase text-on-surface">{assignment.department}</p>
                    ) : (
                      <select value={assignment.department} onChange={(event) => updateAssignment(index, { department: event.target.value })} className={`h-8 px-2 text-label-sm font-bold ${SELECT_FIELD_CLASS}`}>
                        <option value="">Select department</option>
                        {PSSR_DEPARTMENTS.map((department) => <option key={department} value={department}>{department}</option>)}
                      </select>
                    )}
                    {!assignment.userId && <span className="rounded bg-surface-container px-2 py-1 text-[10px] font-black uppercase text-outline">Unassigned</span>}
                  </div>
                  <div className="overflow-x-auto">
                    <div className="grid min-w-[960px] grid-cols-[minmax(360px,1fr)_150px_170px_280px] gap-2 px-3 py-2 text-[10px] font-black uppercase text-outline">
                      <span>Member selector</span>
                      <span>Code</span>
                      <span>Designation</span>
                      <span>Actions</span>
                    </div>
                    <EditAssignmentRow
                      assignment={assignment}
                      index={index}
                      fixed={index < PSSR_DEPARTMENTS.length}
                      onChange={updateAssignment}
                      onRemove={() => setAssignments((current) => current.filter((_, idx) => idx !== index))}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded border border-outline-variant p-4">
            <p className="mb-3 text-label-md font-black uppercase text-on-surface">Annexures</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              {selectedAnnexures.map((annexure) => <label key={annexure.id} className="flex items-start gap-2 rounded border border-outline-variant p-3 text-body-sm"><input type="checkbox" checked={annexureIds.includes(String(annexure.id))} onChange={() => toggleAnnexure(annexure.id)} className="mt-1 h-4 w-4 accent-primary" /><span><span className="font-black text-primary">{annexure.code}</span><span className="block font-bold text-on-surface">{annexure.title}</span></span></label>)}
            </div>
          </section>
          <section className="rounded border border-outline-variant p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-label-md font-black uppercase text-on-surface">Checkpoints</p>
              <button onClick={addCustomQuestion} className="rounded bg-primary px-3 py-2 text-label-sm font-black text-on-primary">Add Custom Checkpoint</button>
            </div>
            <div className="space-y-3">
              {questions.map((question, index) => (
                <div key={question.id ?? `new-${index}`} className="rounded border border-outline-variant p-3">
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_180px_180px_220px_auto]">
                    <input value={question.questionText} onChange={(event) => setQuestions((current) => current.map((item, idx) => idx === index ? { ...item, questionText: event.target.value } : item))} className="h-10 rounded border border-outline-variant bg-transparent px-3 text-body-sm" placeholder="Checkpoint text" />
                    <select value={question.checkpointType} onChange={(event) => setQuestions((current) => current.map((item, idx) => idx === index ? { ...item, checkpointType: event.target.value as CheckpointType } : item))} className={`h-10 ${SELECT_FIELD_CLASS}`}><option value="FIELD">Field</option><option value="DOCUMENT">Document</option></select>
                    <select value={question.departmentOwner} onChange={(event) => setQuestions((current) => current.map((item, idx) => idx === index ? { ...item, departmentOwner: event.target.value, assignedUserId: assignments.find((assignment) => assignment.department === event.target.value)?.userId ?? '' } : item))} className={`h-10 ${SELECT_FIELD_CLASS}`}>{PSSR_DEPARTMENTS.map((department) => <option key={department} value={department}>{department}</option>)}</select>
                    <select value={question.assignedUserId} onChange={(event) => setQuestions((current) => current.map((item, idx) => idx === index ? { ...item, assignedUserId: event.target.value } : item))} className={`h-10 ${SELECT_FIELD_CLASS}`}><option value="">Auto from department</option>{assignments.filter((assignment) => assignment.department === question.departmentOwner).map((assignment) => <option key={assignment.userId} value={assignment.userId}>{knownUsers.find((user) => String(user.id) === assignment.userId)?.full_name ?? `User ${assignment.userId}`}</option>)}</select>
                    <button onClick={() => setQuestions((current) => current.filter((_, idx) => idx !== index))} className="rounded border border-outline-variant px-3 text-label-sm font-black text-error">Delete</button>
                  </div>
                  <textarea value={question.description} onChange={(event) => setQuestions((current) => current.map((item, idx) => idx === index ? { ...item, description: event.target.value } : item))} placeholder="Description / evidence expectations" className="mt-2 min-h-16 w-full rounded border border-outline-variant bg-transparent px-3 py-2 text-body-sm" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </motion.div>
    </div>
  );
};

const ReopenWorkDialog: React.FC<{ pssr: PSSRWorkflowDetail; onClose: () => void; onSaved: () => void }> = ({ pssr, onClose, onSaved }) => {
  useScrollLock();
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => api.reopenDepartmentWork(pssr.pssr_id, selected),
    onSuccess: onSaved,
    onError: (error: Error) => setMessage(error.message),
  });
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-on-surface/50 p-4">
      <div className="w-full max-w-xl rounded border border-outline-variant bg-surface-container-lowest p-5 shadow-xl">
        <p className="text-[10px] font-black uppercase tracking-widest text-primary">Reopen Work</p>
        <h2 className="mt-1 text-headline-sm font-black text-on-surface">Reopen selected department work?</h2>
        <p className="mt-2 text-body-sm text-on-surface-variant">Completed responses may require revalidation.</p>
        {message && <div className="mt-3 rounded border border-error/30 bg-error/5 px-3 py-2 text-body-sm font-bold text-error">{message}</div>}
        <div className="mt-4 space-y-2">
          {(pssr.assignments ?? []).filter((assignment) => assignment.status !== 'NOT_APPLICABLE').map((assignment) => (
            <label key={assignment.id} className="flex items-center gap-2 rounded border border-outline-variant p-3 text-body-sm font-bold">
              <input type="checkbox" checked={selected.includes(assignment.department)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, assignment.department] : current.filter((item) => item !== assignment.department))} className="h-4 w-4 accent-primary" />
              {assignment.department}
              <span className="ml-auto text-label-sm text-on-surface-variant">{assignment.status}</span>
            </label>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border border-outline-variant px-4 py-2 text-label-sm font-black text-on-surface">Cancel</button>
          <button disabled={mutation.isPending || selected.length === 0} onClick={() => mutation.mutate()} className="rounded bg-primary px-4 py-2 text-label-sm font-black text-on-primary disabled:opacity-50">Reopen Work</button>
        </div>
      </div>
    </div>
  );
};

const PunchAssigneeSelect: React.FC<{
  department: string;
  value: string;
  currentUser?: MemberDisplayUser | null;
  disabled?: boolean;
  onChange: (value: string) => void;
}> = ({ department, value, currentUser, disabled, onChange }) => {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);
  const usersQuery = useTeamDirectory({
    page: 1,
    limit: 50,
    department,
    search: debouncedSearch.trim() || undefined,
    role: 'TEAM_MEMBER',
  });
  const users = useMemo(() => {
    const byId = new Map<string, MemberDisplayUser>();
    if (currentUser) byId.set(String(currentUser.id), currentUser);
    usersQuery.data?.records.forEach((item) => byId.set(String(item.id), item));
    return Array.from(byId.values());
  }, [currentUser, usersQuery.data?.records]);

  return (
    <div className="grid grid-cols-1 gap-1">
      <input
        disabled={disabled}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search owner"
        className="h-8 rounded border border-outline-variant bg-transparent px-2 text-label-sm outline-none disabled:opacity-60"
      />
      <select
        disabled={disabled || usersQuery.isLoading}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`h-10 ${SELECT_FIELD_CLASS}`}
      >
        <option value="">Unassigned</option>
        {users.map((member) => <option key={member.id} value={member.id}>{memberOptionLabel(member)}</option>)}
      </select>
    </div>
  );
};

const AssignedPunchPointRow: React.FC<{
  point: PunchPoint;
  pssrId: string;
  canEditAssignment: boolean;
  canUpdate: boolean;
  busy?: boolean;
  onSave: (point: PunchPoint, patch?: Partial<PunchPayload>) => void;
}> = ({ point, pssrId, canEditAssignment, canUpdate, busy, onSave }) => {
  const [assigneeId, setAssigneeId] = useState(point.assigned_to_user_id ? String(point.assigned_to_user_id) : '');
  const [category, setCategory] = useState(point.category as 'A' | 'B' | 'C');
  const [dueDate, setDueDate] = useState(toDateInputValue(point.due_date));
  const [status, setStatus] = useState(point.status as 'OPEN' | 'IN_PROGRESS' | 'CLOSED');
  const [progressRemarks, setProgressRemarks] = useState(point.progress_remarks ?? point.remarks ?? '');
  const [closureRemarks, setClosureRemarks] = useState(point.closure_remarks ?? '');
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const evidenceMutation = useMutation({
    mutationFn: async () => Promise.all(evidenceFiles.map((file) => api.uploadPunchEvidence(pssrId, point.id, file))),
    onSuccess: () => {
      setEvidenceFiles([]);
      setMessage('Evidence uploaded.');
      void queryClient.invalidateQueries({ queryKey: ['pssr-detail', pssrId] });
      void queryClient.invalidateQueries({ queryKey: ['team-dashboard'] });
    },
    onError: (error: Error) => setMessage(error.message),
  });

  useEffect(() => {
    setAssigneeId(point.assigned_to_user_id ? String(point.assigned_to_user_id) : '');
    setCategory(point.category as 'A' | 'B' | 'C');
    setDueDate(toDateInputValue(point.due_date));
    setStatus(point.status as 'OPEN' | 'IN_PROGRESS' | 'CLOSED');
    setProgressRemarks(point.progress_remarks ?? point.remarks ?? '');
    setClosureRemarks(point.closure_remarks ?? '');
  }, [point]);

  return (
    <div className="space-y-4 px-4 py-4 text-body-sm">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(220px,1fr)_130px_170px_minmax(220px,280px)_auto] lg:items-end">
        <div>
          <p className="text-[10px] font-black uppercase text-primary">Punch Point</p>
          <p className="mt-1 font-black text-on-surface">{point.title}</p>
          <p className="mt-1 text-on-surface-variant">{point.description ?? '-'}</p>
        </div>
        <label className="block">
          <span className="text-[10px] font-black uppercase text-outline">Category</span>
          <select disabled={!canEditAssignment || busy} value={category} onChange={(event) => setCategory(event.target.value as 'A' | 'B' | 'C')} className={`mt-1 h-10 w-full ${SELECT_FIELD_CLASS}`}>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] font-black uppercase text-outline">Due Date</span>
          <input disabled={!canEditAssignment || busy} type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-1 h-10 w-full rounded border border-outline-variant bg-transparent px-3 text-body-sm disabled:opacity-60" />
        </label>
        <div>
          <p className="text-[10px] font-black uppercase text-outline">Assign To</p>
          {canEditAssignment ? (
            <PunchAssigneeSelect department={point.owning_department} value={assigneeId} currentUser={point.assigned_to_user ?? undefined} disabled={busy} onChange={setAssigneeId} />
          ) : (
            <p className="mt-1 h-10 rounded border border-outline-variant px-3 py-2 font-bold text-on-surface">{point.assigned_to_user?.full_name ?? 'Unassigned'}</p>
          )}
        </div>
        {canEditAssignment && (
          <button
            disabled={busy}
            onClick={() => onSave(point, {
              assigned_to_user_id: assigneeId ? Number(assigneeId) : null,
              category,
              due_date: dueDate ? `${dueDate}T00:00:00` : null,
            })}
            className="inline-flex h-10 items-center justify-center gap-2 rounded bg-primary px-3 text-label-sm font-black text-on-primary disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            Assign Punch Point
          </button>
        )}
      </div>
      <div className="rounded border border-outline-variant bg-surface-container-low p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_160px_180px]">
          <div>
            <p className="text-[10px] font-black uppercase text-outline">Original Checkpoint</p>
            <p className="mt-1 font-black text-on-surface">{point.question_number ? `${point.question_number}. ` : ''}{point.checkpoint_question ?? 'No linked checkpoint'}</p>
            {point.checkpoint_description && <p className="mt-1 text-on-surface-variant">{point.checkpoint_description}</p>}
          </div>
          <ReadOnlyValue label="Original Answer" value={point.original_answer ?? 'PENDING'} />
          <ReadOnlyValue label="Original Remarks" value={point.original_remarks ?? '-'} />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 text-label-sm text-on-surface-variant md:grid-cols-4">
          <span>Department: <span className="font-bold text-on-surface">{point.department ?? point.owning_department}</span></span>
          <span>Annexure: <span className="font-bold text-on-surface">{point.annexure_name ?? '-'}</span></span>
          <span>Raised By: <span className="font-bold text-on-surface">{point.raised_by?.full_name ?? '-'}</span></span>
          <span>Assigned By: <span className="font-bold text-on-surface">{point.assigned_by?.full_name ?? '-'} {point.assigned_by?.role ? `(${point.assigned_by.role})` : ''}</span></span>
        </div>
        <div className="mt-3 space-y-2">
          <p className="text-[10px] font-black uppercase text-outline">Existing Checkpoint Attachments</p>
          {(point.checkpoint_attachments ?? []).map((attachment) => <AttachmentRow key={attachment.id} pssrId={pssrId} attachment={attachment} onError={setMessage} />)}
          {(point.checkpoint_attachments ?? []).length === 0 && <p className="text-on-surface-variant">No checkpoint attachment uploaded.</p>}
        </div>
      </div>
      {!canEditAssignment && canUpdate && (
        <div className="grid grid-cols-1 gap-2 border-t border-outline-variant pt-3 md:grid-cols-[150px_1fr_1fr_auto]">
          <select disabled={busy} value={status} onChange={(event) => setStatus(event.target.value as 'OPEN' | 'IN_PROGRESS' | 'CLOSED')} className={`h-9 px-2 ${SELECT_FIELD_CLASS}`}>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="CLOSED">Closed</option>
          </select>
          <input disabled={busy} value={progressRemarks} onChange={(event) => setProgressRemarks(event.target.value)} placeholder="Progress remarks" className="h-9 rounded border border-outline-variant bg-transparent px-2 text-body-sm disabled:opacity-60" />
          <input disabled={busy} value={closureRemarks} onChange={(event) => setClosureRemarks(event.target.value)} placeholder="Closure remarks" className="h-9 rounded border border-outline-variant bg-transparent px-2 text-body-sm disabled:opacity-60" />
          <button
            disabled={busy}
            onClick={() => onSave(point, {
              status,
              progress_remarks: progressRemarks.trim() || null,
              closure_remarks: closureRemarks.trim() || null,
            })}
            className="inline-flex h-9 items-center justify-center gap-2 rounded border border-outline-variant px-3 text-label-sm font-black text-on-surface disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            Save Progress
          </button>
        </div>
      )}
      <div className="space-y-2 border-t border-outline-variant pt-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          {canUpdate && <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded border border-outline-variant px-3 text-label-sm font-black text-on-surface">
            Add Evidence
            <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.txt,.csv" className="hidden" onChange={(event) => setEvidenceFiles(Array.from(event.target.files ?? []))} />
          </label>}
          {evidenceFiles.length > 0 && <span className="text-on-surface-variant">{evidenceFiles.length} file(s) ready</span>}
          {evidenceFiles.length > 0 && <button disabled={evidenceMutation.isPending} onClick={() => evidenceMutation.mutate()} className="h-9 rounded bg-primary px-3 text-label-sm font-black text-on-primary disabled:opacity-50">Upload Evidence</button>}
        </div>
        {(point.evidence_attachments ?? []).map((evidence) => <PunchEvidenceRow key={evidence.id} evidence={evidence} onError={setMessage} />)}
        {(point.evidence_attachments ?? []).length === 0 && <p className="text-on-surface-variant">No closure evidence uploaded yet.</p>}
        {message && <p className="font-bold text-primary">{message}</p>}
      </div>
    </div>
  );
};

const EditAssignmentRow: React.FC<{
  assignment: EditAssignmentDraft;
  index: number;
  fixed: boolean;
  onChange: (index: number, patch: Partial<EditAssignmentDraft>) => void;
  onRemove: () => void;
}> = ({ assignment, index, fixed, onChange, onRemove }) => {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);
  const usersQuery = useTeamDirectory({
    page: 1,
    limit: 50,
    department: assignment.department || undefined,
    search: debouncedSearch.trim() || undefined,
    role: 'TEAM_MEMBER',
  });
  const users = usersQuery.data?.records ?? [];
  const selectedUser = users.find((user) => String(user.id) === assignment.userId);
  return (
    <div className={`grid min-w-[960px] grid-cols-[minmax(360px,1fr)_150px_170px_280px] items-start gap-2 px-3 pt-1 pb-2 ${assignment.userId ? '' : 'text-on-surface-variant'}`}>
      <div className="space-y-1">
        <input disabled={!assignment.department} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, code, department, designation" className="h-9 w-full rounded border border-outline-variant bg-transparent px-3 text-body-sm outline-none disabled:opacity-60" />
        <select disabled={!assignment.department || usersQuery.isLoading} value={assignment.userId} onChange={(event) => onChange(index, { userId: event.target.value })} className={`h-9 min-w-0 ${SELECT_FIELD_CLASS} ${assignment.userId ? '' : 'text-on-surface-variant'}`}>
          <option value="">{assignment.department ? 'Select filtered member' : 'Select department first'}</option>
          {users.map((user) => <option key={user.id} value={user.id}>{memberOptionLabel(user)}</option>)}
        </select>
      </div>
      <span className="truncate text-body-sm font-bold">{selectedUser?.employee_id ?? '-'}</span>
      <span className="truncate text-body-sm font-bold">{selectedUser?.designation ?? '-'}</span>
      <div className="flex items-center gap-2">
        <button disabled={!assignment.department} onClick={() => onChange(index, { userId: '' })} className="h-8 w-32 rounded border border-outline-variant px-2 text-[11px] font-black text-primary disabled:opacity-50">Change Member</button>
        <button disabled={fixed && !assignment.userId} onClick={fixed ? () => onChange(index, { userId: '' }) : onRemove} className="h-8 w-32 rounded border border-outline-variant px-2 text-[11px] font-black text-error disabled:opacity-50">Remove Member</button>
      </div>
    </div>
  );
};

const ReadOnlyValue: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded border border-outline-variant bg-surface-container-low p-3">
    <p className="text-[10px] font-black uppercase text-outline">{label}</p>
    <p className="mt-1 text-body-sm font-bold text-on-surface break-words">{value || 'Not recorded'}</p>
  </div>
);

const CheckpointAuditBlock: React.FC<{
  pssrId: string;
  response?: NonNullable<NonNullable<PSSRWorkflowDetail['questions']>[number]['latest_response']> | null;
}> = ({ pssrId, response }) => {
  const [message, setMessage] = useState<string | null>(null);
  if (!response) {
    return (
      <div className="mt-3 rounded border border-outline-variant bg-surface-container-low px-3 py-2 text-label-sm font-bold text-on-surface-variant">
        No answer recorded yet.
      </div>
    );
  }
  const attachments = response.attachments ?? [];
  return (
    <div className="mt-3 rounded border border-outline-variant bg-surface-container-low p-3 text-label-sm">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_120px_170px_1fr]">
        <div>
          <p className="text-[10px] font-black uppercase text-outline">Answered By</p>
          <p className="font-black text-on-surface">{response.responded_by?.full_name ?? 'Not recorded'}</p>
          <p className="font-bold text-on-surface-variant">{response.responded_by?.employee_id ?? '-'}</p>
          <p className="font-bold text-on-surface-variant">{response.responded_by?.department ?? response.responded_by_department ?? '-'}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase text-outline">Answer</p>
          <p className="font-black text-on-surface">{response.response}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase text-outline">Last Updated</p>
          <p className="font-bold text-on-surface">{response.updated_at || response.responded_at ? new Date(response.updated_at ?? response.responded_at ?? '').toLocaleString() : '-'}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase text-outline">Remarks</p>
          <p className="font-bold text-on-surface-variant">{response.remarks || '-'}</p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {attachments.map((attachment) => <AttachmentRow key={attachment.id} pssrId={pssrId} attachment={attachment} onError={setMessage} />)}
        {attachments.length === 0 && <p className="text-on-surface-variant">No attachment uploaded.</p>}
        {message && <p className="font-bold text-error">{message}</p>}
      </div>
    </div>
  );
};

const AttachmentRow: React.FC<{ pssrId: string; attachment: CheckpointAttachment; onError: (message: string) => void }> = ({ pssrId, attachment, onError }) => (
  <div className="flex flex-col gap-2 rounded border border-outline-variant bg-surface-container-lowest p-3 md:flex-row md:items-center md:justify-between">
    <div className="min-w-0">
      <p className="truncate font-black text-on-surface">{attachment.file_name}</p>
      <p className="text-on-surface-variant">
        Uploaded by {attachment.uploaded_by?.full_name ?? 'Unknown'} | {attachment.uploaded_by?.employee_id ?? attachment.uploader_employee_code ?? '-'} | {attachment.uploaded_by?.department ?? '-'}
      </p>
      <p className="text-on-surface-variant">Upload Date: {attachment.uploaded_at ? new Date(attachment.uploaded_at).toLocaleString() : '-'}</p>
    </div>
    <div className="flex shrink-0 gap-2">
      <button
        type="button"
        onClick={() => void api.downloadCheckpointAttachment(pssrId, attachment.id, attachment.file_name).catch((error: Error) => onError(error.message))}
        className="rounded border border-outline-variant px-3 py-2 text-[11px] font-black text-primary hover:bg-primary/5"
      >
        Download
      </button>
      <button
        type="button"
        onClick={() => void api.viewCheckpointAttachment(pssrId, attachment.id).catch((error: Error) => onError(error.message))}
        className="rounded border border-outline-variant px-3 py-2 text-[11px] font-black text-on-surface hover:bg-surface-container-low"
      >
        View
      </button>
    </div>
  </div>
);

const PunchEvidenceRow: React.FC<{
  evidence: NonNullable<PunchPoint['evidence_attachments']>[number];
  onError: (message: string) => void;
}> = ({ evidence, onError }) => (
  <div className="flex flex-col gap-2 rounded border border-outline-variant bg-surface-container-lowest p-3 md:flex-row md:items-center md:justify-between">
    <div className="min-w-0">
      <p className="truncate font-black text-on-surface">{evidence.file_name}</p>
      <p className="text-on-surface-variant">Uploaded by {evidence.uploaded_by?.full_name ?? 'Unknown'} | {evidence.uploaded_at ? new Date(evidence.uploaded_at).toLocaleString() : '-'}</p>
    </div>
    <div className="flex shrink-0 gap-2">
      <button type="button" onClick={() => void api.viewPunchEvidence(evidence.pssr_id, evidence.punch_point_id, evidence.id).catch((error: Error) => onError(error.message))} className="rounded border border-outline-variant px-3 py-2 text-[11px] font-black text-on-surface">View</button>
      <button type="button" onClick={() => void api.downloadPunchEvidence(evidence.pssr_id, evidence.punch_point_id, evidence.id, evidence.file_name).catch((error: Error) => onError(error.message))} className="rounded border border-outline-variant px-3 py-2 text-[11px] font-black text-primary">Download</button>
    </div>
  </div>
);

function workflowStateLabel(state?: string | null): string {
  const labels: Record<string, string> = {
    UNDER_PREPARATION: 'Under Preparation',
    SUBMITTED: 'To Do',
    TODO: 'To Do',
    IN_PROGRESS: 'In Progress',
    COMPLETED_BY_DEPARTMENT: 'Completed by Department',
    COMPLETED: 'Completed by Department',
    COMPLETED_BY_TEAM: 'Completed by Department',
    PENDING_AREA_OWNER_APPROVAL: 'Pending Area Owner Approval',
    PENDING_APPROVAL: 'Pending Area Owner Approval',
    CLOSED: 'Closed',
    AREA_OWNER_PENDING: 'Pending Area Owner Approval',
    AREA_OWNER_APPROVED: 'Area Owner Approved',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    Draft: 'Under Preparation',
    Assigned: 'To Do',
    'Pending Review': 'Completed',
    Completed: 'Completed',
    Approved: 'Approved',
  };
  return labels[state ?? ''] ?? state ?? 'Not recorded';
}

function historyActionLabel(action: string): string {
  const labels: Record<string, string> = {
    CREATE: 'Created',
    WORKFLOW_SUBMITTED: 'Submitted',
    QUESTION_RESPONSE: 'Question completed',
    PUNCH_CREATED: 'Punch created',
    PUNCH_RESOLVED: 'Punch resolved',
    WORKFLOW_TRANSITION: 'Approved',
    WORKFLOW_AUTO_TRANSITION: 'Status updated',
  };
  return labels[action] ?? action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const EmptyPanel: React.FC<{ message: string }> = ({ message }) => (
  <div className="border border-outline-variant p-6 rounded text-center bg-surface-container-low">
    <p className="text-label-md font-black text-on-surface uppercase tracking-widest">{message}</p>
  </div>
);
