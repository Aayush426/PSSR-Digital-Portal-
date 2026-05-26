<<<<<<< HEAD
import React, { useState } from 'react';
import { BadgeCheck, Building2, IdCard, ShieldCheck, Plus, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { PssrDetails } from '../../types/app.types';
import { PssrCreationModal } from '../../components/pssr/PssrCreationModal';
=======
import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock, AlertCircle, FileText, Terminal, BadgeCheck, ClipboardList, PlusCircle } from 'lucide-react';
import { motion } from 'motion/react';
>>>>>>> 9b293bf (Refactor enterprise department workflows and improve PSSR admin UX)

/**
 * TEAM_MEMBER dashboard + PSSR Initiator workflow launcher.
 */
export const TeamDashboardPage: React.FC = () => {
  const { user, logout } = useAuth();
  const [openCreate, setOpenCreate] = useState(false);

  const myPssrsQuery = useQuery({
    queryKey: ['pssr:my', 'team', 1],
    queryFn: () => api.listMyPssrs({ page: 1, limit: 20 }),
    enabled: Boolean(user),
  });

<<<<<<< HEAD
  if (!user) return null;

  return (
    <>
      <RoleDashboardShell
        title="Team Member Dashboard"
        welcome="Welcome to Team Member Dashboard"
        user={user}
        onLogout={() => void logout()}
        rightHeaderAction={
          <button
            onClick={() => setOpenCreate(true)}
            className="px-3 py-2 rounded bg-primary text-on-primary font-black uppercase tracking-widest shadow-md hover:bg-primary-container transition-all flex items-center"
            disabled={!user.is_pssr_initiator}
            title={!user.is_pssr_initiator ? 'You are not assigned as PSSR initiator' : 'Create new PSSR'}
=======
const emptyTasks: TeamDashboardTask[] = [];

export const TeamMemberDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TeamDashboardTab>('todo');
  const { data, isLoading, error } = useTeamMemberDashboard();

  const todo = data?.todo ?? emptyTasks;
  const inProgress = data?.in_progress ?? emptyTasks;
  const completed = data?.completed ?? emptyTasks;
  const activity = data?.activity ?? [];
  const isInitiator = data?.is_pssr_initiator ?? false;

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
          subtitle={isInitiator ? 'Create and own PSSR workflows, assign departments, and track approval readiness.' : 'Manage assigned PSSR tasks and track completion status.'}
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
              <p className="text-body-sm text-on-surface-variant">Your capability is user-based. Create new PSSR records and manage owned workflow execution.</p>
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
              <p className="text-body-sm text-on-surface-variant mt-1">New PSSR creation will collect metadata, refinery unit, departments, assigned members, annexures, timelines, and due dates.</p>
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
>>>>>>> 9b293bf (Refactor enterprise department workflows and improve PSSR admin UX)
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New PSSR
          </button>
        }
      />

      <PssrCreationModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onCreated={() => void myPssrsQuery.refetch()}
      />

      <div className="max-w-5xl mx-auto p-6 -mt-8">
        <section className="bg-surface-container-lowest border border-outline-variant p-6 rounded shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-label-md font-black uppercase tracking-widest text-on-surface">
                My PSSRs
              </p>
              <p className="text-body-sm text-on-surface-variant mt-1">
                Your drafts and submitted PSSRs appear here.
              </p>
            </div>
          </div>

          {myPssrsQuery.isLoading && (
            <div className="flex items-center justify-center text-primary">
              <Loader2 className="w-5 h-5 mr-3 animate-spin" />
              <span className="text-label-md font-black uppercase tracking-widest">Loading PSSRs</span>
            </div>
          )}

          {myPssrsQuery.error && (
            <div className="bg-error/5 border border-error/30 rounded p-4 text-error">
              {myPssrsQuery.error instanceof Error ? myPssrsQuery.error.message : String(myPssrsQuery.error)}
            </div>
          )}

          {!myPssrsQuery.isLoading && !myPssrsQuery.error && (
            <div className="space-y-3">
              {(myPssrsQuery.data?.records ?? []) as PssrDetails[] ? (
                ((myPssrsQuery.data?.records ?? []) as PssrDetails[]).length === 0 ? (
                  <div className="text-body-sm text-on-surface-variant">
                    No PSSRs found. Create a new one to begin.
                  </div>
                ) : (
                  (((myPssrsQuery.data?.records ?? []) as PssrDetails[]).map((pssr) => (
                    <div
                      key={pssr.id}
                      className="flex items-center justify-between gap-4 border border-outline-variant rounded p-3 bg-surface-container-lowest"
                    >
                      <div className="min-w-0">
                        <p className="text-body-md font-bold text-on-surface font-mono truncate">
                          {pssr.pssr_number}
                        </p>
                        <p className="text-[11px] text-on-surface-variant mt-0.5">
                          {pssr.is_moc ? 'MOC' : 'Non-MOC'} • {pssr.status}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-widest text-outline font-black">
                          Status
                        </p>
                        <p className="text-body-sm font-black text-primary">{pssr.status}</p>
                      </div>
                    </div>
                  )))
                )
              ) : null}
            </div>
          )}
        </section>
      </div>
    </>
  );
};

const RoleDashboardShell: React.FC<{
  title: string;
  welcome: string;
  user: NonNullable<ReturnType<typeof useAuth>['user']>;
  onLogout: () => void;
  rightHeaderAction?: React.ReactNode;
}> = ({ title, welcome, user, onLogout, rightHeaderAction }) => (
  <div className="min-h-screen bg-surface">
    <header className="h-14 bg-surface-container-lowest border-b border-outline-variant px-6 flex items-center justify-between">
      <div>
        <h1 className="text-headline-sm font-black uppercase text-primary">{title}</h1>
        <p className="text-[10px] uppercase tracking-widest text-outline font-bold">
          Digital PSSR Portal
        </p>
      </div>

      <div className="flex items-center gap-3">
        {rightHeaderAction}
        <button
          onClick={onLogout}
          className="text-[11px] font-black uppercase tracking-widest text-error border border-error/30 px-3 py-2 rounded"
        >
          Terminate Session
        </button>
      </div>
    </header>

    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <section className="bg-surface-container-lowest border border-outline-variant p-6 rounded shadow-sm">
        <p className="text-headline-md font-black text-on-surface">{welcome}</p>
        <p className="text-body-sm text-on-surface-variant mt-2">
          Secure refinery workflow access is active for this personnel profile.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <ProfileTile icon={ShieldCheck} label="Name" value={user.full_name} />
        <ProfileTile icon={IdCard} label="Employee ID" value={user.employee_id} />
        <ProfileTile icon={BadgeCheck} label="Role" value={user.role} />
        <ProfileTile icon={Building2} label="Department" value={user.department} />
      </section>
    </main>
  </div>
);

const ProfileTile: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}> = ({ icon: Icon, label, value }) => (
  <div className="bg-surface-container-lowest border border-outline-variant p-4 rounded">
    <Icon className="w-5 h-5 text-primary mb-3" />
    <p className="text-label-sm text-outline uppercase font-black tracking-widest">{label}</p>
    <p className="text-body-md text-on-surface font-bold mt-1 break-words">{value}</p>
  </div>
);
