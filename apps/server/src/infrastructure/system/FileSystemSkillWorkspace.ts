import { createHash } from 'node:crypto';
import { mkdir, stat, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { parseSkillName } from '@fleet/shared';
import type { PluginRegistry } from '../../application/ports/PluginRegistry.js';
import type { PreparedSkills, SkillWorkspace } from '../../application/ports/SkillWorkspace.js';

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
    private readonly plugins: PluginRegistry,
  ) {}

  async prepare(skills: readonly string[]): Promise<PreparedSkills> {
    const names = [...new Set(skills)];
    const [skillsDirectory, pluginPaths] = await Promise.all([
      this.bridgeFor(names.filter((name) => parseSkillName(name).plugin === null)),
      this.pluginPathsFor(names),
    ]);
    return { skillsDirectory, pluginPaths };
  }

  /** Install paths of the enabled plugins that really contain the requested plugin skills. */
  private async pluginPathsFor(names: readonly string[]): Promise<string[]> {
    const wanted = names.map(parseSkillName).filter((parsed) => parsed.plugin !== null);
    if (wanted.length === 0) return [];
    const plugins = await this.plugins.list();
    const paths = await Promise.all(
      wanted.map(async ({ plugin, skill }) => {
        const owner = plugins.find((candidate) => candidate.name === plugin);
        return owner && (await isFile(join(owner.installPath, 'skills', skill, 'SKILL.md')))
          ? owner.installPath
          : null;
      }),
    );
    return [...new Set(paths.filter((path): path is string => path !== null))];
  }

  private async bridgeFor(userSkills: readonly string[]): Promise<string | null> {
    const installed = await this.installed(userSkills);
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
      skills.map(async (skill) =>
        (await isFile(join(this.userSkillsDir, skill, 'SKILL.md'))) ? skill : null,
      ),
    );
    return found.filter((skill): skill is string => skill !== null).sort();
  }
}

const isFile = (path: string) =>
  stat(path).then(
    (file) => file.isFile(),
    () => false,
  );

function bridgeId(sortedSkills: readonly string[]): string {
  return createHash('sha256').update(sortedSkills.join('\n')).digest('hex').slice(0, BRIDGE_ID_LENGTH);
}
