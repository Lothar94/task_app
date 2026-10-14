import type { FastifyInstance } from 'fastify';
import type { ListSkills } from '../../../application/skills/ListSkills.js';

export interface SkillUseCases {
  listSkills: ListSkills;
}

export function registerSkillRoutes(app: FastifyInstance, useCases: SkillUseCases): void {
  app.get('/api/skills', () => useCases.listSkills.execute());
}
