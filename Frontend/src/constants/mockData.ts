import { User, Department, Annexure, PSSRRecord, AuditLog } from '../types/app.types';

export const MOCK_USERS: User[] = [
  { id: '1', employeeId: 'REF-1001', name: 'John Doe', email: 'j.doe@refinery.com', department: 'Operations', role: 'Admin', status: 'Active', lastLogin: '2023-11-15 09:30' },
  { id: '2', employeeId: 'REF-2045', name: 'Sarah Jenkins', email: 's.jenkins@refinery.com', department: 'Safety', role: 'Area Owner', status: 'Active', lastLogin: '2023-11-14 14:20' },
  { id: '3', employeeId: 'REF-3012', name: 'Robert Chen', email: 'r.chen@refinery.com', department: 'Maintenance', role: 'Team Member', status: 'Active', lastLogin: '2023-11-15 08:15' },
  { id: '4', employeeId: 'REF-4098', name: 'Anita Sharma', email: 'a.sharma@refinery.com', department: 'Engineering', role: 'PSSR Initiator', status: 'Inactive', lastLogin: '2023-10-22 11:45' },
];

export const MOCK_DEPARTMENTS: Department[] = [
  { id: '1', name: 'Crude Distillation Unit (CDU-1)', code: 'OPS-CDU01', members: 84, annexures: ['A-1', 'A-4', 'B-2'], status: 'Active', visibility: 'Global' },
  { id: '2', name: 'Catalytic Cracker Unit (FCCU)', code: 'OPS-FCC02', members: 112, annexures: ['A-1', 'C-9'], status: 'Active', visibility: 'Global' },
  { id: '3', name: 'Fire & Safety Dept', code: 'SAF-FSD09', members: 45, annexures: ['S-1', 'S-2'], status: 'Active', visibility: 'Restricted' },
  { id: '4', name: 'Electrical Maintenance', code: 'MTN-ELC04', members: 62, annexures: ['M-3'], status: 'Active', visibility: 'Global' },
];

export const MOCK_ANNEXURES: Annexure[] = [
  { id: '1', name: 'Mechanical Integrity Checklist', version: 'v2.4.1', departments: ['Maintenance', 'Operations'], lastUpdated: '2023-10-24', status: 'Active' },
  { id: '2', name: 'Electrical Isolation Log', version: 'v1.1.0', departments: ['Electrical'], lastUpdated: '2023-11-12', status: 'Active' },
  { id: '3', name: 'Chemical Reactivity Data', version: 'v3.0.0', departments: ['Chemical', 'R&D'], lastUpdated: '2023-12-02', status: 'Draft' },
];

export const MOCK_PSSR_RECORDS: PSSRRecord[] = [
  { id: 'PSSR-2023-0042', unit: 'CDU-1', initiator: 'A. Sharma', department: 'Mechanical', stage: 'Pending Site Visit', status: 'Pending', dueDate: '2023-11-20' },
  { id: 'PSSR-2023-0041', unit: 'FCCU', initiator: 'R. Kumar', department: 'Electrical', stage: 'Technical Review', status: 'In Progress', dueDate: '2023-11-18' },
  { id: 'PSSR-2023-0040', unit: 'Sulfur Recovery', initiator: 'L. Moore', department: 'Instrumentation', stage: 'Final Approval', status: 'Approved', dueDate: '2023-11-15' },
];

export const MOCK_AUDIT_LOGS: AuditLog[] = [
  { id: '1', timestamp: '2023-11-15 10:45', user: 'John Doe', module: 'Departments', action: 'Update Visibility', oldValue: 'Global', newValue: 'Restricted', ipAddress: '10.0.4.122' },
  { id: '2', timestamp: '2023-11-15 09:15', user: 'Sarah Jenkins', module: 'PSSR', action: 'Approved Stage 2', newValue: 'Stage 3', ipAddress: '10.0.5.15' },
];
