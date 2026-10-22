import { describe, expect, it } from 'vitest';

import type { PersonRelationshipRepository } from '../database/person-relationship-repository';
import type { PersonRelationshipEventPublisher } from '../events/person-relationship-event';
import { PEOPLE_PERMISSIONS } from '../permissions/people-permissions';
import type {
  PersonRelationshipRecord,
  PersonRelationshipRequestContext,
  UpdatePersonRelationshipRecordInput,
} from '../types/person-relationship';
import type { PersonRecord } from '../types/person';
import { PersonRelationshipService } from './person-relationship.service';

const actorUserId = '11111111-1111-4111-8111-111111111111';
const tenantId = '22222222-2222-4222-8222-222222222222';
const organizationId = '33333333-3333-4333-8333-333333333333';
const parentId = '44444444-4444-4444-8444-444444444444';
const childId = '55555555-5555-4555-8555-555555555555';
const relationshipId = '66666666-6666-4666-8666-666666666666';

function context(...permissions: string[]): PersonRelationshipRequestContext {
  return { actorUserId, tenantId, organizationId, permissionCodes: new Set(permissions) };
}

function person(id: string, firstName: string): PersonRecord {
  const now = new Date('2026-07-16T00:00:00.000Z');
  return {
    id,
    firstName,
    middleName: null,
    lastName: 'Khan',
    preferredName: null,
    dateOfBirth: new Date('2000-01-01T00:00:00.000Z'),
    gender: 'unspecified',
    status: 'active',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

function relationship(overrides: Partial<PersonRelationshipRecord> = {}): PersonRelationshipRecord {
  const now = new Date('2026-07-16T00:00:00.000Z');
  return {
    id: relationshipId,
    tenantId,
    sourcePersonId: parentId,
    targetPersonId: childId,
    relationshipType: 'parent_of',
    relationshipRole: 'mother',
    relationshipBasis: 'biological',
    status: 'active',
    validFrom: null,
    validUntil: null,
    isVerified: false,
    verifiedAt: null,
    verifiedByUserId: null,
    verificationSource: null,
    verificationRevokedAt: null,
    verificationRevokedByUserId: null,
    verificationRevocationReason: null,
    sourceReference: 'certificate-42',
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function repository(options: { reachable?: boolean; updateConflict?: boolean } = {}) {
  let current = relationship();
  const people = new Map([
    [parentId, person(parentId, 'Amina')],
    [childId, person(childId, 'Sara')],
  ]);
  const implementation: PersonRelationshipRepository = {
    async createRelationship(input) {
      current = relationship({
        tenantId: input.tenantId,
        sourcePersonId: input.sourcePersonId,
        targetPersonId: input.targetPersonId,
        relationshipType: input.relationshipType,
        relationshipRole: input.relationshipRole,
        relationshipBasis: input.relationshipBasis,
        validFrom: input.validFrom,
        validUntil: input.validUntil,
        sourceReference: input.sourceReference,
      });
      return { status: 'created', relationship: current };
    },
    async findPersonById(id) {
      return people.get(id) ?? null;
    },
    async findRelationshipById(requestTenantId, id) {
      return requestTenantId === tenantId && id === relationshipId ? current : null;
    },
    async hasActiveOrganizationMembership(_tenant, _organization, id) {
      return options.reachable === false ? false : id === parentId;
    },
    async listConnectedRelationships() {
      return [current];
    },
    async listPeopleWithIdentifiers(ids) {
      return ids.flatMap((id) => {
        const found = people.get(id);
        return found === undefined
          ? []
          : [
              {
                person: found,
                identifiers: [
                  {
                    id: `${id.slice(0, 32)}aaaa`,
                    personId: id,
                    identifierType: 'cnic',
                    identifierValue: '1234512345671',
                    issuingAuthority: 'NADRA',
                    issuingCountryCode: 'PK',
                    validFrom: null,
                    validUntil: null,
                    isVerified: true,
                    verifiedAt: new Date('2026-07-15T00:00:00.000Z'),
                    createdAt: new Date('2026-07-15T00:00:00.000Z'),
                    updatedAt: new Date('2026-07-15T00:00:00.000Z'),
                  },
                ],
              },
            ];
      });
    },
    async updateRelationship(input: UpdatePersonRelationshipRecordInput) {
      if (options.updateConflict === true || input.expectedVersion !== current.version) {
        return { status: 'conflict' };
      }
      current = relationship({
        ...input,
        id: current.id,
        sourcePersonId: current.sourcePersonId,
        targetPersonId: current.targetPersonId,
        relationshipType: current.relationshipType,
        version: current.version + 1,
        createdAt: current.createdAt,
        updatedAt: new Date('2026-07-16T01:00:00.000Z'),
      });
      return { status: 'updated', relationship: current };
    },
  };
  return implementation;
}

const events: PersonRelationshipEventPublisher = { async publish() {} };

describe('PersonRelationshipService', () => {
  it('creates a governed relationship when one endpoint belongs to the Organization', async () => {
    const service = new PersonRelationshipService(repository(), events);
    const result = await service.create(context(PEOPLE_PERMISSIONS.relationshipsManage), {
      sourcePersonId: parentId,
      targetPersonId: childId,
      relationshipType: 'PARENT_OF',
      relationshipRole: 'MOTHER',
      relationshipBasis: 'BIOLOGICAL',
    });
    expect(result.relationshipType).toBe('parent_of');
    expect(result.relationshipRole).toBe('mother');
  });

  it('rejects relationships outside the current Organization boundary', async () => {
    const service = new PersonRelationshipService(repository({ reachable: false }), events);
    await expect(
      service.create(context(PEOPLE_PERMISSIONS.relationshipsManage), {
        sourcePersonId: parentId,
        targetPersonId: childId,
        relationshipType: 'parent_of',
        relationshipRole: 'mother',
        relationshipBasis: 'biological',
      }),
    ).rejects.toMatchObject({ code: 'PERSON_RELATIONSHIP_FORBIDDEN' });
  });

  it('redacts sensitive family fields by default', async () => {
    const service = new PersonRelationshipService(repository(), events);
    const graph = await service.familyTree(context(PEOPLE_PERMISSIONS.relationshipsView), parentId);
    expect(graph.sensitiveFieldsIncluded).toBe(false);
    expect(graph.nodes[0]?.dateOfBirth).toBeNull();
    expect(graph.nodes[0]?.identifiers[0]?.identifierValue).toBeNull();
    expect(graph.nodes[0]?.identifiers[0]?.maskedValue.endsWith('5671')).toBe(true);
    expect(graph.relationships[0]?.sourceReference).toBeNull();
  });

  it('requires the sensitive permission before returning full identifiers', async () => {
    const service = new PersonRelationshipService(repository(), events);
    await expect(
      service.familyTree(context(PEOPLE_PERMISSIONS.relationshipsView), parentId, {
        includeSensitive: true,
      }),
    ).rejects.toMatchObject({ code: 'PERSON_RELATIONSHIP_FORBIDDEN' });
    const graph = await service.familyTree(
      context(PEOPLE_PERMISSIONS.relationshipsView, PEOPLE_PERMISSIONS.familySensitiveView),
      parentId,
      { includeSensitive: true },
    );
    expect(graph.nodes[0]?.identifiers[0]?.identifierValue).toBe('1234512345671');
  });

  it('uses optimistic versions for relationship corrections', async () => {
    const service = new PersonRelationshipService(repository({ updateConflict: true }), events);
    await expect(
      service.update(context(PEOPLE_PERMISSIONS.relationshipsManage), relationshipId, {
        expectedVersion: 1,
        relationshipRole: 'parent',
      }),
    ).rejects.toMatchObject({ code: 'PERSON_RELATIONSHIP_STATE_CONFLICT' });
  });

  it('persists verification revocation metadata instead of silently erasing history', async () => {
    const service = new PersonRelationshipService(repository(), events);
    const verified = await service.verify(
      context(PEOPLE_PERMISSIONS.relationshipsVerify),
      relationshipId,
      { expectedVersion: 1, verificationSource: 'NADRA CRC' },
    );
    const revoked = await service.revokeVerification(
      context(PEOPLE_PERMISSIONS.relationshipsVerify),
      relationshipId,
      { expectedVersion: verified.version, reason: 'Certificate was superseded.' },
    );
    expect(revoked.isVerified).toBe(false);
    expect(revoked.verificationRevocationReason).toBe('Certificate was superseded.');
    expect(revoked.verificationRevokedByUserId).toBe(actorUserId);
  });
});
