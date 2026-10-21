import {
  AGENT_EXPORT_FORMAT,
  AGENT_EXPORT_VERSION,
  AGENT_IMPORT_CONFLICT_STRATEGIES,
  AGENT_MODELS,
  EFFORT_LEVELS,
  MAX_IMPORTED_AGENTS,
  MODEL_SELECTION_MODES,
  PERMISSION_MODES,
  SEARCH_LIMITS,
  TASK_START_MODES,
} from '@fleet/shared';
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
  modelSelection: z.enum(MODEL_SELECTION_MODES).default('fixed'),
  allowedTools: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  permissionMode: z.enum(PERMISSION_MODES).default('dontAsk'),
  maxTurns: z.number().int(),
});

export const createAgentSchema = agentProfileSchema.extend({
  collaboratorIds: ids,
  instructionsGuidance: z.string().default(''),
});

export const exportAgentsSchema = z.object({
  agentIds: z.array(z.string().min(1)).optional(),
  includeCollaborators: z.boolean().default(false),
});

export const importAgentsSchema = z.object({
  file: z.object({
    format: z.literal(AGENT_EXPORT_FORMAT),
    version: z.literal(AGENT_EXPORT_VERSION),
    exportedAt: z.string().optional(),
    organization: z.string().optional(),
    agents: z
      .array(agentProfileSchema.extend({ collaborators: z.array(z.string()).default([]) }))
      .min(1)
      .max(MAX_IMPORTED_AGENTS),
  }),
  onConflict: z.enum(AGENT_IMPORT_CONFLICT_STRATEGIES).default('fail'),
});

export const draftInstructionsSchema = z.object({
  name: z.string(),
  role: z.string(),
  description: z.string().default(''),
  allowedTools: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
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
  model: z.enum(AGENT_MODELS).nullable().optional(),
  effort: z.enum(EFFORT_LEVELS).nullable().optional(),
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

export const eventsQuery = z.object({
  projectId: z.string().min(1).optional(),
  organizationId: z.string().min(1).optional(),
});

export const searchQuery = z.object({
  q: z.string().max(SEARCH_LIMITS.queryLength).default(''),
  limit: z.coerce.number().int().min(1).max(SEARCH_LIMITS.maxPerGroup).default(SEARCH_LIMITS.defaultPerGroup),
});
