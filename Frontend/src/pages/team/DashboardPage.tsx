import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, AlertCircle, Terminal, BadgeCheck, ClipboardList, PlusCircle, X, Save, Send, UserRound, ListChecks, Search, UserCheck, RefreshCw, ChevronDown, Filter, Trash2, UsersRound } from 'lucide-react';
import { motion } from 'motion/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { PageTitle } from '../../components/shared/UIItems';
import { ActivityFeedSkeleton, DashboardCardSkeleton } from '../../components/shared/Skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { useAnnexureDetail, useAnnexures } from '../../hooks/useAnnexures';
import { useCreatePSSR } from '../../hooks/useCreatePSSR';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { usePSSRDetail } from '../../hooks/usePSSRDetail';
import { useTeamDirectory } from '../../hooks/useTeamDirectory';
import { useTeamMemberDashboard } from '../../hooks/useTeamMemberDashboard';
import { api, type AdminUser } from '../../services/api';
import type { AnnexureQuestion, AnnexureSummary } from '../../types/annexure.types';
import type { TeamDashboardTask } from '../../types/team-dashboard.types';
import { canInitiatePSSR } from '../../utils/rbac';

type TeamDashboardTab = 'preparation' | 'todo' | 'completed' | 'approval' | 'approved';
type PSSRDetailTab = 'details' | 'punchlist' | 'history';
type PSSRKind = 'MOC' | 'NON_MOC';
type DepartmentName = string;
type CheckpointType = 'DOCUMENT' | 'FIELD';

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
  selectedQuestionIds: string[];
  selectedQuestionMap: Record<string, SelectedChecklistQuestion>;
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
  selectedQuestionIds: [],
  selectedQuestionMap: {},
  customQuestions: [],
});

