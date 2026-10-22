import { describe, expect, it } from 'vitest';

import {
  assertEmptyPeopleIntakeQuery,
  parseCreatePeopleIntakeBody,
  parsePeopleIntakeListQuery,
  parseReviewPeopleIntakeBody,
  parseSubmitPeopleIntakeBody,
  parseUpdatePeopleIntakeBody,
} from './current-organization-people-intakes.input';

function payload() {
  return {
    schema_version: 1,
    people: [
      {
        client_key: 'parent',
        first_name: 'Amina',
        last_name: 'Khan',
        identifiers: [
          {
            identifier_type: 'cnic',
            identifier_value: '12345-1234567-1',
            issuing_authority: 'NADRA',
            issuing_country_code: 'PK',
          },
        ],
      },
      {
        client_key: 'child',
        first_name: 'Sara',
        last_name: 'Khan',
      },
    ],
    relationships: [
      {
        source_person_key: 'parent',
        target_person_key: 'child',
        relationship_type: 'parent_of',
        relationship_role: 'mother',
        relationship_basis: 'biological',
      },
    ],
  };
}

describe('People Intake HTTP input parsing', () => {
  it('maps the public snake-case payload to module contracts', () => {
    const result = parseCreatePeopleIntakeBody({
      title: 'Family review',
      source_type: 'nadra_crc',
      source_reference: null,
      payload: payload(),
    });

    expect(result).toMatchObject({
      title: 'Family review',
      sourceType: 'nadra_crc',
      sourceReference: null,
      payload: {
        schemaVersion: 1,
        people: [{ clientKey: 'parent' }, { clientKey: 'child' }],
        relationships: [{ relationshipType: 'parent_of' }],
      },
    });
  });

  it('does not invent an omitted source reference during a full draft update', () => {
    const result = parseUpdatePeopleIntakeBody({
      expected_version: 3,
      title: 'Family review',
      source_type: 'manual',
      payload: payload(),
    });

    expect(result.expectedVersion).toBe(3);
    expect(Object.hasOwn(result, 'sourceReference')).toBe(false);
  });

  it('parses list, submit, and review controls', () => {
    expect(
      parsePeopleIntakeListQuery({ status: 'submitted', limit: '25', after_id: 'cursor' }),
    ).toEqual({ status: 'submitted', limit: 25, afterId: 'cursor' });
    expect(parseSubmitPeopleIntakeBody({ expected_version: 2 })).toEqual({ expectedVersion: 2 });
    expect(
      parseReviewPeopleIntakeBody({
        expected_version: 2,
        decision: 'rejected',
        notes: 'Identifier did not match the evidence.',
      }),
    ).toEqual({
      expectedVersion: 2,
      decision: 'rejected',
      notes: 'Identifier did not match the evidence.',
    });
  });

  it('rejects unsupported fields and unsupported decisions', () => {
    expect(() => assertEmptyPeopleIntakeQuery({ person_id: 'client-selected' })).toThrow(
      /unsupported field/u,
    );
    expect(() => parseReviewPeopleIntakeBody({ expected_version: 2, decision: 'maybe' })).toThrow(
      /approved or rejected/u,
    );
  });
});
