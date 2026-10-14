import type { OrganizationDto } from '@fleet/shared';
import { describe, expect, it } from 'vitest';
import {
  ORGANIZATION_NAME_MAX_LENGTH,
  resolveCurrentOrganization,
  validateOrganizationName,
} from './organizationModel';
import { queryKeys } from '../../api/queryKeys';

const org = (id: string): OrganizationDto => ({ id, name: id, createdAt: '', updatedAt: '' });

describe('resolveCurrentOrganization', () => {
  const organizations = [org('a'), org('b')];

  it('uses the stored organization when it exists', () => {
    expect(resolveCurrentOrganization(organizations, 'b')?.id).toBe('b');
  });

  it('falls back to the first organization when nothing is stored', () => {
    expect(resolveCurrentOrganization(organizations, null)?.id).toBe('a');
  });

  it('falls back to the first organization when the stored id no longer exists', () => {
    expect(resolveCurrentOrganization(organizations, 'gone')?.id).toBe('a');
  });

  it('returns null without organizations', () => {
    expect(resolveCurrentOrganization([], 'a')).toBeNull();
  });
});

describe('validateOrganizationName', () => {
  it('trims the name', () => {
    expect(validateOrganizationName('  Acme  ')).toEqual({ name: 'Acme', error: null });
  });

  it('rejects empty and blank names', () => {
    expect(validateOrganizationName('').error).not.toBeNull();
    expect(validateOrganizationName('   ').error).not.toBeNull();
  });

  it('accepts the maximum length and rejects one more', () => {
    expect(validateOrganizationName('x'.repeat(ORGANIZATION_NAME_MAX_LENGTH)).error).toBeNull();
    expect(validateOrganizationName('x'.repeat(ORGANIZATION_NAME_MAX_LENGTH + 1)).error).not.toBeNull();
  });
});

describe('queryKeys', () => {
  it('scopes lists by organization', () => {
    expect(queryKeys.agents('a')).not.toEqual(queryKeys.agents('b'));
    expect(queryKeys.projects('a')).not.toEqual(queryKeys.projects('b'));
    expect(queryKeys.dashboard('a', null, 30)).not.toEqual(queryKeys.dashboard('b', null, 30));
  });
});
