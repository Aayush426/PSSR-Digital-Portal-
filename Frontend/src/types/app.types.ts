
export type UserRole = 'Admin' | 'Team Member' | 'Area Owner';

export interface User {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  department: string;
  role: UserRole;
  status: 'Active' | 'Inactive';
  lastLogin: string;
}

export type DepartmentStatus = 'Active' | 'Inactive';

export interface Department {
  id: string;
  name: string;
  code: string;
  members: number;
  annexures: string[];
  status: DepartmentStatus;
  visibility: 'Global' | 'Restricted' | 'Hidden';
}

export interface Annexure {
  id: string;
  name: string;
  version: string;
  departments: string[];
  lastUpdated: string;
  status: 'Active' | 'Inactive' | 'Draft';
}

export interface PSSRRecord {
  id: string;
  unit: string;
  initiator: string;
  department: string;
  stage: string;
  status: 'Pending' | 'In Progress' | 'Approved' | 'Rejected' | 'Overdue';
  dueDate: string;
  submissionDate?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  module: string;
  action: string;
  oldValue?: string;
  newValue?: string;
  ipAddress: string;
}
