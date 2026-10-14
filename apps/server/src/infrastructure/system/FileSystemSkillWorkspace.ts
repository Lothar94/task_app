import { mkdir, rm, stat, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { SkillWorkspace } from '../../application/ports/SkillWorkspace.js';

/**
 * Builds `<bridgesDir>/<agentId>/.claude/skills/` with symlinks to the agent's skills. Passing that
 * directory as an additional directory exposes just those skills, unlike the `user` setting source.
 */
export class FileSystemSkillWorkspace implements SkillWorkspace {
  constructor(
    private readonly userSkillsDir: string,
    private readonly bridgesDir: string,
  ) {}

  async prepare(agentId: string, skills: readonly string[]): Promise<string | null> {
    const bridgeDir = join(this.bridgesDir, agentId);
    await rm(bridgeDir, { recursive: true, force: true });
    const installed = await this.installed(skills);
    if (installed.length === 0) return null;

    const linksDir = join(bridgeDir, '.claude', 'skills');
    await mkdir(linksDir, { recursive: true });
    await Promise.all(
      installed.map((skill) => symlink(join(this.userSkillsDir, skill), join(linksDir, skill))),
    );
    return bridgeDir;
  }

  private async installed(skills: readonly string[]): Promise<string[]> {
    const found = await Promise.all(
      skills.map(async (skill) => {
        const exists = await stat(join(this.userSkillsDir, skill, 'SKILL.md')).then(
          (file) => file.isFile(),
          () => false,
        );
        return exists ? skill : null;
      }),
    );
    return found.filter((skill): skill is string => skill !== null);
  }
}
