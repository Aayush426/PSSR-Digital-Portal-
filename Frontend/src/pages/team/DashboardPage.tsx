import React, { useState } from 'react';
import { BadgeCheck, Building2, IdCard, ShieldCheck, Plus, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { PssrDetails } from '../../types/app.types';
import { PssrCreationModal } from '../../components/pssr/PssrCreationModal';

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
