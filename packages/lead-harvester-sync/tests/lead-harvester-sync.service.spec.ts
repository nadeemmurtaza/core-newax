import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type {
  AddressesCollaborator,
  ContactsCollaborator,
  ExternalReferencesCollaborator,
  MembershipsCollaborator,
  OrganizationsCollaborator,
  PeopleCollaborator,
} from '../src/collaborators/lead-harvester-sync-collaborators';
import { LEAD_HARVESTER_SYNC_PERMISSIONS } from '../src/permissions/lead-harvester-sync-permissions';
import { LeadHarvesterSyncService } from '../src/services/lead-harvester-sync.service';
import type {
  LeadHarvesterInstitutionUpsertedPayload,
  LeadHarvesterSyncRequestContext,
} from '../src/types/lead-harvester-sync';
import type {
  LeadHarvesterSyncEvent,
  LeadHarvesterSyncEventPublisher,
} from '../src/events/lead-harvester-sync-event';

const ACTOR_ID = '00000000-0000-4000-8000-000000000001';
const TENANT_ID = '00000000-0000-4000-8000-000000000002';

function context(): LeadHarvesterSyncRequestContext {
  return {
    actorUserId: ACTOR_ID,
    tenantId: TENANT_ID,
    permissionCodes: new Set([LEAD_HARVESTER_SYNC_PERMISSIONS.ingest]),
  };
}

function payload(
  overrides: Partial<LeadHarvesterInstitutionUpsertedPayload> = {},
): LeadHarvesterInstitutionUpsertedPayload {
  return {
    schemaVersion: 1,
    eventId: randomUUID(),
    eventType: 'institution.upserted',
    occurredAt: '2026-07-20T10:00:00.000Z',
    institution: {
      id: 'institution-1',
      canonicalName: 'Riverside School',
      institutionType: 'school',
      domain: 'riverside.edu',
      website: 'https://riverside.edu',
      status: 'qualified',
    },
    branches: [
      {
        id: 'branch-1',
        branchName: 'Main Campus',
        address: '12 River Road',
        city: 'Islamabad',
        countryCode: 'PK',
      },
    ],
    contactPoints: [
      {
        id: 'contact-1',
        contactType: 'email',
        contactValue: 'admissions@riverside.edu',
        personName: 'Sara Ahmed',
        role: 'Admissions Officer',
      },
      {
        id: 'contact-2',
        contactType: 'linkedin',
        contactValue: 'https://linkedin.com/company/riverside',
      },
    ],
    ...overrides,
  };
}

interface StoredExternalReference {
  id: string;
  tenantId: string;
  organizationId: string;
  domainCode: string;
  entityType: string;
  entityId: string;
  externalSystem: string;
  externalKey: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

class FakeExternalReferences implements ExternalReferencesCollaborator {
  readonly store = new Map<string, StoredExternalReference>();
  readonly registerCalls: unknown[] = [];
  readonly repointCalls: unknown[] = [];

  private keyOf(externalSystem: string, externalKey: string): string {
    return `${externalSystem}|${externalKey}`;
  }

  async findTenantExternalReferenceByKey(
    _context: unknown,
    input: { readonly externalSystem: string; readonly externalKey: string },
  ) {
    const record = this.store.get(this.keyOf(input.externalSystem, input.externalKey));
    return record === undefined ? null : { ...record };
  }

  async findCurrentOrganizationExternalReferenceByKey(
    _context: unknown,
    input: { readonly externalSystem: string; readonly externalKey: string },
  ) {
    const record = this.store.get(this.keyOf(input.externalSystem, input.externalKey));
    return record === undefined ? null : { ...record };
  }

