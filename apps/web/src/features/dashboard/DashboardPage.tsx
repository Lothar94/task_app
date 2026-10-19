import type { DashboardDto } from '@fleet/shared';
import {
  Banknote,
  CircleAlert,
  CircleCheck,
  Clock,
  Cpu,
  ShieldCheck,
  ChartColumn,
  Layers,
  Users,
  Bug,
} from 'lucide-react';
import { useState } from 'react';
import { StatTile } from '../../components/StatTile';
import { Card, ErrorMessage, Loading, PageHeader, SegmentedControl, Select } from '../../components/ui';
import { useStoredChoice } from '../../hooks/useStoredChoice';
import { formatCost, formatDuration, formatPercent, formatTokens } from '../../lib/format';
import { projectOptionLabel } from '../projects/projectListModel';
import { useProjects } from '../projects/projectQueries';
import { AgentUsageTable } from './AgentUsageTable';
import { DailyActivityChart } from './charts/DailyActivityChart';
import { ModelTokensChart } from './charts/ModelTokensChart';
import { OutcomeBar } from './charts/OutcomeBar';
import { useDashboard } from './dashboardQueries';
import { ErrorList } from './ErrorList';
import { ModelUsageTable } from './ModelUsageTable';

const PERIODS = ['7', '30', '90', 'all'] as const;
const PERIOD_OPTIONS = [
  { value: '7' as const, label: '7 días' },
  { value: '30' as const, label: '30 días' },
  { value: '90' as const, label: '90 días' },
  { value: 'all' as const, label: 'Todo' },
];

function Filters(props: {
  projectId: string;
  onProjectChange: (projectId: string) => void;
  period: (typeof PERIODS)[number];
  onPeriodChange: (period: (typeof PERIODS)[number]) => void;
}) {
  const projects = useProjects();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="w-56">
        <Select
          aria-label="Proyecto"
          value={props.projectId}
          onChange={(e) => props.onProjectChange(e.target.value)}
        >
          <option value="">Todos los proyectos</option>
          {projects.data?.map((project) => (
            <option key={project.id} value={project.id}>
              {projectOptionLabel(project)}
            </option>
          ))}
        </Select>
      </div>
      <SegmentedControl
        label="Periodo"
        options={PERIOD_OPTIONS}
        value={props.period}
        onChange={props.onPeriodChange}
      />
    </div>
  );
}

function Headline({ totals }: { totals: DashboardDto['totals'] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <StatTile
        label="Resueltas"
        value={totals.completed}
        tone="good"
        icon={<CircleCheck />}
        detail={`${totals.active} en curso ahora`}
      />
      <StatTile
        label="Fallidas"
        value={totals.failed}
        tone="critical"
        icon={<CircleAlert />}
        detail={`${totals.cancelled} canceladas`}
      />
      <StatTile
        label="Tasa de éxito"
        icon={<ShieldCheck />}
        value={formatPercent(totals.successRate)}
        detail="completadas / (completadas + fallidas)"
      />
      <StatTile
        label="Tokens"
        icon={<Cpu />}
        value={formatTokens(totals.totalTokens)}
        detail={`${formatTokens(totals.outputTokens)} de salida`}
      />
      <StatTile
        label="Coste estimado"
        icon={<Banknote />}
        value={formatCost(totals.costUsd)}
        detail="según tarifas de la API; tu suscripción no lo cobra"
      />
      <StatTile
        label="Tiempo de agentes"
        icon={<Clock />}
        value={formatDuration(totals.agentTimeMs)}
        detail={`${totals.runs} ejecuciones`}
      />
    </div>
  );
}

function DashboardContent({ data }: { data: DashboardDto }) {
  return (
    <div className="space-y-6">
      <Headline totals={data.totals} />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card title="Tokens por día" icon={<ChartColumn />}>
          <DailyActivityChart days={data.daily} />
        </Card>
        <Card title="Resultado de las tareas terminadas">
          <OutcomeBar totals={data.totals} />
        </Card>
      </div>
      <Card title="Uso por modelo" icon={<Layers />}>
        <ModelTokensChart rows={data.byModel} />
        {data.byModel.length > 0 && (
          <details className="mt-4">
            <summary className="label-mono cursor-pointer text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              Ver desglose tabular
            </summary>
            <div className="mt-2">
              <ModelUsageTable rows={data.byModel} />
            </div>
          </details>
        )}
      </Card>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card title="Rendimiento por agente" icon={<Users />}>
          <AgentUsageTable rows={data.byAgent} />
        </Card>
        <Card title={`Errores (${data.errors.length})`} icon={<Bug />}>
          <ErrorList errors={data.errors} />
        </Card>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const [projectId, setProjectId] = useState('');
  const [period, setPeriod] = useStoredChoice('fleet.dashboard.period', PERIODS, '30');
  const dashboard = useDashboard({
    projectId: projectId || null,
    days: period === 'all' ? null : Number(period),
  });

  return (
    <>
      <PageHeader
        title="Dashboard"
        breadcrumb="Métricas y flota"
        subtitle="Uso de modelos y tokens, resultado de las tareas y errores recientes."
        actions={
          <Filters
            projectId={projectId}
            onProjectChange={setProjectId}
            period={period}
            onPeriodChange={setPeriod}
          />
        }
      />
      {dashboard.isPending ? (
        <Loading />
      ) : dashboard.error ? (
        <ErrorMessage error={dashboard.error} />
      ) : (
        <DashboardContent data={dashboard.data} />
      )}
    </>
  );
}
