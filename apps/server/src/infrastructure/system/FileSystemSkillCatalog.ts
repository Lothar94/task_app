import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MAX_SKILL_NAME_LENGTH, SKILL_NAME_PATTERN, type SkillDto } from '@fleet/shared';
import type { SkillCatalog } from '../../application/ports/SkillCatalog.js';

const SKILL_FILE = 'SKILL.md';
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;

/**
 * Lists the skills found in a directory: each subdirectory with a SKILL.md is one skill, identified by
 * its directory name (the frontmatter only provides the description).
 */
export class FileSystemSkillCatalog implements SkillCatalog {
  constructor(private readonly skillsDir: string) {}

  async list(): Promise<SkillDto[]> {
    const entries = await readdir(this.skillsDir, { withFileTypes: true }).catch(() => []);
    const skills = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
        .map((entry) => this.read(entry.name)),
    );
    return skills
      .filter((skill): skill is SkillDto => skill !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private async read(directoryName: string): Promise<SkillDto | null> {
    const content = await readFile(join(this.skillsDir, directoryName, SKILL_FILE), 'utf8').catch(() => null);
    if (content === null) return null;
    const fields = parseFrontmatter(content);
    if (directoryName.length > MAX_SKILL_NAME_LENGTH || !SKILL_NAME_PATTERN.test(directoryName)) return null;
    return { name: directoryName, description: fields.get('description') ?? '' };
  }
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
