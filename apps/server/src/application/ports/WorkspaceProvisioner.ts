export interface WorkspaceProvisioner {
  ensureExists(absolutePath: string): void;
}
