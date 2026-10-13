import type { FleetEvent } from '@fleet/shared';
import type {
  EventListener,
  EventPublisher,
  EventSubscriber,
  Unsubscribe,
} from '../../application/ports/EventBus.js';

export class InMemoryEventBus implements EventPublisher, EventSubscriber {
  private readonly listeners = new Set<EventListener>();

  publish(event: FleetEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  subscribe(listener: EventListener): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
