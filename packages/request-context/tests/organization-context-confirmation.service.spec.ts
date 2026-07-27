import { describe, expect, it } from 'vitest';

import {
  OrganizationContextConfirmationService,
  type OrganizationContextConfirmationDirectory,
  type OrganizationContextConfirmationRecord,
  type TrustedOrganizationRequestContext,
} from '../src';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const PERSON_ID = '00000000-0000-4000-8000-000000000002';
const SESSION_ID = '00000000-0000-4000-8000-000000000003';
const MEMBERSHIP_ID = '00000000-0000-4000-8000-000000000004';
const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000005';
const TENANT_ID = '00000000-0000-4000-8000-000000000008';

const CONTEXT: TrustedOrganizationRequestContext = {
  scope: 'organization',
  requestId: 'request-1',
  userId: USER_ID,
  personId: PERSON_ID,
  sessionId: SESSION_ID,
  sessionExpiresAt: new Date('2026-07-12T12:00:00.000Z'),
  membershipId: MEMBERSHIP_ID,
  tenantId: TENANT_ID,
  organizationId: ORGANIZATION_ID,
  permissionCodes: new Set([
    'organizations.view',
    'organizations.update',
    'people.view',
    'memberships.create',
    'users.identities.view',
    'access_control.roles.create',
  ]),
  evaluatedAt: new Date('2026-07-12T10:00:00.000Z'),
};

function record(
  overrides: Partial<OrganizationContextConfirmationRecord> = {},
): OrganizationContextConfirmationRecord {
  return {
    membershipId: MEMBERSHIP_ID,
    personId: PERSON_ID,
    tenantId: TENANT_ID,
    tenantStatus: 'active',
    organizationId: ORGANIZATION_ID,
    organizationDisplayName: 'NEWAX Academy',
    organizationType: 'education',
    organizationStatus: 'active',
    membershipType: 'lecturer',
    membershipStatus: 'active',
    jobTitle: 'Senior Lecturer',
    ...overrides,
  };
}

class FakeDirectory implements OrganizationContextConfirmationDirectory {
  membershipId: string | null = null;

  constructor(private readonly result: OrganizationContextConfirmationRecord | null) {}

  async findConfirmationRecord(
    membershipId: string,
  ): Promise<OrganizationContextConfirmationRecord | null> {
    this.membershipId = membershipId;
    return this.result;
  }
}

describe('OrganizationContextConfirmationService', () => {
  it('returns minimal trusted organization context with capability summaries', async () => {
    const directory = new FakeDirectory(record());
    const service = new OrganizationContextConfirmationService(directory);

    const result = await service.confirm(CONTEXT);

    expect(directory.membershipId).toBe(MEMBERSHIP_ID);
    expect(result).toEqual({
      membershipId: MEMBERSHIP_ID,
      tenantId: TENANT_ID,
      organizationId: ORGANIZATION_ID,
      organizationDisplayName: 'NEWAX Academy',
      organizationType: 'education',
      membershipType: 'lecturer',
      jobTitle: 'Senior Lecturer',
      sessionExpiresAt: new Date('2026-07-12T12:00:00.000Z'),
      permissionsEvaluatedAt: new Date('2026-07-12T10:00:00.000Z'),
      capabilities: {
        organizationView: true,
        organizationManage: true,
        peopleView: true,
        peopleManage: false,
        membershipsView: false,
        membershipsManage: true,
        usersView: true,
        usersManage: false,
        accessControlView: false,
        accessControlManage: true,
      },
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.capabilities)).toBe(true);
    expect(result).not.toHaveProperty('permissionCodes');
    expect(result).not.toHaveProperty('sessionId');
    expect(result).not.toHaveProperty('personId');
  });

  it('normalizes trusted identifiers before persistence lookup and comparison', async () => {
    const directory = new FakeDirectory(record());
    const service = new OrganizationContextConfirmationService(directory);
    const uppercaseContext: TrustedOrganizationRequestContext = {
      ...CONTEXT,
      personId: PERSON_ID.toUpperCase(),
      membershipId: MEMBERSHIP_ID.toUpperCase(),
      tenantId: TENANT_ID.toUpperCase(),
      organizationId: ORGANIZATION_ID.toUpperCase(),
    };

    const result = await service.confirm(uppercaseContext);

    expect(directory.membershipId).toBe(MEMBERSHIP_ID);
    expect(result.membershipId).toBe(MEMBERSHIP_ID);
    expect(result.organizationId).toBe(ORGANIZATION_ID);
  });

  it('fails closed when confirmation no longer exists or becomes inactive', async () => {
    await expect(
      new OrganizationContextConfirmationService(new FakeDirectory(null)).confirm(CONTEXT),
    ).rejects.toMatchObject({
      code: 'REQUEST_CONTEXT_MEMBERSHIP_UNAVAILABLE',
    });

    await expect(
      new OrganizationContextConfirmationService(
        new FakeDirectory(record({ organizationStatus: 'suspended' })),
      ).confirm(CONTEXT),
    ).rejects.toMatchObject({
      code: 'REQUEST_CONTEXT_MEMBERSHIP_UNAVAILABLE',
    });
  });

  it('rejects records outside the trusted person or organization boundary', async () => {
    const service = new OrganizationContextConfirmationService(
      new FakeDirectory(record({ personId: '00000000-0000-4000-8000-000000000099' })),
    );

    await expect(service.confirm(CONTEXT)).rejects.toMatchObject({
      code: 'REQUEST_CONTEXT_INTEGRITY_FAILURE',
    });
  });

  it('rejects permission evaluation after session expiry before persistence access', async () => {
    const directory = new FakeDirectory(record());
    const service = new OrganizationContextConfirmationService(directory);

    await expect(
      service.confirm({
        ...CONTEXT,
        evaluatedAt: new Date('2026-07-12T13:00:00.000Z'),
      }),
    ).rejects.toMatchObject({
      code: 'REQUEST_CONTEXT_INTEGRITY_FAILURE',
    });
    expect(directory.membershipId).toBeNull();
  });
});
