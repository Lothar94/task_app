import type { EventPublisher, EventSubscriber, Unsubscribe } from '../ports/EventBus.js';
import type { Logger } from '../ports/Logger.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import type { GetAgentActivity } from './GetAgentActivity.js';

/** Bursts of task changes (a run start records several) collapse into one snapshot per organization. */
export const AGENT_ACTIVITY_COALESCE_MS = 100;

/**
 * Publishes `agent.activity` for an organization after its tasks change: the first change schedules
 * one emission `intervalMs` later and the changes until then ride along, since the snapshot is taken
 * when it is sent.
 */
export class AgentActivityNotifier {
  private readonly scheduled = new Set<string>();
  /** A project never changes organization, so its owner is looked up once. */
  private readonly organizationByProject = new Map<string, string>();

  constructor(
    private readonly projects: ProjectRepository,
    private readonly activity: GetAgentActivity,
    private readonly events: EventPublisher,
    private readonly logger: Logger,
    private readonly intervalMs = AGENT_ACTIVITY_COALESCE_MS,
  ) {}

  watch(events: EventSubscriber): Unsubscribe {
    return events.subscribe((event) => {
      if (event.type === 'task.created' || event.type === 'task.updated') this.schedule(event.projectId);
    });
  }

  private schedule(projectId: string): void {
    const organizationId = this.organizationOf(projectId);
    if (organizationId === null || this.scheduled.has(organizationId)) return;
    this.scheduled.add(organizationId);
    setTimeout(() => this.emit(organizationId), this.intervalMs);
  }

  private emit(organizationId: string): void {
    this.scheduled.delete(organizationId);
    try {
      const activity = this.activity.execute(organizationId);
      this.events.publish({ type: 'agent.activity', organizationId, activity });
    } catch (error) {
      this.logger.error(`Could not publish the agent activity of organization "${organizationId}"`, error);
    }
  }

  private organizationOf(projectId: string): string | null {
    const known = this.organizationByProject.get(projectId);
    if (known !== undefined) return known;
    const owner = this.projects.findById(projectId)?.organizationId ?? null;
    if (owner !== null) this.organizationByProject.set(projectId, owner);
    return owner;
  }
}
