import type { OrganizationRepository } from '../../../application/ports/OrganizationRepository.js';
import { Organization } from '../../../domain/organization/Organization.js';
import type { SqliteDatabase } from './openDatabase.js';

interface OrganizationRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export class SqliteOrganizationRepository implements OrganizationRepository {
  constructor(private readonly db: SqliteDatabase) {}

  save(organization: Organization): void {
    const snapshot = organization.toSnapshot();
    this.db
      .prepare(
        `INSERT INTO organizations (id, name, created_at, updated_at)
         VALUES (@id, @name, @createdAt, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET name = @name, updated_at = @updatedAt`,
      )
      .run({
        ...snapshot,
        createdAt: snapshot.createdAt.toISOString(),
        updatedAt: snapshot.updatedAt.toISOString(),
      });
  }

  findById(id: string): Organization | null {
    const row = this.db.prepare('SELECT * FROM organizations WHERE id = ?').get(id) as
      OrganizationRow | undefined;
    return row ? this.toOrganization(row) : null;
  }

  findByName(name: string): Organization | null {
    const row = this.db.prepare('SELECT * FROM organizations WHERE name = ?').get(name) as
      OrganizationRow | undefined;
    return row ? this.toOrganization(row) : null;
  }

  findAll(): Organization[] {
    const rows = this.db
      .prepare('SELECT * FROM organizations ORDER BY created_at, rowid')
      .all() as OrganizationRow[];
    return rows.map((row) => this.toOrganization(row));
  }

  private toOrganization(row: OrganizationRow): Organization {
    return Organization.restore({
      id: row.id,
      name: row.name,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
