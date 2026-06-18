import { 
  LayoutDashboard, 
  Users, 
  ShieldCheck, 
  Building2, 
  FileText, 
  GitBranch, 
  ClipboardCheck, 
  UserRoundCheck,
  PieChart, 
  History, 
  Settings 
} from 'lucide-react';

export const NAV_ITEMS = [
  { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
  { id: 'users', name: 'Users', icon: Users, path: '/admin/users' },
  { id: 'roles', name: 'Roles & Permissions', icon: ShieldCheck, path: '/admin/roles' },
  { id: 'departments', name: 'Departments', icon: Building2, path: '/admin/departments' },
  { id: 'annexures', name: 'Annexures', icon: FileText, path: '/admin/annexures' },
  { id: 'workflow', name: 'Workflow Configuration', icon: GitBranch, path: '/admin/workflow' },
  { id: 'pssr', name: 'PSSR Records', icon: ClipboardCheck, path: '/admin/pssr' },
  { id: 'initiators', name: 'PSSR Initiators', icon: UserRoundCheck, path: '/admin/pssr-initiators' },
  { id: 'reports', name: 'Reports', icon: PieChart, path: '/admin/reports' },
  { id: 'audit', name: 'Audit Logs', icon: History, path: '/admin/audit' },
  { id: 'settings', name: 'Settings', icon: Settings, path: '/admin/settings' },
];
