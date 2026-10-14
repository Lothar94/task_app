import type { SkillDto } from '@fleet/shared';

/** The skills installed for the user, which agents can be told to use. */
export interface SkillCatalog {
  /** Never throws for a missing catalog: returns an empty list. */
  list(): Promise<SkillDto[]>;
}
