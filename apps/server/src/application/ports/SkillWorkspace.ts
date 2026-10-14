export interface PreparedSkills {
  /** Directory whose `.claude/skills` holds the user skills, or null when there are none. */
  skillsDirectory: string | null;
  /** Install paths of the enabled plugins that provide the agent's plugin skills. */
  pluginPaths: string[];
}

/** Makes the user's and plugins' skills visible to a run of an agent without exposing the rest of the user's setup. */
export interface SkillWorkspace {
  /**
   * Prepares a directory whose `.claude/skills` holds only the given user skills that exist, and
   * resolves the plugins of the given `plugin:skill` names. Skills that are not installed are ignored.
   */
  prepare(skills: readonly string[]): Promise<PreparedSkills>;
}
