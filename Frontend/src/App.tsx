import React, { Suspense, lazy, useEffect, useState } from 'react';
import { AdminLayout } from './layouts/AdminLayout';
import { RoleLayout } from './layouts/RoleLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { GlobalAppLoader, RouteSkeleton } from './components/shared/Skeleton';
import { useAuth } from './contexts/AuthContext';
import { getApiBaseUrl } from './services/api';

const DashboardPage = lazy(() => import('./pages/admin/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const UsersPage = lazy(() => import('./pages/admin/UsersPage').then((module) => ({ default: module.UsersPage })));
const RolesPermissionsPage = lazy(() => import('./pages/admin/RolesPermissionsPage').then((module) => ({ default: module.RolesPermissionsPage })));
const DepartmentsPage = lazy(() => import('./pages/admin/DepartmentsPage').then((module) => ({ default: module.DepartmentsPage })));
const AnnexuresPage = lazy(() => import('./pages/admin/AnnexuresPage').then((module) => ({ default: module.AnnexuresPage })));
const WorkflowConfigurationPage = lazy(() => import('./pages/admin/WorkflowConfigurationPage').then((module) => ({ default: module.WorkflowConfigurationPage })));
const PSSRRecordsPage = lazy(() => import('./pages/admin/PSSRRecordsPage').then((module) => ({ default: module.PSSRRecordsPage })));
const PSSRInitiatorManagementPage = lazy(() => import('./pages/admin/PSSRInitiatorManagementPage').then((module) => ({ default: module.PSSRInitiatorManagementPage })));
const ReportsPage = lazy(() => import('./pages/admin/ReportsPage').then((module) => ({ default: module.ReportsPage })));
const AuditLogsPage = lazy(() => import('./pages/admin/AuditLogsPage').then((module) => ({ default: module.AuditLogsPage })));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const TeamDashboardPage = lazy(() => import('./pages/team/DashboardPage').then((module) => ({ default: module.TeamDashboardPage })));
const AreaOwnerDashboardPage = lazy(() => import('./pages/area-owner/DashboardPage').then((module) => ({ default: module.AreaOwnerDashboardPage })));

/**
 * Lightweight route shell with lazy-loaded pages.
 *
 * Route-level Suspense lets the shell stay visible while heavier modules load.
 * That mirrors enterprise refinery systems where navigation chrome should not
 * disappear during route transitions or code-split downloads.
 */
export default function App() {
  const { user, loading, authError, retrySession } = useAuth();
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!loading && user && (currentPath === '/' || currentPath === '/login')) {
      navigate(user.dashboard_path);
    }
  }, [currentPath, loading, user]);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  if (loading) {
    return <GlobalAppLoader />;
  }

  if (authError && user) {
    return (
      <AppFailurePanel
        title="Backend API unavailable"
        message={authError}
        actionLabel="Retry connection"
        onAction={() => void retrySession()}
      />
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const renderAdminContent = () => {
    switch (currentPath) {
      case '/admin/dashboard': return <DashboardPage />;
      case '/admin/users': return <UsersPage />;
      case '/admin/roles': return <RolesPermissionsPage />;
      case '/admin/departments': return <DepartmentsPage />;
      case '/admin/annexures': return <AnnexuresPage />;
      case '/admin/workflow': return <WorkflowConfigurationPage />;
      case '/admin/pssr': return <PSSRRecordsPage />;
      case '/admin/pssr-initiators': return <PSSRInitiatorManagementPage />;
      case '/admin/reports': return <ReportsPage />;
      case '/admin/audit': return <AuditLogsPage />;
      case '/admin/settings': return <SettingsPage />;
      default: return <DashboardPage />;
    }
  };

  if (currentPath.startsWith('/team')) {
    return (
      <ProtectedRoute allowedRoles={['TEAM_MEMBER', 'ADMIN']}>
        <RoleLayout currentPath={currentPath} onNavigate={navigate}>
          <Suspense fallback={<RouteSkeleton />}>
            <TeamDashboardPage />
          </Suspense>
        </RoleLayout>
      </ProtectedRoute>
    );
  }

  if (currentPath.startsWith('/area-owner')) {
    return (
      <ProtectedRoute allowedRoles={['AREA_OWNER']}>
        <RoleLayout currentPath={currentPath} onNavigate={navigate}>
          <Suspense fallback={<RouteSkeleton />}>
            <AreaOwnerDashboardPage />
          </Suspense>
        </RoleLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['ADMIN']}>
      <AdminLayout currentPath={currentPath} onNavigate={navigate}>
        <Suspense fallback={<RouteSkeleton />}>
          {renderAdminContent()}
        </Suspense>
      </AdminLayout>
    </ProtectedRoute>
  );
}

interface AppFailurePanelProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

const AppFailurePanel: React.FC<AppFailurePanelProps> = ({ title, message, actionLabel = 'Reload', onAction }) => (
  <div className="min-h-screen bg-surface-container-low flex items-center justify-center p-6">
    <div className="w-full max-w-xl rounded border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-widest text-primary">Digital PSSR Portal</p>
      <h1 className="mt-2 text-headline-sm font-black text-on-surface">{title}</h1>
      <p className="mt-3 text-body-sm text-on-surface-variant">{message}</p>
      <div className="mt-4 rounded border border-outline-variant bg-surface-container-low p-3">
        <p className="text-[10px] font-black uppercase text-outline">Configured API</p>
        <p className="mt-1 break-all text-body-sm font-bold text-on-surface">{getApiBaseUrl()}</p>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onAction ?? (() => window.location.reload())}
          className="rounded bg-primary px-4 py-2 text-label-sm font-black text-on-primary hover:bg-primary/90"
        >
          {actionLabel}
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded border border-outline-variant px-4 py-2 text-label-sm font-black text-primary hover:bg-primary/5"
        >
          Reload page
        </button>
      </div>
    </div>
  </div>
);
