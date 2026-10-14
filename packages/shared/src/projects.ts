export interface ProjectDto {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  workspacePath: string;
  memberIds: string[];
  createdAt: string;
}

export interface ProjectInput {
  name: string;
  description: string;
  workspacePath: string;
  memberIds: string[];
}
