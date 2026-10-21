import type { AgentEffort, AgentModel, RunModelChoice } from '@fleet/shared';
import type { AgentProfile } from '../../domain/agent/Agent.js';

export interface ResolvedRunModel {
  model: AgentModel;
  effort: AgentEffort;
}

/** `auto` agents take the invoker's choice field by field, falling back to their own; `fixed` ones ignore it. */
export function resolveRunModel(
  profile: Pick<AgentProfile, 'model' | 'effort' | 'modelSelection'>,
  choice: RunModelChoice,
): ResolvedRunModel {
  if (profile.modelSelection !== 'auto') return { model: profile.model, effort: profile.effort };
  return { model: choice.model ?? profile.model, effort: choice.effort ?? profile.effort };
}
