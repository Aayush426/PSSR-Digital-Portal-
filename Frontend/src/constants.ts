import { 
  BarChart, 
  Users, 
  ShieldCheck, 
  Building2, 
  FileText, 
  GitBranch, 
  ClipboardCheck, 
  PieChart, 
  History, 
  Settings 
} from 'lucide-react';

export const navigationItems = [
  { id: 'dashboard', name: 'Dashboard', icon: BarChart, href: '#' },
  { id: 'users', name: 'Users', icon: Users, href: '#' },
  { id: 'roles', name: 'Roles & Permissions', icon: ShieldCheck, href: '#' },
  { id: 'departments', name: 'Departments', icon: Building2, href: '#' },
  { id: 'annexures', name: 'Annexures', icon: FileText, href: '#' },
  { id: 'workflow', name: 'Workflow Configuration', icon: GitBranch, href: '#' },
  { id: 'pssr', name: 'PSSR Records', icon: ClipboardCheck, href: '#' },
  { id: 'reports', name: 'Reports', icon: PieChart, href: '#' },
  { id: 'audit', name: 'Audit Logs', icon: History, href: '#' },
  { id: 'settings', name: 'Settings', icon: Settings, href: '#' },
];

export const departmentsData = [
  {
    id: 1,
    name: 'Crude Distillation Unit (CDU-1)',
    code: 'OPS-CDU01',
    members: 84,
    annexures: ['A-1', 'A-4', 'B-2'],
    status: 'Global' as DepartmentStatus,
  },
  {
    id: 2,
    name: 'Catalytic Cracker Unit (FCCU)',
    code: 'OPS-FCC02',
    members: 112,
    annexures: ['A-1', 'C-9'],
    status: 'Global' as DepartmentStatus,
  },
  {
    id: 3,
    name: 'Fire & Safety Department',
    code: 'SAF-FSD09',
    members: 45,
    annexures: ['S-1', 'S-2'],
    status: 'Restricted' as DepartmentStatus,
  },
  {
    id: 4,
    name: 'Electrical Maintenance',
    code: 'MTN-ELC04',
    members: 62,
    annexures: ['M-3'],
    status: 'Global' as DepartmentStatus,
  },
  {
    id: 5,
    name: 'Instrumentation & Control',
    code: 'MTN-INS05',
    members: 38,
    annexures: ['M-3', 'M-7'],
    status: 'Hidden' as DepartmentStatus,
  },
  {
    id: 6,
    name: 'Lube Oil Blending Plant',
    code: 'OPS-LOB08',
    members: 24,
    annexures: [],
    status: 'Global' as DepartmentStatus,
  },
];

export const annexuresData = [
  {
    id: 1,
    name: 'Mechanical Integrity Checklist',
    departments: ['MECHANICAL', 'SAFETY'],
    version: 'v2.4.1',
    lastUpdated: '24 Oct 2023',
    status: 'ACTIVE',
  },
  {
    id: 2,
    name: 'Electrical Systems Isolation Log',
    departments: ['ELECTRICAL'],
    version: 'v1.1.0',
    lastUpdated: '12 Nov 2023',
    status: 'ACTIVE',
  },
  {
    id: 3,
    name: 'Chemical Reactivity Worksheet',
    departments: ['CHEMICAL', 'R&D'],
    version: 'v3.0.0',
    lastUpdated: '02 Dec 2023',
    status: 'INACTIVE',
  },
  {
    id: 4,
    name: 'Fire Suppression Validation',
    departments: ['OPERATIONS', 'FIRE & SAFETY'],
    version: 'v2.0.5',
    lastUpdated: '15 Dec 2023',
    status: 'ACTIVE',
  },
  {
    id: 5,
    name: 'Pressure Vessel Inspection Form',
    departments: ['MAINTENANCE'],
    version: 'v4.2.1',
    lastUpdated: '05 Jan 2024',
    status: 'ACTIVE',
  },
];

export const pssrRecordsData = [
  {
    id: 'PSSR-2023-0042',
    type: 'MOC',
    initiator: { name: 'A. Sharma', initial: 'AS' },
    areaOwner: 'John Doe',
    state: 'Completed by Department',
    department: 'Mechanical',
    date: '24 Oct 2023',
  },
  {
    id: 'PSSR-2023-0041',
    type: 'Non-MOC',
    initiator: { name: 'R. Kumar', initial: 'RK' },
    areaOwner: 'Sarah Jenkins',
    state: 'Technical Review',
    department: 'Electrical',
    date: '22 Oct 2023',
  },
  {
    id: 'PSSR-2023-0040',
    type: 'MOC',
    initiator: { name: 'L. Moore', initial: 'LM' },
    areaOwner: 'David Chen',
    state: 'Final Approval',
    department: 'Instrumentation',
    date: '21 Oct 2023',
  },
  {
    id: 'PSSR-2023-0039',
    type: 'MOC',
    initiator: { name: 'B. Thompson', initial: 'BT' },
    areaOwner: 'John Doe',
    state: 'Completed by Department',
    department: 'Mechanical',
    date: '19 Oct 2023',
  },
  {
    id: 'PSSR-2023-0038',
    type: 'Non-MOC',
    initiator: { name: 'M. White', initial: 'MW' },
    areaOwner: 'Sarah Jenkins',
    state: 'Initiated',
    department: 'Operations',
    date: '18 Oct 2023',
  },
];

export type DepartmentStatus = 'Global' | 'Restricted' | 'Hidden';

export const statsDepartments = [
  { label: 'TOTAL DEPARTMENTS', value: '12', color: 'on-surface' },
  { label: 'ACTIVE UNITS', value: '10', color: 'primary' },
  { label: 'TOTAL PERSONNEL', value: '458', color: 'on-surface' },
  { label: 'AVG. ANNEXURES', value: '4.2', color: 'on-surface' },
];

export const statsAnnexures = [
  { label: 'TOTAL ANNEXURES', value: '24', trend: '+ 4%' },
  { label: 'ACTIVE TEMPLATES', value: '18', total: '75% of total' },
  { label: 'PENDING UPDATES', value: '3', alert: 'Action Required', color: 'error' },
  { label: 'STORAGE USED', value: '1.2 GB', meta: 'Cloud Managed' },
];

export const statsPSSR = [
  { label: 'Total Records', value: '1,248', trend: '+12 this week' },
  { label: 'Pending Area Approval', value: '42', alert: 'High Priority', color: 'error' },
  { label: 'Under Review', value: '156', meta: 'Avg 3.2 days' },
  { label: 'Completed (30d)', value: '89', meta: '98% compliance' },
];
