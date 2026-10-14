import type { FastifyInstance } from 'fastify';
import type { CreateAgent } from '../../../application/agents/CreateAgent.js';
import type { DraftAgentInstructions } from '../../../application/agents/DraftAgentInstructions.js';
import type { DeleteAgent } from '../../../application/agents/DeleteAgent.js';
import type { GetAgent, ListAgents } from '../../../application/agents/QueryAgents.js';
import type { SetAgentCollaborators } from '../../../application/agents/SetAgentCollaborators.js';
import type { UpdateAgent } from '../../../application/agents/UpdateAgent.js';
import { toAgentDto } from '../../../application/shared/dtos.js';
import {
  agentProfileSchema,
  collaboratorsSchema,
  createAgentSchema,
  draftInstructionsSchema,
  idParams,
} from '../schemas.js';

export interface AgentUseCases {
  createAgent: CreateAgent;
  draftAgentInstructions: DraftAgentInstructions;
  updateAgent: UpdateAgent;
  deleteAgent: DeleteAgent;
  listAgents: ListAgents;
  getAgent: GetAgent;
  setAgentCollaborators: SetAgentCollaborators;
}

export function registerAgentRoutes(app: FastifyInstance, useCases: AgentUseCases): void {
  app.get('/api/organizations/:id/agents', (request) => {
    const { id } = idParams.parse(request.params);
    return useCases.listAgents.execute(id).map(toAgentDto);
  });

  app.get('/api/agents/:id', (request) => {
    const { id } = idParams.parse(request.params);
    return toAgentDto(useCases.getAgent.execute(id));
  });

  app.post('/api/organizations/:id/agents', async (request, reply) => {
    const { id: organizationId } = idParams.parse(request.params);
    const { collaboratorIds, instructionsGuidance, ...profile } = createAgentSchema.parse(request.body);
    const agent = await useCases.createAgent.execute({
      organizationId,
      profile,
      collaboratorIds,
      instructionsGuidance,
    });
    return reply.status(201).send(toAgentDto(agent));
  });

  app.post('/api/agents/instructions-draft', async (request) => {
    const instructions = await useCases.draftAgentInstructions.execute(
      draftInstructionsSchema.parse(request.body),
    );
    return { instructions };
  });

  app.put('/api/agents/:id', (request) => {
    const { id } = idParams.parse(request.params);
    return toAgentDto(useCases.updateAgent.execute(id, agentProfileSchema.parse(request.body)));
  });

  app.put('/api/agents/:id/collaborators', (request) => {
    const { id } = idParams.parse(request.params);
    const { collaboratorIds } = collaboratorsSchema.parse(request.body);
    return toAgentDto(useCases.setAgentCollaborators.execute(id, collaboratorIds));
  });

  app.delete('/api/agents/:id', (request, reply) => {
    const { id } = idParams.parse(request.params);
    useCases.deleteAgent.execute(id);
    return reply.status(204).send();
  });
}
