import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ClaudePluginRegistry } from '../../src/infrastructure/system/ClaudePluginRegistry.js';
import { FileSystemSkillCatalog } from '../../src/infrastructure/system/FileSystemSkillCatalog.js';
import { FileSystemSkillWorkspace } from '../../src/infrastructure/system/FileSystemSkillWorkspace.js';
import { installPathOf, writeFakeClaudeConfig } from '../support/fakeClaudeConfig.js';

describe('plugin skills', () => {
  let root: string;
  let userSkills: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'fleet-plugin-skills-'));
    userSkills = join(root, 'skills');
    await mkdir(join(userSkills, 'pdf'), { recursive: true });
    await writeSkill(join(userSkills, 'pdf'));
    await writeFakeClaudeConfig(root, [
      { key: 'caveman-mode@m', manifestName: 'caveman', skills: { caveman: 'Talk short', other: 'Other' } },
      { key: 'figma@m', manifestName: 'figma', enabled: false, skills: { design: 'Design' } },
    ]);
  });
  afterEach(() => rm(root, { recursive: true, force: true }));

  const plugins = () => new ClaudePluginRegistry(root);
  const workspace = () => new FileSystemSkillWorkspace(userSkills, join(root, 'bridges'), plugins());

  describe('catalog', () => {
    it('lists user and enabled plugin skills sorted, tagged with their plugin', async () => {
      expect(await new FileSystemSkillCatalog(userSkills, plugins()).list()).toEqual([
        { name: 'caveman:caveman', description: 'Talk short', plugin: 'caveman' },
        { name: 'caveman:other', description: 'Other', plugin: 'caveman' },
        { name: 'pdf', description: '', plugin: null },
      ]);
    });

    it('lists both when a user skill and a plugin skill share a directory name', async () => {
      await mkdir(join(userSkills, 'caveman'), { recursive: true });
      await writeSkill(join(userSkills, 'caveman'));

      const names = (await new FileSystemSkillCatalog(userSkills, plugins()).list()).map((s) => s.name);
      expect(names).toContain('caveman');
      expect(names).toContain('caveman:caveman');
    });
  });

  describe('workspace', () => {
    it('bridges user skills and returns the plugin path, deduplicated', async () => {
      const prepared = await workspace().prepare(['pdf', 'caveman:caveman', 'caveman:other']);

      expect(prepared.pluginPaths).toEqual([installPathOf(root, 'caveman-mode@m')]);
      expect(await readdir(join(prepared.skillsDirectory ?? '', '.claude', 'skills'))).toEqual(['pdf']);
    });

    it('has no bridge when only plugin skills are requested', async () => {
      const prepared = await workspace().prepare(['caveman:caveman']);

      expect(prepared.skillsDirectory).toBeNull();
      expect(prepared.pluginPaths).toHaveLength(1);
    });

    it('ignores disabled plugins, unknown plugins and missing plugin skills', async () => {
      const prepared = await workspace().prepare(['figma:design', 'ghost:x', 'caveman:missing']);

      expect(prepared).toEqual({ skillsDirectory: null, pluginPaths: [] });
    });

    it('returns nothing for an agent without skills', async () => {
      expect(await workspace().prepare([])).toEqual({ skillsDirectory: null, pluginPaths: [] });
    });
  });
});

async function writeSkill(directory: string): Promise<void> {
  await writeFile(join(directory, 'SKILL.md'), '---\nname: x\n---\n');
}