export const TeamMemberDashboard: React.FC = () => {
  const isAssignedWorkspace = window.location.pathname.startsWith('/team/assigned');
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
  ].filter(monitorOnly);
  const underPreparation = isAssignedWorkspace ? emptyTasks : (data?.draft ?? []).filter(monitorOnly);
  const todo = isAssignedWorkspace
    ? (data?.assigned ?? data?.todo ?? emptyTasks).filter(executionOnly)
    : initiatedTasks.filter((task) => task.workflow_state === 'TODO' || task.status === 'To Do');
  const inProgress = (data?.in_progress ?? emptyTasks).filter(executionOnly);
  const completed = isAssignedWorkspace
    ? (data?.completed ?? emptyTasks).filter(executionOnly)
    : initiatedTasks.filter((task) => task.workflow_state === 'COMPLETED_BY_TEAM');
  const pendingApproval = initiatedTasks.filter((task) => task.workflow_state === 'PENDING_APPROVAL');
  const approved = initiatedTasks.filter((task) => task.workflow_state === 'APPROVED');
  const activity = data?.activity ?? [];
  const isInitiator = canInitiatePSSR(user);

  useEffect(() => {
    setActiveTab(isAssignedWorkspace ? 'todo' : 'preparation');
  }, [isAssignedWorkspace]);

  const stats = useMemo(() => {
    if (!isAssignedWorkspace) {
      return [
        { label: 'Under Preparation', value: String(underPreparation.length), icon: Clock, trend: 'Editable', color: 'text-tertiary' },
        { label: 'To Do', value: String(todo.length), icon: ClipboardList, trend: 'Submitted', color: 'text-primary' },
        { label: 'Completed', value: String(completed.length), icon: CheckCircle2, trend: 'Team Done', color: 'text-green-600' },
        { label: 'Pending Approval', value: String(pendingApproval.length), icon: AlertCircle, trend: 'Area Owner', color: 'text-on-surface-variant' },
        { label: 'Approved', value: String(approved.length), icon: BadgeCheck, trend: 'Closed', color: 'text-green-700' },
      ];
    }
    return [
      { label: 'To Do', value: String(todo.length), icon: ClipboardList, trend: 'Ready', color: 'text-on-surface-variant' },
      { label: 'In Progress', value: String(inProgress.length), icon: AlertCircle, trend: 'Active Work', color: 'text-primary' },
      { label: 'Completed', value: String(completed.length), icon: CheckCircle2, trend: 'Done', color: 'text-green-600' },
    ];
  }, [approved.length, completed.length, inProgress.length, isAssignedWorkspace, pendingApproval.length, todo.length, underPreparation.length]);

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

  const visibleTasks = activeTab === 'preparation'
    ? underPreparation
    : activeTab === 'todo'
      ? todo
      : activeTab === 'approval'
        ? pendingApproval
        : activeTab === 'approved'
          ? approved
          : completed;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <PageTitle
          title={isAssignedWorkspace ? 'Assigned PSSR' : isInitiator ? 'PSSR Initiator Dashboard' : 'My Work Dashboard'}
          subtitle={isAssignedWorkspace ? 'Execute assigned PSSR work for your department or team-leader scope.' : 'Create new PSSR workflows and monitor records you initiated.'}
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
              <h2 className="text-headline-sm font-bold text-on-surface">Initiator Workflow</h2>
              <p className="text-body-sm text-on-surface-variant">Your capability is user-based. It permits new PSSR creation without changing your TEAM_MEMBER role.</p>
            </div>
            <ClipboardList className="w-5 h-5 text-primary" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-0 border-b border-outline-variant">
            {[
              { label: 'Under Preparation', value: data?.initiator_stats.under_preparation ?? data?.initiator_stats.draft_pssr ?? 0 },
              { label: 'To Do', value: data?.initiator_stats.todo ?? 0 },
              { label: 'Completed', value: data?.initiator_stats.completed_by_team ?? 0 },
              { label: 'Pending Approval', value: data?.initiator_stats.pending_area_owner_approval ?? 0 },
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
              <p className="text-body-sm text-on-surface-variant mt-1">Execution queues stay in Assigned PSSR; this dashboard monitors workflows you initiated.</p>
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
            {!isAssignedWorkspace && <TabButton active={activeTab === 'todo'} onClick={() => setActiveTab('todo')} label={`To Do (${todo.length})`} />}
            {isAssignedWorkspace && <TabButton active={activeTab === 'todo'} onClick={() => setActiveTab('todo')} label={`To Do (${todo.length})`} />}
            {isAssignedWorkspace && <TabButton active={activeTab === 'completed'} onClick={() => setActiveTab('completed')} label={`Completed (${completed.length})`} />}
            {!isAssignedWorkspace && <TabButton active={activeTab === 'completed'} onClick={() => setActiveTab('completed')} label={`Completed by Department/Team Member (${completed.length})`} />}
            {!isAssignedWorkspace && <TabButton active={activeTab === 'approval'} onClick={() => setActiveTab('approval')} label={`Pending Area Owner Approval (${pendingApproval.length})`} />}
            {!isAssignedWorkspace && <TabButton active={activeTab === 'approved'} onClick={() => setActiveTab('approved')} label={`Approved (${approved.length})`} />}
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
  const selectedQuestions = form.selectedQuestionIds
    .map((id) => form.selectedQuestionMap[id])
    .filter(Boolean);

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
    const assignments = membersWithEmployees
      .flatMap((row) => row.employeeIds.slice(0, 1).map((employeeId) => ({ department: row.department, user_id: Number(employeeId) })));
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
    const customQuestionDrafts = form.customQuestions.filter((question) => question.questionText.trim());
    if (customQuestionDrafts.some((question) => !question.description.trim())) {
      setFormError('Description is required for every custom checkpoint.');
      return;
    }
    const invalidQuestionOwners = customQuestionDrafts
      .filter((question) => !question.departmentOwner || !memberIdForDepartment(departmentsWithMembers, question.departmentOwner))
      .map((question) => question.departmentOwner || 'Unassigned');
    if (invalidQuestionOwners.length) {
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
        assigned_user_id: Number(memberIdForDepartment(departmentsWithMembers, question.departmentOwner)),
        category: question.category.trim() || 'Custom',
        mandatory: question.mandatory,
        remarks: question.remarks.trim() || null,
        attachments: question.attachments,
      }));
    createPSSR.mutate({
      plant_unit: form.plantUnit.trim(),
      equipment_system: form.equipmentSystem.trim(),
      moc_type: form.type,
      moc_number: form.type === 'MOC' ? form.mocNumber.trim() : null,
      description: form.type === 'MOC' ? form.mocNumber.trim() : null,
      workflow_state: workflowState,
      team_leader_user_id: form.leaderId ? Number(form.leaderId) : null,
      annexure_ids: selectedAnnexures.map((annexure) => annexure.id),
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
              <h3 className="text-label-md font-black uppercase text-on-surface">PSSR Team Leader</h3>
            </div>
            <div className="p-4">
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
                      const selectedCount = selectedQuestions.filter((question) => question.annexureId === annexure.id).length;
                      return (
                        <AnnexureQuestionSelector
                          key={annexure.id}
                          annexure={annexure}
                          expanded={expandedAnnexureId === annexure.id}
                          selectedCount={selectedCount}
                          selectedQuestionIds={form.selectedQuestionIds}
                          selectedMap={form.selectedQuestionMap}
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
          <p className="truncate text-label-sm font-bold text-on-surface-variant">{employee.employee_id} | {employee.department ?? 'No department'} | {employee.designation ?? 'No designation'}</p>
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
                  <span className="block truncate text-label-sm font-bold text-on-surface-variant">{employee.employee_id} | {employee.designation ?? 'No designation'}</span>
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
  selectedQuestionIds: string[];
  selectedMap: Record<string, SelectedChecklistQuestion>;
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
    departmentOwner: '',
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
  if (rowDepartment === 'Operations' || rowDepartment === 'PM Operation') return department.includes('operation');
  if (rowDepartment === 'Instrumentation') return department.includes('instrument');
  if (rowDepartment === 'Others') return department.includes('other') || department.includes('it') || department.includes('admin');
  return department.includes(rowDepartment.toLowerCase());
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const detailQuery = usePSSRDetail(pssrId);
  const [responses, setResponses] = useState<Record<number, { response: 'YES' | 'NO' | 'NA' | 'PENDING'; remarks: string; attachments: Array<Record<string, unknown>> }>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PSSRDetailTab>('details');

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
    mutationFn: ({ questionId, payload }: { questionId: number; payload: { response: 'YES' | 'NO' | 'NA' | 'PENDING'; remarks?: string | null; attachments?: Array<Record<string, unknown>> } }) => api.respondToPSSRQuestion(pssrId, questionId, payload),
    onSuccess: () => {
      setMessage('Response saved.');
      invalidate();
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const detail = detailQuery.data;
  const isAdmin = user?.role === 'ADMIN';
  const canSubmit = Boolean(detail?.permissions?.can_submit);
  const departmentProgress = useMemo(() => {
    if (!detail) return [];
    const questions = detail.questions ?? [];
    const assignments = detail.assignments ?? [];
    const departments = Array.from(new Set([...assignments.map((item) => item.department), ...questions.map((item) => item.department_owner)]));
    return departments.map((department) => {
      const departmentQuestions = questions.filter((question) => question.department_owner === department);
      const answered = departmentQuestions.filter((question) => question.latest_response && question.latest_response.response !== 'PENDING').length;
      const assignedMembers = assignments.filter((assignment) => assignment.department === department);
      const completed = departmentQuestions.every((question) => !question.mandatory || (question.latest_response && question.latest_response.response !== 'PENDING'))
        && assignedMembers.length > 0;
      return { department, departmentQuestions, answered, pending: Math.max(departmentQuestions.length - answered, 0), assignedMembers, completed };
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

  const updateDraft = (questionId: number, patch: Partial<{ response: 'YES' | 'NO' | 'NA' | 'PENDING'; remarks: string; attachments: Array<Record<string, unknown>> }>) => {
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
    <div className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-sm p-3 md:p-6 overflow-y-auto">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-6xl bg-surface-container-lowest border border-outline-variant rounded shadow-xl">
        <div className="sticky top-0 z-10 bg-surface-container-lowest border-b border-outline-variant px-4 md:px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">PSSR Details</p>
            <h2 className="text-headline-sm font-black text-on-surface">{pssrId}</h2>
          </div>
          <div className="flex items-center gap-2">
            {canSubmit && <button disabled={submitMutation.isPending} onClick={() => submitMutation.mutate()} className="inline-flex items-center gap-2 rounded bg-primary px-3 py-2 text-label-sm font-black text-on-primary disabled:opacity-50"><Send className="h-4 w-4" />Submit PSSR</button>}
            <button onClick={onClose} aria-label="Close PSSR details" className="inline-flex h-10 w-10 items-center justify-center border border-outline-variant rounded text-on-surface hover:bg-surface-container-low"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="p-4 md:p-6 space-y-5">
          <div className="flex flex-wrap gap-2 border-b border-outline-variant pb-3">
            <TabButton active={activeTab === 'details'} onClick={() => setActiveTab('details')} label="PSSR Details" />
            <TabButton active={activeTab === 'punchlist'} onClick={() => setActiveTab('punchlist')} label="Punchlist" />
            <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} label="History" />
          </div>
          {message && <div className="rounded border border-outline-variant bg-surface-container-low px-4 py-3 text-body-sm font-bold text-on-surface">{message}</div>}
          {detailQuery.isLoading && <div className="h-40 rounded border border-outline-variant bg-surface-container-low animate-pulse" />}
          {detailQuery.error && <div className="rounded border border-error/30 bg-error/5 px-4 py-3 text-body-sm font-bold text-error">{detailQuery.error.message}</div>}
          {detail && (
            <>
              {activeTab === 'details' && <section className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <ReadOnlyValue label="Plant / Unit" value={detail.plant_unit} />
                <ReadOnlyValue label="Equipment / System" value={detail.equipment_system} />
                <ReadOnlyValue label="MOC Details" value={detail.moc_type === 'MOC' ? (detail.moc_number ?? 'MOC number pending') : 'Non MOC PSSR'} />
                <ReadOnlyValue label="Initiator" value={detail.initiator?.full_name ?? (detail.initiator_user_id ? `User ${detail.initiator_user_id}` : 'Not recorded')} />
                <ReadOnlyValue label="Team Leader" value={detail.team_leader?.full_name ?? (detail.team_leader_user_id ? `User ${detail.team_leader_user_id}` : 'Not assigned')} />
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
                    <div key={row.department} className="grid grid-cols-1 md:grid-cols-[1fr_160px_130px] gap-2 px-4 py-3 text-body-sm">
                      <span className="font-bold text-on-surface">{row.department}<span className="block text-label-sm text-on-surface-variant">{row.assignedMembers.map((assignment) => assignment.user?.full_name ?? `User ${assignment.user_id}`).join(', ') || 'No assigned members'}</span></span>
                      <span className="text-on-surface-variant">{row.answered}/{row.departmentQuestions.length} answered</span>
                      <span className={row.completed ? 'text-green-700 font-bold' : 'text-on-surface-variant'}>{row.completed ? 'Completed' : `${row.pending} pending`}</span>
                    </div>
                  ))}
                  {departmentProgress.length === 0 && <p className="px-4 py-3 text-body-sm text-on-surface-variant">No department progress recorded.</p>}
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
                  {(detail.punch_points ?? []).map((point) => (
                    <div key={point.id} className="px-4 py-3 text-body-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-on-surface">{point.title}</span>
                        <span className="rounded bg-surface-container-low px-2 py-1 text-[10px] font-black uppercase text-outline">{point.status}</span>
                      </div>
                      <p className="mt-1 text-on-surface-variant">{point.description ?? 'No description recorded.'}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase text-outline">{point.owning_department}</p>
                    </div>
                  ))}
                  {(detail.punch_points ?? []).length === 0 && <p className="px-4 py-3 text-body-sm text-on-surface-variant">No punch points recorded.</p>}
                </div>
              </section>}

              {activeTab === 'details' && <section className="space-y-3">
                <h3 className="text-label-md font-black uppercase text-on-surface">Questions</h3>
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
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-[140px_1fr_auto] gap-2">
                          <select value={draft.response} onChange={(event) => updateDraft(question.id, { response: event.target.value as 'YES' | 'NO' | 'NA' | 'PENDING' })} className="h-10 rounded border border-outline-variant bg-transparent px-3 text-body-sm outline-none">
                            {['PENDING', 'YES', 'NO', 'NA'].map((item) => <option key={item} value={item}>{item}</option>)}
                          </select>
                          <input value={draft.remarks} onChange={(event) => updateDraft(question.id, { remarks: event.target.value })} placeholder="Remarks or evidence reference" className="h-10 rounded border border-outline-variant bg-transparent px-3 text-body-sm outline-none" />
                          <button disabled={respondMutation.isPending} onClick={() => respondMutation.mutate({ questionId: question.id, payload: draft })} className="h-10 rounded bg-primary px-3 text-label-sm font-black text-on-primary disabled:opacity-50">Save</button>
                        </div>
                      ) : (
                        <p className="mt-3 text-label-sm font-bold text-on-surface-variant">{question.latest_response ? `${question.latest_response.response} - ${question.latest_response.remarks ?? 'No remarks'}` : 'Read-only for your role or department.'}</p>
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
                      <p className="text-on-surface-variant">{row.summary}</p>
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
    </div>
  );
};

const ReadOnlyValue: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded border border-outline-variant bg-surface-container-low p-3">
    <p className="text-[10px] font-black uppercase text-outline">{label}</p>
    <p className="mt-1 text-body-sm font-bold text-on-surface break-words">{value || 'Not recorded'}</p>
  </div>
);

function workflowStateLabel(state?: string | null): string {
  const labels: Record<string, string> = {
    UNDER_PREPARATION: 'Under Preparation',
    TODO: 'To Do',
    IN_PROGRESS: 'In Progress',
    COMPLETED_BY_TEAM: 'Completed by Team Members/Departments',
    PENDING_APPROVAL: 'Pending Area Owner Approval',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    Draft: 'Under Preparation',
    Assigned: 'To Do',
    'Pending Review': 'Pending Area Owner Approval',
    Completed: 'Completed by Team Members/Departments',
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
