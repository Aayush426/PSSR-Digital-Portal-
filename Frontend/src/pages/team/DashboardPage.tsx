import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock, AlertCircle, FileText, Terminal, BadgeCheck, ClipboardList, PlusCircle } from 'lucide-react';
import { motion } from 'motion/react';

import { PageTitle } from '../../components/shared/UIItems';
import { ActivityFeedSkeleton, DashboardCardSkeleton } from '../../components/shared/Skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { useTeamMemberDashboard } from '../../hooks/useTeamMemberDashboard';
import type { TeamDashboardTask } from '../../types/team-dashboard.types';
import { canInitiatePSSR } from '../../utils/rbac';

type TeamDashboardTab = 'todo' | 'inprogress' | 'completed';

const emptyTasks: TeamDashboardTask[] = [];

export const TeamMemberDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TeamDashboardTab>('todo');
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
            <button className="inline-flex items-center justify-center gap-2 bg-primary text-on-primary px-4 py-2 rounded text-label-md font-bold shadow-sm">
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
    </div>
  );
};

export const TeamDashboardPage = TeamMemberDashboard;

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
