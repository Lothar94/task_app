import { AGENT_MODELS, EFFORT_LEVELS, PERMISSION_MODES, TASK_START_MODES } from '@fleet/shared';
import { z } from 'zod';

const ids = z.array(z.string().min(1)).default([]);

export const idParams = z.object({ id: z.string().min(1) });

export const organizationSchema = z.object({ name: z.string() });

export const agentProfileSchema = z.object({
  name: z.string(),
  role: z.string(),
  description: z.string().default(''),
  instructions: z.string().default(''),
  model: z.enum(AGENT_MODELS),
  effort: z.enum(EFFORT_LEVELS).default('high'),
  allowedTools: z.array(z.string()).default([]),
  permissionMode: z.enum(PERMISSION_MODES).default('dontAsk'),
  maxTurns: z.number().int(),
});

export const createAgentSchema = agentProfileSchema.extend({
  collaboratorIds: ids,
  instructionsGuidance: z.string().default(''),
});

export const draftInstructionsSchema = z.object({
  name: z.string(),
  role: z.string(),
  description: z.string().default(''),
  allowedTools: z.array(z.string()).default([]),
  collaboratorIds: ids,
  guidance: z.string().default(''),
});

export const collaboratorsSchema = z.object({ collaboratorIds: ids });

export const createProjectSchema = z.object({
  name: z.string(),
  description: z.string().default(''),
  workspacePath: z.string(),
  memberIds: ids,
});

export const membersSchema = z.object({ memberIds: ids });

export const assignTaskSchema = z.object({
  agentId: z.string().min(1),
  title: z.string(),
  description: z.string(),
  start: z.enum(TASK_START_MODES).default('now'),
  milestone: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

export const updateTaskSchema = z.object({
  agentId: z.string().min(1).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  milestone: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

export const reorderQueueSchema = z.object({ taskIds: z.array(z.string().min(1)) });

export const followUpSchema = z.object({ message: z.string() });

export const dashboardQuery = z.object({
  projectId: z.string().min(1).optional(),
  days: z.coerce.number().int().min(1).max(365).optional(),
});

export const eventsQuery = z.object({ projectId: z.string().min(1).optional() });
