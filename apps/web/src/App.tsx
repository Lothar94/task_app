import { Bot, Building2, FolderKanban, LayoutDashboard } from 'lucide-react';
import { NavLink, Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AgentDetailPage } from './features/agents/AgentDetailPage';
import { AgentEditorPage } from './features/agents/AgentEditorPage';
import { AgentsPage } from './features/agents/AgentsPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { OrganizationSelect } from './features/organizations/OrganizationSelect';
import { OrganizationsPage } from './features/organizations/OrganizationsPage';
import { useCurrentOrganization } from './features/organizations/OrganizationContext';
import { ProjectPage } from './features/projects/ProjectPage';
import { ProjectsPage } from './features/projects/ProjectsPage';
import { GlobalSearch } from './features/shell/GlobalSearch';
import { FleetStatusBar } from './features/shell/FleetStatusBar';
import { NotificationCenter } from './features/shell/NotificationCenter';
import { ThemeToggle } from './features/theme/ThemeToggle';
import { TaskPage } from './features/tasks/TaskPage';

const NAV_ITEMS = [
  { to: '/projects', label: 'Proyectos', icon: FolderKanban },
  { to: '/agents', label: 'Agentes', icon: Bot },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-1.5 border-b px-3 py-[0.9rem] text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${isActive ? 'border-accent font-medium text-accent' : 'border-transparent text-fg-subtle hover:text-fg'}`;

function Layout() {
  const { pathname } = useLocation();
  const { id: organizationId } = useCurrentOrganization();
  return (
    <div className="min-h-screen pb-(--status-bar-height)">
      <header className="sticky top-0 z-50 flex min-h-[52px] w-full flex-wrap items-center gap-x-3 border-b border-line bg-canvas px-4">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block size-2.5 rotate-45 bg-accent shadow-[0_0_8px_rgb(128_131_255/0.7)]"
          />
          <span className="font-semibold tracking-tight whitespace-nowrap">Agent Fleet</span>
        </div>
        <span aria-hidden className="h-4 w-px bg-line-strong" />
        <OrganizationSelect />
        <nav aria-label="Principal" className="ml-3 flex items-center">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={navLinkClass}>
              <Icon aria-hidden className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <GlobalSearch />
          <NotificationCenter />
          <NavLink to="/organizations" className={navLinkClass}>
            <Building2 aria-hidden className="size-4" />
            Organizaciones
          </NavLink>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-[1800px] px-4 py-8 lg:px-8">
        <ErrorBoundary key={`${organizationId}:${pathname}`}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <FleetStatusBar />
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/projects" replace />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:projectId" element={<ProjectPage />} />
        <Route path="projects/:projectId/tasks/:taskId" element={<TaskPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="organizations" element={<OrganizationsPage />} />
        <Route path="agents" element={<AgentsPage />} />
        <Route path="agents/new" element={<AgentEditorPage />} />
        <Route path="agents/:agentId" element={<AgentDetailPage />} />
        <Route path="agents/:agentId/edit" element={<AgentEditorPage />} />
      </Route>
    </Routes>
  );
}
