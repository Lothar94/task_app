export interface AgentBrief {
  name: string;
  role: string;
  description: string;
  allowedTools: string[];
  skills: string[];
  collaborators: { name: string; role: string }[];
  /** Free-form requests from the project manager to shape the result. */
  guidance: string;
}

/** Drafts the system instructions of an agent from a short brief. */
export interface InstructionWriter {
  write(brief: AgentBrief): Promise<string>;
}
