import { mkdirSync } from 'node:fs';
import type { WorkspaceProvisioner } from '../../application/ports/WorkspaceProvisioner.js';

export class FileSystemWorkspaceProvisioner implements WorkspaceProvisioner {
  ensureExists(absolutePath: string): void {
    mkdirSync(absolutePath, { recursive: true });
  }
}
