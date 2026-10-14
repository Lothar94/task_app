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
    const directory = await workspace.prepare(['graphify', 'missing', 'pdf']);

    expect(directory).toMatch(new RegExp(`^${join(root, 'skill-bridges')}/[0-9a-f]{16}$`));
    expect(await linksOf(directory ?? '')).toEqual(['graphify', 'pdf']);
    expect(await readlink(join(directory ?? '', '.claude', 'skills', 'pdf'))).toBe(join(userSkills, 'pdf'));
  });

  it('gives the same directory to the same skill set, whatever the order', async () => {
    const first = await workspace.prepare(['pdf', 'graphify']);
    const second = await workspace.prepare(['graphify', 'pdf', 'missing']);

    expect(second).toBe(first);
  });

  it('resolves concurrent prepares of the same skills to the same directory', async () => {
    const directories = await Promise.all(
      Array.from({ length: 8 }, () => workspace.prepare(['graphify', 'pdf'])),
    );

    expect(new Set(directories).size).toBe(1);
    expect(await linksOf(directories[0] ?? '')).toEqual(['graphify', 'pdf']);
  });

  it('gives different directories to different skill sets', async () => {
    const first = await workspace.prepare(['graphify']);
    const second = await workspace.prepare(['pdf']);

    expect(second).not.toBe(first);
    expect(await linksOf(first ?? '')).toEqual(['graphify']);
    expect(await linksOf(second ?? '')).toEqual(['pdf']);
  });

  it('does not remove the directory of a run when another one is prepared', async () => {
    const running = await workspace.prepare(['graphify', 'pdf']);

    await workspace.prepare(['pdf']);
    await workspace.prepare([]);

    expect(await linksOf(running ?? '')).toEqual(['graphify', 'pdf']);
  });

  it('returns null and creates no bridge when nothing can be linked', async () => {
    expect(await workspace.prepare([])).toBeNull();
    expect(await workspace.prepare(['missing'])).toBeNull();
    expect(await readdir(root)).toEqual(['user-skills']);
  });
});
