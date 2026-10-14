import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ClaudePluginRegistry } from '../../src/infrastructure/system/ClaudePluginRegistry.js';
import { installPathOf, writeFakeClaudeConfig } from '../support/fakeClaudeConfig.js';

describe('ClaudePluginRegistry', () => {
  let dir: string;
  let registry: ClaudePluginRegistry;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'fleet-plugins-'));
    registry = new ClaudePluginRegistry(dir);
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('lists enabled plugins only, named after plugin.json', async () => {
    await writeFakeClaudeConfig(dir, [
      { key: 'caveman-mode@market', manifestName: 'caveman' },
      { key: 'figma@market', manifestName: 'figma', enabled: false },
    ]);

    expect(await registry.list()).toEqual([
      { name: 'caveman', installPath: installPathOf(dir, 'caveman-mode@market') },
    ]);
  });

  it('falls back to the key before @ when plugin.json has no name', async () => {
    await writeFakeClaudeConfig(dir, [{ key: 'tools@market' }]);

    expect((await registry.list()).map((plugin) => plugin.name)).toEqual(['tools']);
  });

  it('ignores installed plugins missing from enabledPlugins', async () => {
    await writeFakeClaudeConfig(dir, [{ key: 'tools@market' }]);
    await writeFile(join(dir, 'settings.json'), JSON.stringify({}));

    expect(await registry.list()).toEqual([]);
  });

  it('returns an empty list when the files are missing', async () => {
    expect(await registry.list()).toEqual([]);
  });

  it('returns an empty list when a file is not valid JSON', async () => {
    await writeFakeClaudeConfig(dir, [{ key: 'tools@market' }]);
    await writeFile(join(dir, 'settings.json'), '{ nope');
    expect(await registry.list()).toEqual([]);

    await writeFakeClaudeConfig(dir, [{ key: 'tools@market' }]);
    await writeFile(join(dir, 'plugins', 'installed_plugins.json'), 'garbage');
    expect(await registry.list()).toEqual([]);
  });

  it('survives unexpected shapes', async () => {
    await mkdir(join(dir, 'plugins'), { recursive: true });
    await writeFile(
      join(dir, 'plugins', 'installed_plugins.json'),
      JSON.stringify({ plugins: { 'a@b': 'x', 'c@d': [null, 3] } }),
    );
    await writeFile(
      join(dir, 'settings.json'),
      JSON.stringify({ enabledPlugins: { 'a@b': true, 'c@d': true } }),
    );

    expect(await registry.list()).toEqual([]);
  });

  it('prefers the user scope, else the first installation', async () => {
    const a = join(dir, 'a');
    const b = join(dir, 'b');
    const c = join(dir, 'c');
    for (const path of [a, b, c]) await mkdir(path, { recursive: true });
    await mkdir(join(dir, 'plugins'), { recursive: true });
    await writeFile(
      join(dir, 'plugins', 'installed_plugins.json'),
      JSON.stringify({
        plugins: {
          'both@m': [
            { scope: 'project', installPath: a },
            { scope: 'user', installPath: b },
          ],
          'none@m': [
            { scope: 'project', installPath: a },
            { scope: 'local', installPath: c },
          ],
        },
      }),
    );
    await writeFile(
      join(dir, 'settings.json'),
      JSON.stringify({ enabledPlugins: { 'both@m': true, 'none@m': true } }),
    );

    expect(await registry.list()).toEqual([
      { name: 'both', installPath: b },
      { name: 'none', installPath: a },
    ]);
  });

  it('skips plugins whose installPath does not exist', async () => {
    await writeFakeClaudeConfig(dir, [{ key: 'tools@market' }]);
    await rm(installPathOf(dir, 'tools@market'), { recursive: true });

    expect(await registry.list()).toEqual([]);
  });
});
