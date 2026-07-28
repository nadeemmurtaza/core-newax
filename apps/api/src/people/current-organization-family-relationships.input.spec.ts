import { describe, expect, it } from 'vitest';

import {
  parseCreateRelationshipBody,
  parseFamilyTreeQuery,
  parseUpdateRelationshipBody,
} from './current-organization-family-relationships.input';

describe('family relationship HTTP input', () => {
  it('parses bounded family-tree options', () => {
    expect(parseFamilyTreeQuery({ depth: '3', include_sensitive: 'true' })).toEqual({
      depth: 3,
      includeSensitive: true,
    });
  });

  it('parses relationship dates as UTC dates', () => {
    const result = parseCreateRelationshipBody({
      source_person_id: '11111111-1111-4111-8111-111111111111',
      target_person_id: '22222222-2222-4222-8222-222222222222',
      relationship_type: 'parent_of',
      relationship_role: 'father',
      relationship_basis: 'biological',
      valid_from: '2020-01-02',
    });
    expect(result.validFrom?.toISOString()).toBe('2020-01-02T00:00:00.000Z');
  });

  it('rejects unsupported client fields', () => {
    expect(() =>
      parseUpdateRelationshipBody({ expected_version: 1, tenant_id: 'forged' }),
    ).toThrow();
  });
});
