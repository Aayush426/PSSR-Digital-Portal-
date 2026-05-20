import React from 'react';
import { BadgeCheck, Building2, IdCard, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Minimal TEAM_MEMBER dashboard.
 *
 * This screen intentionally starts with identity and role context only. Future
 * releases can add assigned PSSR tasks, checklist work queues, and escalation
 * badges without changing the auth routing model.
 */
export const TeamDashboardPage: React.FC = () => {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <RoleDashboardShell
      title="Team Member Dashboard"
      welcome="Welcome to Team Member Dashboard"
      user={user}
      onLogout={() => void logout()}
    />
  );
};

const RoleDashboardShell: React.FC<{
  title: string;
  welcome: string;
  user: NonNullable<ReturnType<typeof useAuth>['user']>;
  onLogout: () => void;
}> = ({ title, welcome, user, onLogout }) => (
  <div className="min-h-screen bg-surface">
    <header className="h-14 bg-surface-container-lowest border-b border-outline-variant px-6 flex items-center justify-between">
      <div>
        <h1 className="text-headline-sm font-black uppercase text-primary">{title}</h1>
        <p className="text-[10px] uppercase tracking-widest text-outline font-bold">
          Digital PSSR Portal
        </p>
      </div>
      <button
        onClick={onLogout}
        className="text-[11px] font-black uppercase tracking-widest text-error border border-error/30 px-3 py-2 rounded"
      >
        Terminate Session
      </button>
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
