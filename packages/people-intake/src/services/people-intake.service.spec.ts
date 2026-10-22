import { describe, expect, it } from 'vitest';

import type { PeopleIntakeRepository } from '../database/people-intake-repository';
import { PeopleIntakeModuleError } from '../errors/people-intake-module-error';
import { PEOPLE_INTAKE_PERMISSIONS } from '../permissions/people-intake-permissions';
import type {
  CreatePeopleIntakeRecordInput,
  PeopleIntakeRequestContext,
  StoredPeopleIntakeRecord,
} from '../types/people-intake';
import { PeopleIntakeService } from './people-intake.service';

const actorUserId = '11111111-1111-4111-8111-111111111111';
const tenantId = '22222222-2222-4222-8222-222222222222';
const organizationId = '33333333-3333-4333-8333-333333333333';
const intakeId = '44444444-4444-4444-8444-444444444444';

function context(...permissions: string[]): PeopleIntakeRequestContext {
  return { actorUserId, tenantId, organizationId, permissionCodes: new Set(permissions) };
}

function payload() {
  return {
    schemaVersion: 1 as const,
    people: [
      {
        clientKey: 'parent',
        firstName: 'Amina',
        lastName: 'Khan',
        identifiers: [
          {
            identifierType: 'cnic',
            identifierValue: '12345-1234567-1',
            issuingCountryCode: 'PK',
            issuingAuthority: 'NADRA',
          },
        ],
      },
      {
        clientKey: 'child',
        firstName: 'Sara',
        lastName: 'Khan',
        dateOfBirth: '2015-01-10',
      },
    ],
    relationships: [
      {
        sourcePersonKey: 'parent',
        targetPersonKey: 'child',
        relationshipType: 'parent_of',
        relationshipRole: 'mother',
        relationshipBasis: 'biological',
      },
    ],
  };
}

function stored(input: CreatePeopleIntakeRecordInput): StoredPeopleIntakeRecord {
  const now = new Date('2026-07-16T00:00:00.000Z');
  return {
    id: intakeId,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    title: input.title,
    sourceType: input.sourceType,
    sourceReference: input.sourceReference,
    status: 'draft',
    payload: input.payload,
    personCount: input.personCount,
    relationshipCount: input.relationshipCount,
    version: 1,
    createdByUserId: input.actorUserId,
    submittedAt: null,
    reviewedAt: null,
    reviewedByUserId: null,
    reviewDecision: null,
    reviewNotes: null,
    createdAt: now,
    updatedAt: now,
  };
}

function repository(): PeopleIntakeRepository {
  return {
    async createDraft(input) {
      return { status: 'created', intake: stored(input) };
    },
    async findById() {
      return null;
    },
    async list() {
      return { status: 'available', items: [], nextCursor: null };
    },
    async updateDraft() {
      return { status: 'not_found' };
    },
    async submit() {
      return { status: 'not_found' };
    },
    async review() {
      return { status: 'not_found' };
    },
  };
}

describe('PeopleIntakeService', () => {
  it('creates a normalized draft without mutating canonical People records', async () => {
    const service = new PeopleIntakeService(repository());
    const result = await service.createDraft(context(PEOPLE_INTAKE_PERMISSIONS.create), {
      title: ' Family certificate review ',
      sourceType: ' NADRA_CRC ',
      sourceReference: ' CRC-42 ',
      payload: payload(),
    });
    expect(result.title).toBe('Family certificate review');
    expect(result.sourceType).toBe('nadra_crc');
    expect(result.personCount).toBe(2);
    expect(result.relationshipCount).toBe(1);
    expect(result.payload.people[0]?.identifiers[0]?.issuingCountryCode).toBe('PK');
  });

  it('rejects duplicate identifiers inside a draft', async () => {
    const service = new PeopleIntakeService(repository());
    const base = payload();
    const parent = base.people[0];
    const child = base.people[1];
    if (parent === undefined || child === undefined) {
      throw new Error('The duplicate-identifier fixture requires two people.');
    }
    const duplicate = {
      ...base,
      people: [
        parent,
        {
          ...child,
          identifiers: [
            {
              identifierType: 'cnic',
              identifierValue: '1234512345671',
              issuingCountryCode: 'PK',
              issuingAuthority: 'NADRA',
            },
          ],
        },
      ],
    };
    await expect(
      service.createDraft(context(PEOPLE_INTAKE_PERMISSIONS.create), {
        title: 'Duplicate test',
        sourceType: 'manual',
        payload: duplicate,
      }),
    ).rejects.toMatchObject({ code: 'PEOPLE_INTAKE_INVALID_INPUT' });
  });

  it('rejects a proposed parentage cycle', async () => {
    const service = new PeopleIntakeService(repository());
    const cyclic = payload();
    cyclic.relationships.push({
      sourcePersonKey: 'child',
      targetPersonKey: 'parent',
      relationshipType: 'parent_of',
      relationshipRole: 'parent',
      relationshipBasis: 'declared',
    });
    await expect(
      service.createDraft(context(PEOPLE_INTAKE_PERMISSIONS.create), {
        title: 'Cycle test',
        sourceType: 'manual',
        payload: cyclic,
      }),
    ).rejects.toBeInstanceOf(PeopleIntakeModuleError);
  });

  it('requires an explicit create permission', async () => {
    const service = new PeopleIntakeService(repository());
    await expect(
      service.createDraft(context(), {
        title: 'Forbidden',
        sourceType: 'manual',
        payload: payload(),
      }),
    ).rejects.toMatchObject({ code: 'PEOPLE_INTAKE_FORBIDDEN' });
  });

  it('classifies malformed client intake identifiers as invalid input', async () => {
    const service = new PeopleIntakeService(repository());
    await expect(
      service.get(context(PEOPLE_INTAKE_PERMISSIONS.view), 'not-a-uuid'),
    ).rejects.toMatchObject({ code: 'PEOPLE_INTAKE_INVALID_INPUT' });
  });
});
