import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { InstalledPlugin, PluginRegistry } from '../../application/ports/PluginRegistry.js';

const KEY_SEPARATOR = '@';
const PREFERRED_SCOPE = 'user';

interface Installation {
  scope?: unknown;
  installPath?: unknown;
}

/**
 * Lists the plugins Claude Code has installed (`plugins/installed_plugins.json`) and enabled
 * (`enabledPlugins` in `settings.json`) under a Claude config directory. Read-only.
 */
export class ClaudePluginRegistry implements PluginRegistry {
  constructor(private readonly configDir: string) {}

  async list(): Promise<InstalledPlugin[]> {
    const installed = await readJson(join(this.configDir, 'plugins', 'installed_plugins.json'));
    const settings = await readJson(join(this.configDir, 'settings.json'));
    const registry = asRecord(asRecord(installed).plugins);
    const enabled = asRecord(asRecord(settings).enabledPlugins);

    const plugins = await Promise.all(
      Object.entries(registry)
        .filter(([key]) => enabled[key] === true)
        .map(([key, installations]) => this.resolve(key, installations)),
    );
    return plugins.filter((plugin): plugin is InstalledPlugin => plugin !== null);
  }

  private async resolve(key: string, installations: unknown): Promise<InstalledPlugin | null> {
    const installPath = choosePath(installations);
    if (!installPath || !(await isDirectory(installPath))) return null;
    const manifest = asRecord(await readJson(join(installPath, '.claude-plugin', 'plugin.json')));
    const name =
      typeof manifest.name === 'string' && manifest.name ? manifest.name : key.split(KEY_SEPARATOR)[0];
    return name ? { name, installPath } : null;
  }
}

function choosePath(installations: unknown): string | null {
  const candidates = (Array.isArray(installations) ? installations : []).map(
    (item) => asRecord(item) as Installation,
  );
  const chosen = candidates.find((item) => item.scope === PREFERRED_SCOPE) ?? candidates[0];
  return typeof chosen?.installPath === 'string' ? chosen.installPath : null;
}

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const isDirectory = (path: string) =>
  stat(path).then(
    (entry) => entry.isDirectory(),
    () => false,
  );
