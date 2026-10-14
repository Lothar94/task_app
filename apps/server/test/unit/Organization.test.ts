import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../src/domain/errors/DomainError.js';
import { Organization } from '../../src/domain/organization/Organization.js';

const now = new Date('2026-01-01T00:00:00Z');

describe('Organization', () => {
  it('trims the name when created', () => {
    const organization = Organization.create('o1', '  Acme  ', now);

    expect(organization.toSnapshot()).toEqual({ id: 'o1', name: 'Acme', createdAt: now, updatedAt: now });
  });

  it('rejects empty, blank and too long names', () => {
    expect(() => Organization.create('o1', '   ', now)).toThrow(ValidationError);
    expect(() => Organization.create('o1', 'x'.repeat(121), now)).toThrow(ValidationError);
    expect(Organization.create('o1', 'x'.repeat(120), now).name).toHaveLength(120);
  });

  it('renames keeping the creation date and refreshing the update date', () => {
    const later = new Date('2026-02-01T00:00:00Z');
    const organization = Organization.create('o1', 'Acme', now);

    organization.rename('  Globex ', later);

    expect(organization.toSnapshot()).toEqual({ id: 'o1', name: 'Globex', createdAt: now, updatedAt: later });
  });

  it('keeps its state when a rename is invalid', () => {
    const organization = Organization.create('o1', 'Acme', now);

    expect(() => organization.rename(' ', new Date())).toThrow(ValidationError);
    expect(organization.toSnapshot().name).toBe('Acme');
  });
});
