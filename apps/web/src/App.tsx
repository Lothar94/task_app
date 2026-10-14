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
import { ThemeToggle } from './features/theme/ThemeToggle';
import { TaskPage } from './features/tasks/TaskPage';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm ${isActive ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-400 hover:text-zinc-50'}`;

function Layout() {
  const { pathname } = useLocation();
  const { id: organizationId } = useCurrentOrganization();
  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1800px] items-center gap-6 px-4 py-3 lg:px-8">
          <span className="font-semibold tracking-tight">
            <span className="text-indigo-400">◆</span> Agent Fleet
          </span>
          <nav className="flex gap-1">
            <NavLink to="/projects" className={navLinkClass}>
              Proyectos
            </NavLink>
            <NavLink to="/dashboard" className={navLinkClass}>
              Dashboard
            </NavLink>
            <NavLink to="/agents" className={navLinkClass}>
              Agentes
            </NavLink>
          </nav>
          <div className="flex items-center gap-1">
            <OrganizationSelect />
            <NavLink to="/organizations" className={navLinkClass}>
              Organizaciones
            </NavLink>
          </div>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-[1800px] px-4 py-8 lg:px-8">
        <ErrorBoundary key={`${organizationId}:${pathname}`}>
          <Outlet />
        </ErrorBoundary>
      </main>
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
