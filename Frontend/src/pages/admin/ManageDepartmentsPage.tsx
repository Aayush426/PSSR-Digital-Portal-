import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Building2,
  Check,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
  Users,
} from 'lucide-react';

import { PageTitle, StatusBadge } from '../../components/shared/UIItems';
import { api, type DepartmentTeamMembers } from '../../services/api';

// Fixed list of departments as per requirements
const FIXED_DEPARTMENTS = [
  'Safety/PSM',
  'Operation',
  'Process',
  'Mechanical',
  'Inspection',
  'Civil',
  'Electrical',
  'Instrumental',
  'Fire',
  'IT',
];

type TabId = 'departments' | 'team-members' | 'apply-impact';

const TABS: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'departments', label: 'Manage Departments', icon: Building2 },
  { id: 'team-members', label: 'Manage Team Members', icon: Users },
  { id: 'apply-impact', label: 'Apply / Impact', icon: Building2 },
];

export const ManageDepartmentsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('departments');
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [addMemberSearchQuery, setAddMemberSearchQuery] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);

  const queryClient = useQueryClient();

  // Fetch departments with team members (includeInactive=true returns all users)
  const departmentsQuery = useQuery<DepartmentTeamMembers[], Error>({
    queryKey: ['manage-departments-team-members'],
    queryFn: () => api.getDepartmentsTeamMembers(true),
  });

  // Extract all unique team members from all departments (includes active and inactive)
  const allAvailableUsers = useMemo(() => {
    const seen = new Set<number>();
    const users = [];
    for (const dept of departmentsQuery.data ?? []) {
      for (const member of dept.teamMembers ?? []) {
        if (!seen.has(member.id)) {
          seen.add(member.id);
          users.push(member);
        }
      }
    }
    return users;
  }, [departmentsQuery.data]);

  // Mutation: Assign team member to department
  const assignMemberMutation = useMutation({
    mutationFn: (payload: { userId: number; department: string }) =>
      api.assignTeamMemberToDepartment({
        user_id: payload.userId,
        department: payload.department,
        active: true,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manage-departments-team-members'] });
      setIsAddingMember(false);
      setShowDeleteConfirm(null);
    },
  });

  // Mutation: Remove team member from department
  // NOTE: This is a logical removal: deactivate the user (soft delete) so row is preserved.
  const removeMemberMutation = useMutation({
    mutationFn: (payload: { userId: number }) => api.updateUser(payload.userId, { active: false }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manage-departments-team-members'] });
      setShowDeleteConfirm(null);
    },
  });

  const departments = departmentsQuery.data ?? [];

  // Get team members who are not currently active in the selected department.
  // This includes all users from all departments except those actively assigned.
  const unassignedMembers = useMemo(() => {
    if (!selectedDepartment) return [];

    const dept = departments.find((d) => d.department === selectedDepartment);
    const assignedActive =
      dept?.teamMembers?.filter((m: any) => m.active).map((m: any) => m.id) ?? [];

    return allAvailableUsers.filter((user) => !assignedActive.includes(user.id));
  }, [selectedDepartment, departments, allAvailableUsers]);

  // Filter dropdown options based on search query
  const filteredDropdownMembers = useMemo(() => {
    if (!addMemberSearchQuery.trim()) return unassignedMembers;

    const query = addMemberSearchQuery.toLowerCase();
    return unassignedMembers.filter(
      (user) =>
        user.full_name.toLowerCase().includes(query) ||
        user.employee_id.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    );
  }, [unassignedMembers, addMemberSearchQuery]);

  // Filter team members based on search
  const filteredTeamMembers = useMemo(() => {
    if (!selectedDepartment) return [];
    const dept = departments.find((d) => d.department === selectedDepartment);
    if (!dept) return [];

    return dept.teamMembers.filter(
      (member: any) =>
        member.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.employee_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [selectedDepartment, departments, searchQuery]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageTitle
        title="Manage Departments & Team Members"
        subtitle="View and manage department structures, assign and remove team members, and control access across the portal."
        breadcrumbs={['System', 'Admin', 'Manage Departments']}
      />

      {/* Tab Navigation */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded flex gap-1 p-1">
        {TABS.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 rounded text-label-sm font-black uppercase tracking-widest transition-all flex-1 ${
                isActive ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              <TabIcon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* DEPARTMENTS TAB */}
      {activeTab === 'departments' && (
        <section className="bg-surface-container-lowest border border-outline-variant p-6 rounded shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-primary" />
              <div>
                <p className="text-label-md font-black uppercase tracking-widest text-on-surface">Fixed Departments</p>
                <p className="text-body-sm text-on-surface-variant mt-1">
                  Portal departments. Team members are managed within these fixed categories.
                </p>
              </div>
            </div>

            <button
              className="flex items-center px-3 py-2 bg-surface-container-lowest border border-outline-variant text-label-md font-bold text-primary hover:bg-surface-container transition-colors rounded"
              onClick={() => void queryClient.invalidateQueries({ queryKey: ['manage-departments-team-members'] })}
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
          </div>

          {departmentsQuery.isLoading && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded p-8 flex items-center justify-center text-primary">
              <Loader2 className="w-5 h-5 mr-3 animate-spin" />
              <span className="text-label-md font-black uppercase tracking-widest">Loading Departments</span>
            </div>
          )}

          {departmentsQuery.error && (
            <div className="bg-error/5 border border-error/30 rounded p-5 flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-error shrink-0 mt-0.5" />
              <div>
                <p className="text-label-md font-black uppercase tracking-widest text-error">Failed to load departments</p>
                <p className="text-body-sm text-on-surface-variant mt-1">
                  {departmentsQuery.error instanceof Error
                    ? departmentsQuery.error.message
                    : String(departmentsQuery.error)}
                </p>
              </div>
            </div>
          )}

          {!departmentsQuery.error && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {FIXED_DEPARTMENTS.map((dept) => {
                const deptData = departments.find((d) => d.department === dept);
                const memberCount = deptData?.count ?? 0;

                return (
                  <div
                    key={dept}
                    className="border border-outline-variant rounded p-4 bg-surface-container-low hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => {
                      setSelectedDepartment(dept);
                      setActiveTab('team-members');
                    }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-label-md font-black uppercase tracking-widest text-on-surface">{dept}</p>
                        <p className="text-body-sm text-on-surface-variant mt-1">
                          {memberCount} team member{memberCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDepartment(dept);
                        setActiveTab('team-members');
                      }}
                      className="w-full flex items-center justify-center px-3 py-2 bg-primary hover:bg-primary-container text-on-primary font-black text-label-sm rounded transition-colors mt-3"
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Manage Members
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* TEAM MEMBERS TAB */}
      {activeTab === 'team-members' && (
        <section className="space-y-4">
          {/* Department Selector */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded p-4">
            <label className="block text-label-sm font-black uppercase tracking-widest text-on-surface mb-3">
              Select Department
            </label>
            <select
              value={selectedDepartment || ''}
              onChange={(e) => {
                setSelectedDepartment(e.target.value || null);
                setSearchQuery('');
                setIsAddingMember(false);
                setShowDeleteConfirm(null);
              }}
              className="w-full px-4 py-2 border border-outline-variant rounded bg-surface-container-lowest text-body-sm text-on-surface outline-none focus:border-primary transition-colors"
            >
              <option value="">-- Select a Department --</option>
              {FIXED_DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {selectedDepartment && (
            <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-label-md font-black uppercase tracking-widest text-on-surface">
                    {selectedDepartment} - Team Members
                  </p>
                  <p className="text-body-sm text-on-surface-variant mt-1">Manage team members for {selectedDepartment}</p>
                </div>

                <button
                  onClick={() => {
                    setIsAddingMember(true);
                    setAddMemberSearchQuery('');
                  }}
                  title="Open the assignment panel to add or re-activate department team members"
                  className="flex items-center px-4 py-2 bg-primary hover:bg-primary-container text-on-primary font-black text-label-md rounded transition-all"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Member
                </button>
              </div>

              {/* Add Member Form */}
              {isAddingMember && (
                <div className="border border-outline-variant rounded p-4 bg-surface-container-low space-y-3">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-label-sm font-black uppercase tracking-widest text-on-surface">Add Team Member</p>
                      <p className="text-body-sm text-on-surface-variant mt-1">
                        Pick a team member to assign to this department. Previously removed members remain available here for re-activation.
                      </p>
                    </div>
                    <button 
                      onClick={() => {
                        setIsAddingMember(false);
                        setAddMemberSearchQuery('');
                      }} 
                      className="text-on-surface-variant hover:text-on-surface"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>


                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Search by name, employee ID, or email..."
                      value={addMemberSearchQuery}
                      onChange={(e) => setAddMemberSearchQuery(e.target.value)}
                      className="w-full px-4 py-2 border border-outline-variant rounded bg-surface-container-lowest text-body-sm text-on-surface outline-none focus:border-primary transition-colors"
                    />
                    
                    {filteredDropdownMembers.length > 0 ? (
                      <div className="border border-outline-variant rounded bg-surface-container-lowest max-h-48 overflow-y-auto">
                        {filteredDropdownMembers.map((user: any) => (
                          <button
                            key={user.id}
                            onClick={() => {
                              assignMemberMutation.mutate({ userId: user.id, department: selectedDepartment! });
                              setAddMemberSearchQuery('');
                            }}
                            disabled={assignMemberMutation.isPending}
                            className="w-full text-left px-4 py-3 border-b border-outline-variant last:border-b-0 hover:bg-surface-container transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-bold text-body-sm text-on-surface">{user.full_name}</p>
                                <p className="text-[11px] text-on-surface-variant font-mono">{user.employee_id} • {user.email}</p>
                              </div>
                              {user.active === false && (
                                <span className="text-[10px] font-black bg-error/15 text-error px-2 py-1 rounded whitespace-nowrap ml-2">
                                  INACTIVE
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-body-sm text-on-surface-variant italic p-3 text-center border border-outline-variant rounded bg-surface-container-lowest">
                        {addMemberSearchQuery.trim() 
                          ? 'No team members match your search.' 
                          : 'All available team members are already assigned to this department.'}
                      </p>
                    )}
                  </div>

                  {assignMemberMutation.isPending && (
                    <div className="flex items-center text-primary">
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      <span className="text-label-sm font-bold">Adding member...</span>
                    </div>
                  )}

                  {assignMemberMutation.error && (
                    <div className="text-error text-body-sm">
                      Error: {assignMemberMutation.error instanceof Error ? assignMemberMutation.error.message : 'Failed to add member'}
                    </div>
                  )}
                </div>
              )}

              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by name, employee ID, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 pl-10 border border-outline-variant rounded bg-surface-container-lowest text-body-sm text-on-surface outline-none focus:border-primary transition-colors"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline">🔍</span>
              </div>

              {/* Team Members List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {departmentsQuery.isLoading ? (
                  <div className="flex items-center justify-center py-8 text-primary">
                    <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                    <span className="text-label-sm font-bold">Loading team members...</span>
                  </div>
                ) : filteredTeamMembers.length === 0 ? (
                  <div className="p-6 text-center border border-outline-variant rounded bg-surface-container-lowest">
                    <p className="text-body-sm text-on-surface-variant">
                      {searchQuery ? 'No team members match your search.' : 'No team members assigned to this department yet.'}
                    </p>
                  </div>
                ) : (
                  filteredTeamMembers.map((member: any) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between gap-4 border border-outline-variant rounded p-3 bg-surface-container-lowest hover:bg-surface-container transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-body-md font-bold text-on-surface">{member.full_name}</p>
                        <p className="text-[11px] text-on-surface-variant font-mono truncate">
                          {member.employee_id} • {member.email}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <StatusBadge status={member.active ? 'Active' : 'Inactive'} type={member.active ? 'success' : 'default'} />
                          {member.is_pssr_initiator && <StatusBadge status="PSSR Initiator" type="success" />}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {showDeleteConfirm === member.id ? (
                          <>
                            <button
                              onClick={() => removeMemberMutation.mutate({ userId: member.id })}
                              disabled={removeMemberMutation.isPending}
                              className="flex items-center px-3 py-2 bg-error/15 hover:bg-error/25 text-error font-black text-label-sm rounded transition-all disabled:opacity-40"
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Confirm
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(null)}
                              className="flex items-center px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface-variant font-black text-label-sm rounded hover:bg-surface-container transition-colors"
                            >
                              <X className="w-4 h-4 mr-1" />
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setShowDeleteConfirm(member.id)}
                            className="flex items-center px-3 py-2 bg-error/15 hover:bg-error/25 text-error font-black text-label-sm rounded transition-all"
                            title="Remove from department"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {!selectedDepartment && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded p-8 text-center">
              <p className="text-headline-sm font-black text-on-surface">Select a Department</p>
              <p className="text-body-sm text-on-surface-variant mt-2">Choose a department from above to view and manage its team members.</p>
            </div>
          )}
        </section>
      )}

      {/* APPLY / IMPACT TAB */}
      {activeTab === 'apply-impact' && (
        <section className="bg-surface-container-lowest border border-outline-variant p-6 rounded shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-primary" />
            <div>
              <p className="text-label-md font-black uppercase tracking-widest text-on-surface">Apply / Impact</p>
              <p className="text-body-sm text-on-surface-variant mt-1">
                Preview the current department → team-member mapping and initiator visibility impact. (Applies instantly when you Assign/Remove in other tabs.)
              </p>
            </div>
          </div>

          {departmentsQuery.isLoading ? (
            <div className="flex items-center justify-center text-primary pt-6">
              <Loader2 className="w-5 h-5 mr-3 animate-spin" />
              <span className="text-label-md font-black uppercase tracking-widest">Loading impact preview</span>
            </div>
          ) : departmentsQuery.error ? (
            <div className="bg-error/5 border border-error/30 rounded p-5 flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-error shrink-0 mt-0.5" />
              <div>
                <p className="text-label-md font-black uppercase tracking-widest text-error">Failed to load impact preview</p>
                <p className="text-body-sm text-on-surface-variant mt-1">
                  {departmentsQuery.error instanceof Error
                    ? departmentsQuery.error.message
                    : String(departmentsQuery.error)}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {departmentsQuery.data?.map((dept) => {
                const activeCount = dept.teamMembers.filter((m) => m.active).length;
                const inactiveCount = dept.teamMembers.filter((m) => !m.active).length;
                const initiatorCount = dept.teamMembers.filter((m) => m.is_pssr_initiator).length;

                return (
                  <div key={dept.department} className="border border-outline-variant rounded p-4 bg-surface-container-low">
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <p className="text-label-md font-black uppercase tracking-widest text-on-surface">{dept.department}</p>
                      <StatusBadge status={`${activeCount} active`} type="success" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="p-3 bg-surface-container-lowest border border-outline-variant rounded">
                        <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Team Members</p>
                        <p className="text-label-md font-black text-on-surface mt-1">{dept.teamMembers.length}</p>
                      </div>

                      <div className="p-3 bg-surface-container-lowest border border-outline-variant rounded">
                        <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Active / Inactive</p>
                        <p className="text-label-md font-black text-on-surface mt-1">
                          {activeCount} / {inactiveCount}
                        </p>
                      </div>

                      <div className="p-3 bg-surface-container-lowest border border-outline-variant rounded">
                        <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">PSSR Initiators</p>
                        <p className="text-label-md font-black text-on-surface mt-1">{initiatorCount}</p>
                      </div>
                    </div>

                    <p className="text-body-sm text-on-surface-variant mt-3">
                      Actions you take in other tabs (Assign / Remove / Assign Initiator) update this mapping immediately.
                    </p>
                  </div>
                );
              })}

              {(departmentsQuery.data ?? []).length === 0 && (
                <div className="p-8 text-center border-t border-outline-variant">
                  <p className="text-headline-sm font-black text-on-surface">No departments found</p>
                  <p className="text-body-sm text-on-surface-variant mt-2">Add TEAM_MEMBERs to departments from “Manage Team Members”.</p>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

