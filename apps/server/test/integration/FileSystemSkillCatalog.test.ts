import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { noPlugins } from '../support/testFleet.js';
import { FileSystemSkillCatalog } from '../../src/infrastructure/system/FileSystemSkillCatalog.js';

describe('FileSystemSkillCatalog', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'fleet-skills-'));
  });

  afterEach(() => rm(dir, { recursive: true, force: true }));

  const addSkill = async (folder: string, content?: string) => {
    await mkdir(join(dir, folder), { recursive: true });
    if (content !== undefined) await writeFile(join(dir, folder, 'SKILL.md'), content);
  };

  it('reads name and description from the frontmatter, sorted by name', async () => {
    await addSkill('zeta', '---\nname: zeta\ndescription: Last one\n---\n# Zeta');
    await addSkill(
      'alpha',
      '---\r\nname: "alpha"\r\ndescription: \'First one\'\r\nallowed-tools: Read\r\n---\r\nBody',
    );

    expect(await new FileSystemSkillCatalog(dir, noPlugins).list()).toEqual([
      { name: 'alpha', description: 'First one', plugin: null },
      { name: 'zeta', description: 'Last one', plugin: null },
    ]);
  });

  it('identifies a skill by its folder name, not by the frontmatter name', async () => {
    await addSkill('foo', '---\nname: bar\ndescription: Renamed\n---\n');

    expect(await new FileSystemSkillCatalog(dir, noPlugins).list()).toEqual([
      { name: 'foo', description: 'Renamed', plugin: null },
    ]);
  });

  it('uses an empty description when there is none', async () => {
    await addSkill('plain', '# No frontmatter');
    await addSkill('partial', '---\ndescription: Only a description\n---\n');

    expect(await new FileSystemSkillCatalog(dir, noPlugins).list()).toEqual([
      { name: 'partial', description: 'Only a description', plugin: null },
      { name: 'plain', description: '', plugin: null },
    ]);
  });

  it('ignores folders without SKILL.md, plain files and invalid names', async () => {
    await addSkill('empty-folder');
    await writeFile(join(dir, 'README.md'), 'not a skill');
    await addSkill('Bad_Name', '---\nname: Bad_Name\n---\n');
    await addSkill('plugin:skill', '---\nname: plugin-skill\n---\n');
    await addSkill('good', '---\nname: good\n---\n');

    expect((await new FileSystemSkillCatalog(dir, noPlugins).list()).map((skill) => skill.name)).toEqual([
      'good',
    ]);
  });

  it('returns an empty list when the directory does not exist', async () => {
    expect(await new FileSystemSkillCatalog(join(dir, 'missing'), noPlugins).list()).toEqual([]);
  });
});
