import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isValidSkillName, PLUGIN_SKILL_SEPARATOR, type SkillDto } from '@fleet/shared';
import type { PluginRegistry } from '../../application/ports/PluginRegistry.js';
import type { SkillCatalog } from '../../application/ports/SkillCatalog.js';

const SKILL_FILE = 'SKILL.md';
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;

/**
 * Lists the user's skills (each subdirectory of `skillsDir` with a SKILL.md) and those of the enabled
 * plugins (`<plugin>:<directory>` under each plugin's `skills/`). A skill is identified by its directory
 * name; the frontmatter only provides the description.
 */
export class FileSystemSkillCatalog implements SkillCatalog {
  constructor(
    private readonly skillsDir: string,
    private readonly plugins: PluginRegistry,
  ) {}

  async list(): Promise<SkillDto[]> {
    const plugins = await this.plugins.list();
    const groups = await Promise.all([
      readSkills(this.skillsDir, null),
      ...plugins.map((plugin) => readSkills(join(plugin.installPath, 'skills'), plugin.name)),
    ]);
    return groups.flat().sort((a, b) => a.name.localeCompare(b.name));
  }
}

async function readSkills(directory: string, plugin: string | null): Promise<SkillDto[]> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const skills = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
      .map((entry) => readSkill(directory, entry.name, plugin)),
  );
  return skills.filter((skill): skill is SkillDto => skill !== null);
}

async function readSkill(
  directory: string,
  directoryName: string,
  plugin: string | null,
): Promise<SkillDto | null> {
  const content = await readFile(join(directory, directoryName, SKILL_FILE), 'utf8').catch(() => null);
  if (content === null) return null;
  const name = plugin === null ? directoryName : `${plugin}${PLUGIN_SKILL_SEPARATOR}${directoryName}`;
  if (!isValidSkillName(name) || (plugin === null && name.includes(PLUGIN_SKILL_SEPARATOR))) return null;
  return { name, description: parseFrontmatter(content).get('description') ?? '', plugin };
}

/** Reads the flat `key: value` lines of the frontmatter; enough for `description`. */
function parseFrontmatter(content: string): Map<string, string> {
  const fields = new Map<string, string>();
  const block = FRONTMATTER.exec(content)?.[1] ?? '';
  for (const line of block.split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator <= 0 || /^\s/.test(line)) continue;
    fields.set(line.slice(0, separator).trim(), unquote(line.slice(separator + 1).trim()));
  }
  return fields;
}

function unquote(value: string): string {
  const quoted = /^(["'])(.*)\1$/.exec(value);
  return quoted?.[2] ?? value;
}
