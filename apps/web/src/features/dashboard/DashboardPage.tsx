import type { DashboardDto } from '@fleet/shared';
import { Bug, ChartColumn, Layers, Users } from 'lucide-react';
import { useState } from 'react';
import {
  Card,
  ErrorMessage,
  Loading,
  PageHeader,
  SegmentedControl,
  Select,
  StatusChip,
} from '../../components/ui';
import { useStoredChoice } from '../../hooks/useStoredChoice';
import { projectOptionLabel } from '../projects/projectListModel';
import { useProjects } from '../projects/projectQueries';
import { AgentUsageTable } from './AgentUsageTable';
import { DailyActivityChart, DailyLegend } from './charts/DailyActivityChart';
import { ModelLegend, ModelTokensChart } from './charts/ModelTokensChart';
import { Headline } from './Headline';
import { OutcomeBar } from './charts/OutcomeBar';
import { PERIOD_OPTIONS, PERIODS, type Period, periodDays, periodLabel } from './dashboardModel';
import { useDashboard } from './dashboardQueries';
import { ErrorList } from './ErrorList';
import { ModelUsageTable } from './ModelUsageTable';

function Filters(props: {
  projectId: string;
  onProjectChange: (projectId: string) => void;
  period: Period;
  onPeriodChange: (period: Period) => void;
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

function DashboardContent({ data }: { data: DashboardDto }) {
  return (
    <div className="space-y-6">
      <Headline totals={data.totals} previous={data.previous} />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card
          title={data.activityGranularity === 'hour' ? 'Tokens por hora' : 'Tokens por día'}
          icon={<ChartColumn />}
          meta={<DailyLegend days={data.daily} granularity={data.activityGranularity} />}
        >
          <DailyActivityChart days={data.daily} granularity={data.activityGranularity} />
        </Card>
        <Card title="Resultado de las tareas terminadas">
          <OutcomeBar totals={data.totals} />
        </Card>
      </div>
      <Card title="Uso por modelo" icon={<Layers />} meta={<ModelLegend />}>
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
        <Card
          title={`Errores (${data.errors.length})`}
          icon={<Bug />}
          meta={<StatusChip tone="danger">{periodLabel(data.filters.days)}</StatusChip>}
        >
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
    days: periodDays(period),
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
