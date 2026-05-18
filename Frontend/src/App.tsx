import React, { useState, useEffect } from 'react';
import { AdminLayout } from './layouts/AdminLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { isAuthenticated } from './utils/auth';

// Pages
import { DashboardPage } from './pages/admin/DashboardPage';
import { UsersPage } from './pages/admin/UsersPage';
import { RolesPermissionsPage } from './pages/admin/RolesPermissionsPage';
import { DepartmentsPage } from './pages/admin/DepartmentsPage';
import { AnnexuresPage } from './pages/admin/AnnexuresPage';
import { WorkflowConfigurationPage } from './pages/admin/WorkflowConfigurationPage';
import { PSSRRecordsPage } from './pages/admin/PSSRRecordsPage';
import { ReportsPage } from './pages/admin/ReportsPage';
import { AuditLogsPage } from './pages/admin/AuditLogsPage';
import { SettingsPage } from './pages/admin/SettingsPage';

export default function App() {
  const [isAuth, setIsAuth] = useState<boolean | null>(null);
  const [currentPath, setCurrentPath] = useState('/admin/dashboard');

  useEffect(() => {
    // Initial check on mount
    setIsAuth(isAuthenticated());
  }, []);

  const handleLogin = () => {
    setIsAuth(true);
    setCurrentPath('/admin/dashboard');
  };

  // While checking auth state, show nothing or a tiny loader to prevent flicker
  if (isAuth === null) return null;

  if (!isAuth) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const renderContent = () => {
    switch (currentPath) {
      case '/admin/dashboard': return <DashboardPage />;
      case '/admin/users': return <UsersPage />;
      case '/admin/roles': return <RolesPermissionsPage />;
      case '/admin/departments': return <DepartmentsPage />;
      case '/admin/annexures': return <AnnexuresPage />;
      case '/admin/workflow': return <WorkflowConfigurationPage />;
      case '/admin/pssr': return <PSSRRecordsPage />;
      case '/admin/reports': return <ReportsPage />;
      case '/admin/audit': return <AuditLogsPage />;
      case '/admin/settings': return <SettingsPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <AdminLayout currentPath={currentPath} onNavigate={setCurrentPath}>
      {renderContent()}
    </AdminLayout>
  );
}
