import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface FakePlugin {
  key: string;
  /** Name declared in plugin.json; omit it to exercise the fallback to the key. */
  manifestName?: string;
  enabled?: boolean;
  skills?: Record<string, string>;
  scope?: string;
}

/** Writes a fake Claude config dir (installed_plugins.json, settings.json, plugin folders) under `configDir`. */
export async function writeFakeClaudeConfig(configDir: string, plugins: FakePlugin[]): Promise<void> {
  const registry: Record<string, unknown[]> = {};
  const enabledPlugins: Record<string, boolean> = {};
  for (const plugin of plugins) {
    const installPath = join(configDir, 'plugins', 'cache', plugin.key.replace('@', '-'));
    await mkdir(join(installPath, '.claude-plugin'), { recursive: true });
    if (plugin.manifestName) {
      await writeFile(
        join(installPath, '.claude-plugin', 'plugin.json'),
        JSON.stringify({ name: plugin.manifestName }),
      );
    }
    for (const [dir, description] of Object.entries(plugin.skills ?? {})) {
      await mkdir(join(installPath, 'skills', dir), { recursive: true });
      await writeFile(
        join(installPath, 'skills', dir, 'SKILL.md'),
        `---\nname: ${dir}\ndescription: ${description}\n---\n`,
      );
    }
    registry[plugin.key] = [{ scope: plugin.scope ?? 'user', installPath, version: '1.0.0' }];
    enabledPlugins[plugin.key] = plugin.enabled ?? true;
  }
  await mkdir(join(configDir, 'plugins'), { recursive: true });
  await writeFile(
    join(configDir, 'plugins', 'installed_plugins.json'),
    JSON.stringify({ version: 2, plugins: registry }),
  );
  await writeFile(join(configDir, 'settings.json'), JSON.stringify({ enabledPlugins }));
}

export const installPathOf = (configDir: string, key: string) =>
  join(configDir, 'plugins', 'cache', key.replace('@', '-'));
