// Added Admin dashboard page with profile summary and PSSR initiator management. The dashboard shows the logged in admin's profile details in a tile format, and includes a section to search for users and assign/revoke PSSR initiator roles. Active initiators are listed with options to revoke their role. Used React Query for data fetching and mutations, with loading and error states handled gracefully throughout the UI.

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BadgeCheck,
  Building2,
  IdCard,
  ShieldCheck,
  Search,
  Loader2,
  AlertTriangle,
  Terminal,
  Trash2,
} from 'lucide-react';

import { PageTitle, StatusBadge } from '../../components/shared/UIItems';
import { useAuth } from '../../contexts/AuthContext';
import { api, type AdminUser, type DepartmentTeamMembers } from '../../services/api';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');

  const departmentsQuery = useQuery<DepartmentTeamMembers[], Error>({
    queryKey: ['admin-dashboard-dept-team-members-initiator'],
    queryFn: () => api.getDepartmentsTeamMembers(true),
  });

  const pssrAssignmentsQuery = useQuery<any, Error>({
    queryKey: ['admin-pssr-assignments-active'],
    queryFn: () =>
      api.listPssrInitiatorAssignments({
        status_filter: 'ACTIVE',
        page: 1,
        per_page: 100,
      }),
    enabled: true,
  });

  const activeAssignmentsByUserId = useMemo(() => {
    const rows =
      pssrAssignmentsQuery.data?.records ??
      pssrAssignmentsQuery.data?.data ??
      pssrAssignmentsQuery.data?.items ??
      [];
    const map = new Map<number, any>();
    for (const row of rows) {
      if (row?.user_id) map.set(row.user_id, row);
    }
    return map;
  }, [pssrAssignmentsQuery.data]);

  const allUsers = useMemo(() => {
    const departments = departmentsQuery.data ?? [];
    const usersMap = new Map<number, any>();
    for (const dept of departments) {
      for (const member of dept.teamMembers) {
        if (!usersMap.has(member.id)) {
          usersMap.set(member.id, member);
        }
      }
    }
    return Array.from(usersMap.values());
  }, [departmentsQuery.data]);

  const usersById = useMemo(() => {
    const m = new Map<number, any>();
    for (const u of allUsers) m.set(u.id, u);
    return m;
  }, [allUsers]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return allUsers;
    const query = searchQuery.toLowerCase();
    return allUsers.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query) ||
        u.employee_id?.toLowerCase().includes(query)
    );
  }, [searchQuery, allUsers]);

  const assignRoleMutation = useMutation({
    mutationFn: (payload: { userId: number; department: string }) =>
      api.updateUser(payload.userId, {
        role: 'TEAM_MEMBER',
        department: payload.department,
        active: true,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard-dept-team-members-initiator'] });
    },
  });

  const deassignRoleMutation = useMutation({
    mutationFn: (payload: { userId: number }) =>
      api.updateUser(payload.userId, {
        active: false,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard-dept-team-members-initiator'] });
    },
  });

  const assignPssrInitiatorMutation = useMutation({
    mutationFn: (payload: { userId: number }) =>
      api.assignPssrInitiator({
        user_id: payload.userId,
        project_reference: null,
        reason: null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-pssr-assignments-active'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard-dept-team-members-initiator'] });
    },
  });

  const hardDeletePssrInitiatorMutation = useMutation({
    mutationFn: (payload: { assignmentId: number }) =>
      api.hardDeletePssrInitiatorAssignment(payload.assignmentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-pssr-assignments-active'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard-dept-team-members-initiator'] });
    },
  });


  if (!user) return null;


  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageTitle
        title="Admin Dashboard"
        subtitle="Welcome to Admin Dashboard"
        breadcrumbs={['System', 'Admin']}
      />

      {/* Profile tiles */}
      <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <ProfileTile icon={ShieldCheck} label="Name" value={user.full_name} />
          <ProfileTile icon={IdCard} label="Employee ID" value={user.employee_id} />
          <ProfileTile icon={BadgeCheck} label="Role" value={user.role} />
          <ProfileTile icon={Building2} label="Department" value={user.department} />
        </div>
      </div>

      {/* Search for PSSR Initiators */}
      <section className="bg-surface-container-lowest border border-outline-variant p-6 rounded shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <Terminal className="w-5 h-5 text-primary" />
          <div>
            <p className="text-label-sm font-black uppercase tracking-widest text-on-surface">
              Appoint PSSR Initiators
            </p>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Search for a user and click "Initiator" to appoint them as a PSSR initiator.
            </p>
          </div>
        </div>

        {/* Search Input */}
        <div className="flex items-center gap-2 border border-outline-variant rounded px-3 py-2 bg-surface-container-lowest focus-within:border-primary">
          <Search className="w-5 h-5 text-on-surface-variant" />
          <input
            type="text"
            placeholder="Search by name, email, or employee ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none text-body-md text-on-surface placeholder-on-surface-variant"
          />
        </div>

        {/* Loading State */}
        {departmentsQuery.isLoading && (
          <div className="bg-surface-container-lowest border border-outline-variant rounded p-8 flex items-center justify-center text-primary">
            <Loader2 className="w-5 h-5 mr-3 animate-spin" />
            <span className="text-label-md font-black uppercase tracking-widest">
              Loading users
            </span>
          </div>
        )}

        {/* Error State */}
        {departmentsQuery.error && (
          <div className="bg-error/5 border border-error/30 rounded p-5 flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-error shrink-0 mt-0.5" />
            <div>
              <p className="text-label-md font-black uppercase tracking-widest text-error">
                Failed to load users
              </p>
              <p className="text-body-sm text-on-surface-variant mt-1">
                {departmentsQuery.error instanceof Error ? departmentsQuery.error.message : String(departmentsQuery.error)}
              </p>
            </div>
          </div>
        )}

        {/* Search Results / Default List */}
        {!departmentsQuery.isLoading && (
          <div className="space-y-2">
            {filteredUsers.length === 0 ? (
              <div className="p-4 text-center text-on-surface-variant">
                <p className="text-body-sm">
                  {searchQuery.trim()
                    ? `No users found matching "${searchQuery}"`
                    : 'No users available for initiating PSSR.'}
                </p>
              </div>
            ) : (
              filteredUsers.map((member) => {
                const assignment = activeAssignmentsByUserId.get(member.id);
                const isInitiator = !!assignment && assignment.status === 'ACTIVE';
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-4 border border-outline-variant rounded p-3 bg-surface-container-lowest"
                  >
                    <div className="min-w-0">
                      <p className="text-body-md font-bold text-on-surface truncate">{member.full_name}</p>
                      <p className="text-[11px] text-on-surface-variant font-mono truncate">
                        {member.employee_id} • {member.email}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <StatusBadge
                          status={isInitiator ? 'PSSR Initiator' : 'Not Initiator'}
                          type={isInitiator ? 'success' : 'default'}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isInitiator ? (
                        <button
                          disabled={assignPssrInitiatorMutation.isPending}
                          onClick={() => assignPssrInitiatorMutation.mutate({ userId: member.id })}
                          className="flex items-center px-3 py-2 bg-surface-container-lowest border border-outline-variant text-primary font-black text-label-md rounded hover:bg-surface-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Assign as PSSR initiator"
                        >
                          <Terminal className="w-4 h-4 mr-2" />
                          Initiator
                        </button>
                      ) : (
                        <button
                          disabled={hardDeletePssrInitiatorMutation.isPending || !assignment}
                          onClick={() => {
                            if (!assignment) return;
                            hardDeletePssrInitiatorMutation.mutate({ assignmentId: assignment.id });
                          }}
                          className="flex items-center px-3 py-2 bg-error/15 hover:bg-error/25 text-error font-black text-label-md rounded transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Hard delete initiator assignment (keeps user)"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </section>

      {/* PSSR initiator summary */}
      <section className="bg-surface-container-lowest border border-outline-variant p-6 rounded shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <Terminal className="w-5 h-5 text-primary" />
          <div>
            <p className="text-label-sm font-black uppercase tracking-widest text-on-surface">
              PSSR Initiator Assignments
            </p>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Active initiators are managed per team member. Deassigning TEAM_MEMBER will reflect in initiator access.
            </p>
          </div>
        </div>

        {pssrAssignmentsQuery.isLoading && (
          <div className="flex items-center justify-center text-primary">
            <Loader2 className="w-5 h-5 mr-3 animate-spin" />
            <span className="text-label-md font-black uppercase tracking-widest">Loading initiator list</span>
          </div>
        )}

        {pssrAssignmentsQuery.error && (
          <div className="bg-error/5 border border-error/30 rounded p-5 flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-error shrink-0 mt-0.5" />
            <div>
              <p className="text-label-md font-black uppercase tracking-widest text-error">
                Failed to load initiator assignments
              </p>
              <p className="text-body-sm text-on-surface-variant mt-1">
                {pssrAssignmentsQuery.error instanceof Error ? pssrAssignmentsQuery.error.message : String(pssrAssignmentsQuery.error)}
              </p>
            </div>
          </div>
        )}

        {!pssrAssignmentsQuery.error && (
          <div>
            {activeAssignmentsByUserId.size === 0 ? (
              <div className="text-body-sm text-on-surface-variant">No active initiator(s)</div>
            ) : (
              <div className="space-y-2">
                {Array.from(activeAssignmentsByUserId.values()).map((assignment: any) => {
                  const user = usersById.get(assignment.user_id) ?? null;
                  return (
                    <div key={assignment.id} className="flex items-center justify-between gap-4 border border-outline-variant rounded p-3 bg-surface-container-lowest">
                      <div className="min-w-0">
                        <p className="text-body-md font-bold text-on-surface truncate">{user?.full_name ?? `User ${assignment.user_id}`}</p>
                        <p className="text-[11px] text-on-surface-variant font-mono truncate">{user?.employee_id ?? ''} • {user?.email ?? ''}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          disabled={hardDeletePssrInitiatorMutation.isPending}
                          onClick={() => hardDeletePssrInitiatorMutation.mutate({ assignmentId: assignment.id })}
                          className="flex items-center px-3 py-2 bg-error/15 hover:bg-error/25 text-error font-black text-label-md rounded transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Revoke
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>
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
