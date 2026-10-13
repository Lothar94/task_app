export interface ProjectDto {
  id: string;
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