  async registerCurrentOrganizationExternalReference(
    context: { readonly tenantId: string; readonly organizationId: string },
    input: {
      readonly domainCode: string;
      readonly entityType: string;
      readonly entityId: string;
      readonly externalSystem: string;
      readonly externalKey: string;
      readonly metadata?: Record<string, unknown> | null;
    },
  ) {
    this.registerCalls.push({ context, input });
    const record: StoredExternalReference = {
      id: randomUUID(),
      tenantId: context.tenantId,
      organizationId: context.organizationId,
      domainCode: input.domainCode,
      entityType: input.entityType,
      entityId: input.entityId,
      externalSystem: input.externalSystem,
      externalKey: input.externalKey,
      metadata: input.metadata ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.set(this.keyOf(input.externalSystem, input.externalKey), record);
    return { ...record };
  }

  async updateCurrentOrganizationExternalReferenceEntity(
    _context: unknown,
    input: {
      readonly externalSystem: string;
      readonly externalKey: string;
      readonly entityId: string;
      readonly metadata?: Record<string, unknown> | null;
    },
  ) {
    this.repointCalls.push(input);
    const key = this.keyOf(input.externalSystem, input.externalKey);
    const existing = this.store.get(key);
    if (existing === undefined) {
      throw new Error('not_found');
    }
    const updated: StoredExternalReference = {
      ...existing,
      entityId: input.entityId,
      metadata: input.metadata === undefined ? existing.metadata : input.metadata,
      updatedAt: new Date(),
    };
    this.store.set(key, updated);
    return { ...updated };
  }
}

class FakeOrganizations implements OrganizationsCollaborator {
  readonly createCalls: unknown[] = [];
  readonly updateCalls: unknown[] = [];

