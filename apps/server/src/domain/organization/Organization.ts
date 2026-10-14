import { requireText } from '../shared/guards.js';

export const MAX_ORGANIZATION_NAME_LENGTH = 120;

export interface OrganizationSnapshot {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Organization {
  private constructor(private state: OrganizationSnapshot) {}

  static create(id: string, name: string, now: Date): Organization {
    return new Organization({ id, name: Organization.validateName(name), createdAt: now, updatedAt: now });
  }

  static restore(snapshot: OrganizationSnapshot): Organization {
    return new Organization({ ...snapshot });
  }

  get id(): string {
    return this.state.id;
  }

  get name(): string {
    return this.state.name;
  }

  rename(name: string, now: Date): void {
    this.state = { ...this.state, name: Organization.validateName(name), updatedAt: now };
  }

  toSnapshot(): OrganizationSnapshot {
    return { ...this.state };
  }

  private static validateName(name: string): string {
    return requireText(name, 'name', MAX_ORGANIZATION_NAME_LENGTH);
  }
}
