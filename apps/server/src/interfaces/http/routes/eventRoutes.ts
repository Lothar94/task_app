import type { FleetEvent } from '@fleet/shared';
import type { FastifyInstance } from 'fastify';
import type { EventSubscriber } from '../../../application/ports/EventBus.js';
import { eventsQuery } from '../schemas.js';

const HEARTBEAT_MS = 25_000;

/** Streams fleet events to the browser with Server-Sent Events. */
export function registerEventRoutes(app: FastifyInstance, events: EventSubscriber): void {
  app.get('/api/events', (request, reply) => {
    const { projectId } = eventsQuery.parse(request.query);
    const isRelevant = (event: FleetEvent) => !projectId || event.projectId === projectId;

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    reply.raw.write(': connected\n\n');

    const unsubscribe = events.subscribe((event) => {
      if (isRelevant(event)) reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    });
    const heartbeat = setInterval(() => reply.raw.write(': ping\n\n'), HEARTBEAT_MS);

    request.raw.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
}
