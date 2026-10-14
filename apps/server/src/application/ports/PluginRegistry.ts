/** A Claude Code plugin that is installed and enabled. */
export interface InstalledPlugin {
  /** The prefix of the plugin's skills (`<name>:<skill>`). */
  name: string;
  installPath: string;
}

export interface PluginRegistry {
  /** Never throws for a missing or broken registry: returns an empty list. */
  list(): Promise<InstalledPlugin[]>;
}
