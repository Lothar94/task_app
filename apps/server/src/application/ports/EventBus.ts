import type { FleetEvent } from '@fleet/shared';

export interface EventPublisher {
  publish(event: FleetEvent): void;
}

export type EventListener = (event: FleetEvent) => void;
export type Unsubscribe = () => void;

export interface EventSubscriber {
  subscribe(listener: EventListener): Unsubscribe;
}
