import type { SkillDto } from '@fleet/shared';
import type { SkillCatalog } from '../ports/SkillCatalog.js';

export class ListSkills {
  constructor(private readonly catalog: SkillCatalog) {}

  execute(): Promise<SkillDto[]> {
    return this.catalog.list();
  }
}
