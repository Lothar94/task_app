import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ClaudePluginRegistry } from '../../src/infrastructure/system/ClaudePluginRegistry.js';
import { FileSystemSkillCatalog } from '../../src/infrastructure/system/FileSystemSkillCatalog.js';
import { FileSystemSkillWorkspace } from '../../src/infrastructure/system/FileSystemSkillWorkspace.js';
import { installPathOf, writeFakeClaudeConfig } from '../support/fakeClaudeConfig.js';

describe('plugin skills: malformed config and renamed plugins', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'fleet-plugin-qa-'));
  });
  afterEach(() => rm(root, { recursive: true, force: true }));

  const catalog = () => new FileSystemSkillCatalog(join(root, 'skills'), new ClaudePluginRegistry(root));

  it('names the plugin after plugin.json, not after the registry key', async () => {
    await writeFakeClaudeConfig(root, [{ key: 'key-name@m', manifestName: 'real-name', skills: { s: 'd' } }]);
    const names = (await catalog().list()).map((skill) => skill.name);
    expect(names).toEqual(['real-name:s']);
  });

  it('falls back to the key and survives a broken plugin.json', async () => {
    await writeFakeClaudeConfig(root, [{ key: 'broken@m', manifestName: 'x', skills: { s: 'd' } }]);
    await writeFile(join(installPathOf(root, 'broken@m'), '.claude-plugin', 'plugin.json'), '{bad');
    expect((await catalog().list()).map((skill) => skill.name)).toEqual(['broken:s']);
  });

  it.each(['plugins/installed_plugins.json', 'settings.json'])('lists nothing when %s is not valid JSON', async (file) => {
    await writeFakeClaudeConfig(root, [{ key: 'on@m', manifestName: 'on', skills: { s: 'd' } }]);
    await writeFile(join(root, file), '{bad');
    expect(await catalog().list()).toEqual([]);
  });

  it('uses one path for two skills of a plugin and none when it is disabled', async () => {
    await writeFakeClaudeConfig(root, [
      { key: 'on@m', manifestName: 'on', skills: { a: 'a', b: 'b' } },
      { key: 'off@m', manifestName: 'off', enabled: false, skills: { c: 'c' } },
    ]);
    const workspace = new FileSystemSkillWorkspace(join(root, 'skills'), join(root, 'bridges'), new ClaudePluginRegistry(root));
    const both = await workspace.prepare(['on:a', 'on:b', 'off:c']);
    expect(both.pluginPaths).toEqual([installPathOf(root, 'on@m')]);
    expect((await workspace.prepare(['off:c'])).pluginPaths).toEqual([]);
  });
});
