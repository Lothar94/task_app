import { createHash } from 'node:crypto';
import { mkdir, stat, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { SkillWorkspace } from '../../application/ports/SkillWorkspace.js';

const BRIDGE_ID_LENGTH = 16;

/**
 * Builds `<bridgesDir>/<hash of the skill set>/.claude/skills/` with symlinks to the given skills.
 * Passing that directory as an additional directory exposes just those skills, unlike the `user`
 * setting source. Bridges are content-addressed and never deleted, so concurrent runs can share
 * them and a run never loses the links it is using.
 */
export class FileSystemSkillWorkspace implements SkillWorkspace {
  constructor(
    private readonly userSkillsDir: string,
    private readonly bridgesDir: string,
  ) {}

  async prepare(skills: readonly string[]): Promise<string | null> {
    const installed = await this.installed(skills);
    if (installed.length === 0) return null;

    const bridgeDir = join(this.bridgesDir, bridgeId(installed));
    const linksDir = join(bridgeDir, '.claude', 'skills');
    await mkdir(linksDir, { recursive: true });
    await Promise.all(installed.map((skill) => this.link(linksDir, skill)));
    return bridgeDir;
  }

  private async link(linksDir: string, skill: string): Promise<void> {
    try {
      await symlink(join(this.userSkillsDir, skill), join(linksDir, skill));
    } catch (error) {
      // Another run created the same link first: the name fixes the target, so it is correct.
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  }

  /** The existing skills, deduplicated and sorted so the same set always yields the same bridge. */
  private async installed(skills: readonly string[]): Promise<string[]> {
    const found = await Promise.all(
      [...new Set(skills)].map(async (skill) => {
        const exists = await stat(join(this.userSkillsDir, skill, 'SKILL.md')).then(
          (file) => file.isFile(),
          () => false,
        );
        return exists ? skill : null;
      }),
    );
    return found.filter((skill): skill is string => skill !== null).sort();
  }
}

function bridgeId(sortedSkills: readonly string[]): string {
  return createHash('sha256').update(sortedSkills.join('\n')).digest('hex').slice(0, BRIDGE_ID_LENGTH);
}