  async create(
    _context: unknown,
    input: {
      readonly legalName: string;
      readonly displayName: string;
      readonly organizationType: string;
    },
  ) {
    this.createCalls.push(input);
    return {
      id: randomUUID(),
      tenantId: TENANT_ID,
      parentOrganizationId: null,
      legalName: input.legalName,
      displayName: input.displayName,
      organizationType: input.organizationType,
      registrationNumber: null,
      taxNumber: null,
      status: 'active' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
  }

  async update(
    _context: unknown,
    organizationId: string,
    input: {
      readonly legalName?: string;
      readonly displayName?: string;
      readonly organizationType?: string;
    },
  ) {
    this.updateCalls.push({ organizationId, input });
    return {
      id: organizationId,
      tenantId: TENANT_ID,
      parentOrganizationId: null,
      legalName: input.legalName ?? 'Riverside School',
      displayName: input.displayName ?? 'Riverside School',
      organizationType: input.organizationType ?? 'school',
      registrationNumber: null,
      taxNumber: null,
      status: 'active' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
  }
}

class FakeAddresses implements AddressesCollaborator {
  nextCreatedId: string | null = null;
  readonly createCalls: unknown[] = [];
  readonly updateCalls: unknown[] = [];

  async addCurrentOrganizationAddress(
    context: { readonly tenantId: string; readonly organizationId: string },
    input: {
      readonly addressType: string;
      readonly isPrimary: boolean;
      readonly line1: string;
      readonly city: string;
      readonly stateRegion?: string | null;
      readonly postalCode?: string | null;
      readonly countryCode: string;
    },
  ) {
    this.createCalls.push(input);
    return {
      id: this.nextCreatedId ?? randomUUID(),
      tenantId: context.tenantId,
      organizationId: context.organizationId,
      addressId: randomUUID(),
      addressType: input.addressType as never,
      isPrimary: input.isPrimary,
      line1: input.line1,
      line2: null,
      city: input.city,
      stateRegion: input.stateRegion ?? null,
      postalCode: input.postalCode ?? null,
      countryCode: input.countryCode,
      createdAt: new Date(),
    };
  }

  async updateCurrentOrganizationAddress(
    context: { readonly tenantId: string; readonly organizationId: string },
    input: {
      readonly organizationAddressId: string;
      readonly addressType: string;
      readonly isPrimary: boolean;
      readonly line1: string;
      readonly city: string;
      readonly stateRegion?: string | null;
      readonly postalCode?: string | null;
      readonly countryCode: string;
    },
  ) {
    this.updateCalls.push(input);
    return {
      id: this.nextCreatedId ?? input.organizationAddressId,
      tenantId: context.tenantId,
      organizationId: context.organizationId,
      addressId: randomUUID(),
      addressType: input.addressType as never,
      isPrimary: input.isPrimary,
      line1: input.line1,
      line2: null,
      city: input.city,
      stateRegion: input.stateRegion ?? null,
      postalCode: input.postalCode ?? null,
      countryCode: input.countryCode,
      createdAt: new Date(),
    };
  }
}

class FakeContacts implements ContactsCollaborator {
  nextOrganizationContactId: string | null = null;
  nextPersonContactId: string | null = null;
  readonly organizationCreateCalls: unknown[] = [];
  readonly organizationUpdateCalls: unknown[] = [];
  readonly personCreateCalls: unknown[] = [];
  readonly personUpdateCalls: unknown[] = [];

  async addCurrentOrganizationContact(
    context: { readonly organizationId: string },
    input: {
      readonly contactType: string;
      readonly contactValue: string;
      readonly label?: string | null;
    },
  ) {
    this.organizationCreateCalls.push(input);
    return {
      id: this.nextOrganizationContactId ?? randomUUID(),
      organizationId: context.organizationId,
      contactMethodId: randomUUID(),
      contactType: input.contactType as never,
      contactValue: input.contactValue,
      isVerified: false,
      verifiedAt: null,
      label: input.label ?? null,
      isPrimary: false,
      status: 'active' as const,
      validFrom: null,
      validUntil: null,
      createdAt: new Date(),
    };
  }

  async updateCurrentOrganizationContact(
    context: { readonly organizationId: string },
    input: {
      readonly contactId: string;
      readonly contactType: string;
      readonly contactValue: string;
      readonly label?: string | null;
    },
  ) {
    this.organizationUpdateCalls.push(input);
    return {
      id: this.nextOrganizationContactId ?? input.contactId,
      organizationId: context.organizationId,
      contactMethodId: randomUUID(),
      contactType: input.contactType as never,
      contactValue: input.contactValue,
      isVerified: false,
      verifiedAt: null,
      label: input.label ?? null,
      isPrimary: false,
      status: 'active' as const,
      validFrom: null,
      validUntil: null,
      createdAt: new Date(),
    };
  }

  async addCurrentPersonContact(
    _context: unknown,
    input: {
      readonly personId: string;
      readonly contactType: string;
      readonly contactValue: string;
      readonly label?: string | null;
    },
  ) {
    this.personCreateCalls.push(input);
    return {
      id: this.nextPersonContactId ?? randomUUID(),
      personId: input.personId,
      contactMethodId: randomUUID(),
      contactType: input.contactType as never,
      contactValue: input.contactValue,
      isVerified: false,
      verifiedAt: null,
      label: input.label ?? null,
      isPrimary: false,
      status: 'active' as const,
      validFrom: null,
      validUntil: null,
      createdAt: new Date(),
    };
  }

  async updateCurrentPersonContact(
    _context: unknown,
    input: {
      readonly personId: string;
      readonly contactId: string;
      readonly contactType: string;
      readonly contactValue: string;
      readonly label?: string | null;
    },
  ) {
    this.personUpdateCalls.push(input);
    return {
      id: this.nextPersonContactId ?? input.contactId,
      personId: input.personId,
      contactMethodId: randomUUID(),
      contactType: input.contactType as never,
      contactValue: input.contactValue,
      isVerified: false,
      verifiedAt: null,
      label: input.label ?? null,
      isPrimary: false,
      status: 'active' as const,
      validFrom: null,
      validUntil: null,
      createdAt: new Date(),
    };
  }
}

class FakePeople implements PeopleCollaborator {
  readonly createCalls: unknown[] = [];
  readonly updateCalls: unknown[] = [];

  async create(
    _context: unknown,
    input: { readonly firstName: string; readonly lastName: string },
  ) {
    this.createCalls.push(input);
    return {
      id: randomUUID(),
      firstName: input.firstName,
      middleName: null,
      lastName: input.lastName,
      preferredName: null,
      dateOfBirth: null,
      gender: null,
      status: 'active' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
  }

  async update(
    _context: unknown,
    personId: string,
    input: { readonly firstName?: string; readonly lastName?: string },
  ) {
    this.updateCalls.push({ personId, input });
    return {
      id: personId,
      firstName: input.firstName ?? 'Sara',
      middleName: null,
      lastName: input.lastName ?? 'Ahmed',
      preferredName: null,
      dateOfBirth: null,
      gender: null,
      status: 'active' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
  }
}

class FakeMemberships implements MembershipsCollaborator {
  readonly createCalls: unknown[] = [];
  readonly updateCalls: unknown[] = [];

  async create(
    context: { readonly organizationId: string },
    input: {
      readonly personId: string;
      readonly membershipType: string;
      readonly jobTitle?: string | null;
    },
  ) {
    this.createCalls.push(input);
    return {
      id: randomUUID(),
      personId: input.personId,
      organizationId: context.organizationId,
      membershipType: input.membershipType,
      referenceNumber: null,
      jobTitle: input.jobTitle ?? null,
      status: 'active' as const,
      startDate: new Date(),
      endDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async update(
    context: { readonly organizationId: string },
    membershipId: string,
    input: { readonly jobTitle?: string | null },
  ) {
    this.updateCalls.push({ membershipId, input });
    return {
      id: membershipId,
      personId: randomUUID(),
      organizationId: context.organizationId,
      membershipType: 'contact',
      referenceNumber: null,
      jobTitle: input.jobTitle ?? null,
      status: 'active' as const,
      startDate: new Date(),
      endDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

class RecordingEventPublisher implements LeadHarvesterSyncEventPublisher {
  readonly events: LeadHarvesterSyncEvent[] = [];

  async publish(event: LeadHarvesterSyncEvent): Promise<void> {
    this.events.push(event);
  }
}

function buildService(): {
  readonly service: LeadHarvesterSyncService;
  readonly externalReferences: FakeExternalReferences;
  readonly organizations: FakeOrganizations;
  readonly addresses: FakeAddresses;
  readonly contacts: FakeContacts;
  readonly people: FakePeople;
  readonly memberships: FakeMemberships;
  readonly publisher: RecordingEventPublisher;
} {
  const externalReferences = new FakeExternalReferences();
  const organizations = new FakeOrganizations();
  const addresses = new FakeAddresses();
  const contacts = new FakeContacts();
  const people = new FakePeople();
  const memberships = new FakeMemberships();
  const publisher = new RecordingEventPublisher();
  const service = new LeadHarvesterSyncService(
    externalReferences,
    organizations,
    addresses,
    contacts,
    people,
    memberships,
    publisher,
  );
  return {
    service,
    externalReferences,
    organizations,
    addresses,
    contacts,
    people,
    memberships,
    publisher,
  };
}

describe('LeadHarvesterSyncService', () => {
  it('requires the ingest permission', async () => {
    const { service } = buildService();
    await expect(
      service.syncInstitutionUpserted(
        { actorUserId: ACTOR_ID, tenantId: TENANT_ID, permissionCodes: new Set() },
        payload(),
      ),
    ).rejects.toMatchObject({ code: 'LEAD_HARVESTER_SYNC_FORBIDDEN' });
  });

  it.each([{ schemaVersion: 2 as const }, { eventType: 'institution.deleted' as never }])(
    'rejects an unsupported payload shape',
    async (overrides) => {
      const { service } = buildService();
      await expect(
        service.syncInstitutionUpserted(context(), payload(overrides)),
      ).rejects.toMatchObject({ code: 'LEAD_HARVESTER_SYNC_INVALID_PAYLOAD' });
    },
  );

  it('creates a brand-new institution, branch, and contacts, skipping unsupported types', async () => {
    const test = buildService();

    const result = await test.service.syncInstitutionUpserted(context(), payload());

    expect(result.status).toBe('applied');
    if (result.status !== 'applied') {
      throw new Error('Expected the sync to apply.');
    }
    expect(result.skipped).toEqual([
      { kind: 'contact_point', id: 'contact-2', reason: 'unsupported_contact_type' },
    ]);
    expect(test.organizations.createCalls).toHaveLength(1);
    expect(test.addresses.createCalls).toHaveLength(1);
    expect(test.contacts.organizationCreateCalls).toHaveLength(1);
    expect(test.people.createCalls).toEqual([{ firstName: 'Sara', lastName: 'Ahmed' }]);
    expect(test.contacts.personCreateCalls).toHaveLength(1);
    expect(test.memberships.createCalls).toEqual([
      { personId: expect.any(String), membershipType: 'contact', jobTitle: 'Admissions Officer' },
    ]);

    const institutionRef = test.externalReferences.store.get(
      'lead_harvester|institution:institution-1',
    );
    expect(institutionRef?.entityId).toBe(result.organizationId);
    expect(institutionRef?.metadata).toMatchObject({
      domain: 'riverside.edu',
      website: 'https://riverside.edu',
      status: 'qualified',
    });
    expect(test.externalReferences.store.has('lead_harvester|branch:branch-1')).toBe(true);
    expect(test.externalReferences.store.has('lead_harvester|contact:contact-1')).toBe(true);
    expect(test.externalReferences.store.has('lead_harvester|contact-person:contact-1')).toBe(true);
    expect(test.externalReferences.store.has('lead_harvester|contact:contact-2')).toBe(false);

    expect(test.publisher.events).toHaveLength(1);
    expect(test.publisher.events[0]).toMatchObject({
      name: 'lead_harvester_sync.institution_synced',
      organizationId: result.organizationId,
      skippedCount: 1,
    });
  });

  it('updates an existing institution, branch, and contact in place when values are unchanged', async () => {
    const test = buildService();
    const first = await test.service.syncInstitutionUpserted(context(), payload());
    if (first.status !== 'applied') {
      throw new Error('Expected the first sync to apply.');
    }

    const second = await test.service.syncInstitutionUpserted(
      context(),
      payload({ occurredAt: '2026-07-21T10:00:00.000Z' }),
    );

    expect(second).toEqual({
      status: 'applied',
      organizationId: first.organizationId,
      skipped: [{ kind: 'contact_point', id: 'contact-2', reason: 'unsupported_contact_type' }],
    });
    expect(test.organizations.createCalls).toHaveLength(1);
    expect(test.organizations.updateCalls).toHaveLength(1);
    expect(test.addresses.createCalls).toHaveLength(1);
    expect(test.addresses.updateCalls).toHaveLength(1);
    expect(test.contacts.organizationCreateCalls).toHaveLength(1);
    expect(test.contacts.organizationUpdateCalls).toHaveLength(1);
    expect(test.people.updateCalls).toHaveLength(1);
    expect(test.memberships.updateCalls).toHaveLength(1);
    // No relink occurred (same value each time), so no repoint calls beyond the institution's own metadata refresh.
    expect(test.externalReferences.repointCalls).toHaveLength(1);
  });

  it('relinks a contact whose value changed and repoints its external reference', async () => {
    const test = buildService();
    const first = await test.service.syncInstitutionUpserted(context(), payload());
    if (first.status !== 'applied') {
      throw new Error('Expected the first sync to apply.');
    }
    const relinkedId = '00000000-0000-4000-8000-000000000099';
    test.contacts.nextOrganizationContactId = relinkedId;

    await test.service.syncInstitutionUpserted(
      context(),
      payload({
        occurredAt: '2026-07-22T10:00:00.000Z',
        contactPoints: [
          {
            id: 'contact-1',
            contactType: 'email',
            contactValue: 'new-admissions@riverside.edu',
            personName: 'Sara Ahmed',
            role: 'Admissions Officer',
          },
        ],
      }),
    );

    const contactRef = test.externalReferences.store.get('lead_harvester|contact:contact-1');
    expect(contactRef?.entityId).toBe(relinkedId);
  });

  it('treats an out-of-order event as stale and applies nothing', async () => {
    const test = buildService();
    const first = await test.service.syncInstitutionUpserted(
      context(),
      payload({ occurredAt: '2026-07-25T10:00:00.000Z' }),
    );
    if (first.status !== 'applied') {
      throw new Error('Expected the first sync to apply.');
    }

    const stale = await test.service.syncInstitutionUpserted(
      context(),
      payload({ occurredAt: '2026-07-20T10:00:00.000Z' }),
    );

    expect(stale).toEqual({ status: 'stale', organizationId: first.organizationId });
    expect(test.organizations.updateCalls).toHaveLength(0);
    expect(test.addresses.createCalls).toHaveLength(1);
    expect(test.contacts.organizationCreateCalls).toHaveLength(1);
    expect(test.publisher.events).toHaveLength(1);
  });

  it('throws an integrity failure when a contact-person mapping is missing its link metadata', async () => {
    const test = buildService();
    const first = await test.service.syncInstitutionUpserted(context(), payload());
    if (first.status !== 'applied') {
      throw new Error('Expected the first sync to apply.');
    }
    const corrupted = test.externalReferences.store.get('lead_harvester|contact-person:contact-1');
    if (corrupted === undefined) {
      throw new Error('Expected the contact-person mapping to exist.');
    }
    corrupted.metadata = { membershipId: 'only-one-field' };

    await expect(
      test.service.syncInstitutionUpserted(
        context(),
        payload({ occurredAt: '2026-07-26T10:00:00.000Z' }),
      ),
    ).rejects.toMatchObject({ code: 'LEAD_HARVESTER_SYNC_INTEGRITY_FAILURE' });
  });
});
