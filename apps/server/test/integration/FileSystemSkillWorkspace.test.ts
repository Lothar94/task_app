import { mkdir, mkdtemp, readdir, readlink, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileSystemSkillWorkspace } from '../../src/infrastructure/system/FileSystemSkillWorkspace.js';

describe('FileSystemSkillWorkspace', () => {
  let root: string;
  let userSkills: string;
  let workspace: FileSystemSkillWorkspace;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'fleet-bridge-'));
    userSkills = join(root, 'user-skills');
    workspace = new FileSystemSkillWorkspace(userSkills, join(root, 'skill-bridges'));
    for (const name of ['graphify', 'pdf', 'other']) {
      await mkdir(join(userSkills, name), { recursive: true });
      await writeFile(join(userSkills, name, 'SKILL.md'), `---\nname: ${name}\n---\n`);
    }
  });

  afterEach(() => rm(root, { recursive: true, force: true }));

  const linksOf = (directory: string) => readdir(join(directory, '.claude', 'skills')).then((n) => n.sort());

  it('links only the requested skills that exist', async () => {
    const directory = await workspace.prepare('agent-1', ['graphify', 'missing', 'pdf']);

    expect(directory).toBe(join(root, 'skill-bridges', 'agent-1'));
    expect(await linksOf(directory ?? '')).toEqual(['graphify', 'pdf']);
    expect(await readlink(join(directory ?? '', '.claude', 'skills', 'pdf'))).toBe(join(userSkills, 'pdf'));
  });

  it('rebuilds the bridge on every run so removed skills disappear', async () => {
    await workspace.prepare('agent-1', ['graphify', 'pdf']);

    const directory = await workspace.prepare('agent-1', ['pdf']);

    expect(await linksOf(directory ?? '')).toEqual(['pdf']);
  });

  it('keeps the bridges of different agents apart', async () => {
    const first = await workspace.prepare('agent-1', ['graphify']);
    const second = await workspace.prepare('agent-2', ['pdf']);

    expect(await linksOf(first ?? '')).toEqual(['graphify']);
    expect(await linksOf(second ?? '')).toEqual(['pdf']);
  });

  it('returns null and leaves no bridge when nothing can be linked', async () => {
    await workspace.prepare('agent-1', ['graphify']);

    expect(await workspace.prepare('agent-1', [])).toBeNull();
    expect(await workspace.prepare('agent-1', ['missing'])).toBeNull();
    expect(await readdir(join(root, 'skill-bridges'))).toEqual([]);
  });
});
