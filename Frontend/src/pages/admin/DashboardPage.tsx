import React from 'react';
import { PageTitle } from '../../components/shared/UIItems';
import { BadgeCheck, Building2, IdCard, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageTitle 
        title="Admin Dashboard" 
        subtitle="Welcome to Admin Dashboard"
        breadcrumbs={['System', 'Admin']} 
      />

      <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <ProfileTile icon={ShieldCheck} label="Name" value={user.full_name} />
          <ProfileTile icon={IdCard} label="Employee ID" value={user.employee_id} />
          <ProfileTile icon={BadgeCheck} label="Role" value={user.role} />
          <ProfileTile icon={Building2} label="Department" value={user.department} />
        </div>
      </div>
    </div>
  );
};

const ProfileTile: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}> = ({ icon: Icon, label, value }) => (
  <div className="border border-outline-variant bg-surface-container-low p-4 rounded">
    <Icon className="w-5 h-5 text-primary mb-3" />
    <p className="text-label-sm text-outline uppercase font-black tracking-widest">{label}</p>
    <p className="text-body-md text-on-surface font-bold mt-1 break-words">{value}</p>
  </div>
);
