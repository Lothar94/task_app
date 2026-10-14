/** Makes the user's skills visible to a run of an agent without exposing the rest of the user's setup. */
export interface SkillWorkspace {
  /**
   * Prepares a directory whose `.claude/skills` holds only the given skills that exist.
   * @returns the directory, or null when the agent has no installed skills to use.
   */
  prepare(agentId: string, skills: readonly string[]): Promise<string | null>;
}
