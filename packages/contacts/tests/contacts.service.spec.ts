import { describe, expect, it } from 'vitest';

import type { ContactsRepository } from '../src/database/contacts-repository';
import type { ContactEvent, ContactEventPublisher } from '../src/events/contact-event';
import { CONTACT_PERMISSIONS } from '../src/permissions/contact-permissions';
import { ContactsService } from '../src/services/contacts.service';
import type {
  ContactsRequestContext,
  CreateOrganizationContactRecordInput,
  CreateOrganizationContactResult,
  ListOrganizationContactsRecordInput,
  ListOrganizationContactsResult,
  OrganizationContactRecord,
} from '../src/types/contact';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000002';
const CONTACT_ID = '00000000-0000-4000-8000-000000000003';
const CONTACT_METHOD_ID = '00000000-0000-4000-8000-000000000004';
const NOW = new Date('2026-07-12T00:00:00.000Z');

function record(overrides: Partial<OrganizationContactRecord> = {}): OrganizationContactRecord {
  return {
    id: CONTACT_ID,
    organizationId: ORGANIZATION_ID,
    contactMethodId: CONTACT_METHOD_ID,
    contactType: 'email',
    contactValue: 'hello@newax.co',
    normalizedValue: 'hello@newax.co',
    isVerified: false,
    verifiedAt: null,
    label: 'General',
    isPrimary: true,
    status: 'active',
    validFrom: null,
    validUntil: null,
    createdAt: NOW,
    ...overrides,
  };
}

class FakeContactsRepository implements ContactsRepository {
  createInput: CreateOrganizationContactRecordInput | null = null;
  listInput: ListOrganizationContactsRecordInput | null = null;
  createResult: CreateOrganizationContactResult = { status: 'created', contact: record() };
  listResult: ListOrganizationContactsResult = {
    status: 'available',
    items: [record()],
    nextCursor: null,
  };

  async createOrganizationContact(
    input: CreateOrganizationContactRecordInput,
  ): Promise<CreateOrganizationContactResult> {
    this.createInput = input;
    return this.createResult;
  }

  async listOrganizationContacts(
    input: ListOrganizationContactsRecordInput,
  ): Promise<ListOrganizationContactsResult> {
    this.listInput = input;
    return this.listResult;
  }
}

class RecordingContactEventPublisher implements ContactEventPublisher {
  readonly events: ContactEvent[] = [];

  async publish(event: ContactEvent): Promise<void> {
    this.events.push(event);
  }
}

function context(...permissions: string[]): ContactsRequestContext {
  return {
    actorUserId: USER_ID,
    organizationId: ORGANIZATION_ID,
    permissionCodes: new Set(permissions),
  };
}

describe('ContactsService organization contact foundation', () => {
  it('normalizes an email and publishes an identifier-only event', async () => {
    const repository = new FakeContactsRepository();
    const publisher = new RecordingContactEventPublisher();
    const service = new ContactsService(repository, publisher);

    const contact = await service.addCurrentOrganizationContact(
      context(CONTACT_PERMISSIONS.create),
      {
        contactType: 'email',
        contactValue: ' Hello@NEWAX.co ',
        label: ' General ',
        isPrimary: true,
      },
    );

    expect(repository.createInput).toEqual({
      organizationId: ORGANIZATION_ID,
      contactType: 'email',
      contactValue: 'hello@newax.co',
      normalizedValue: 'hello@newax.co',
      label: 'General',
      isPrimary: true,
      validFrom: null,
      validUntil: null,
    });
    expect(contact.contactValue).toBe('hello@newax.co');
    expect(Object.isFrozen(contact)).toBe(true);
    expect(publisher.events).toEqual([
      {
        name: 'contact.created',
        actorUserId: USER_ID,
        organizationId: ORGANIZATION_ID,
        contactId: CONTACT_ID,
        contactMethodId: CONTACT_METHOD_ID,
        contactType: 'email',
        occurredAt: expect.any(Date),
      },
    ]);
    expect(publisher.events[0]).not.toHaveProperty('contactValue');
    expect(publisher.events[0]).not.toHaveProperty('normalizedValue');
  });

  it('normalizes an international phone value to E.164', async () => {
    const repository = new FakeContactsRepository();
    repository.createResult = {
      status: 'created',
      contact: record({
        contactType: 'phone',
        contactValue: '+923709861100',
        normalizedValue: '+923709861100',
      }),
    };
    const service = new ContactsService(repository, new RecordingContactEventPublisher());

    await service.addCurrentOrganizationContact(context(CONTACT_PERMISSIONS.create), {
      contactType: 'phone',
      contactValue: '+92 (370) 986-1100',
    });

    expect(repository.createInput).toMatchObject({
      contactValue: '+923709861100',
      normalizedValue: '+923709861100',
    });
  });

  it('requires explicit create permission', async () => {
    const service = new ContactsService(
      new FakeContactsRepository(),
      new RecordingContactEventPublisher(),
    );

    await expect(
      service.addCurrentOrganizationContact(context(), {
        contactType: 'email',
        contactValue: 'hello@newax.co',
      }),
    ).rejects.toMatchObject({ code: 'CONTACT_FORBIDDEN' });
  });

  it.each([
    { contactType: 'email' as const, contactValue: 'not-an-email' },
    { contactType: 'phone' as const, contactValue: '03709861100' },
  ])('rejects invalid contact values', async (input) => {
    const service = new ContactsService(
      new FakeContactsRepository(),
      new RecordingContactEventPublisher(),
    );

    await expect(
      service.addCurrentOrganizationContact(context(CONTACT_PERMISSIONS.create), input),
    ).rejects.toMatchObject({ code: 'CONTACT_INVALID_INPUT' });
  });

  it('rejects invalid validity ranges before persistence access', async () => {
    const repository = new FakeContactsRepository();
    const service = new ContactsService(repository, new RecordingContactEventPublisher());

    await expect(
      service.addCurrentOrganizationContact(context(CONTACT_PERMISSIONS.create), {
        contactType: 'email',
        contactValue: 'hello@newax.co',
        validFrom: new Date('2026-08-01T10:00:00.000Z'),
        validUntil: new Date('2026-07-01T10:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'CONTACT_INVALID_INPUT' });
    expect(repository.createInput).toBeNull();
  });

  it('maps duplicate assignments to a conflict without exposing the value', async () => {
    const repository = new FakeContactsRepository();
    repository.createResult = { status: 'conflict' };
    const service = new ContactsService(repository, new RecordingContactEventPublisher());

    await expect(
      service.addCurrentOrganizationContact(context(CONTACT_PERMISSIONS.create), {
        contactType: 'email',
        contactValue: 'private@example.com',
      }),
    ).rejects.toMatchObject({
      code: 'CONTACT_CONFLICT',
      details: { contactType: 'email' },
    });
  });

  it('fails closed when the current organization is unavailable', async () => {
    const repository = new FakeContactsRepository();
    repository.createResult = { status: 'organization_unavailable' };
    const service = new ContactsService(repository, new RecordingContactEventPublisher());

    await expect(
      service.addCurrentOrganizationContact(context(CONTACT_PERMISSIONS.create), {
        contactType: 'email',
        contactValue: 'hello@newax.co',
      }),
    ).rejects.toMatchObject({ code: 'CONTACT_ORGANIZATION_UNAVAILABLE' });
  });

  it('requires explicit view permission', async () => {
    const repository = new FakeContactsRepository();
    const service = new ContactsService(repository, new RecordingContactEventPublisher());

    await expect(service.listCurrentOrganizationContacts(context())).rejects.toMatchObject({
      code: 'CONTACT_FORBIDDEN',
    });
    expect(repository.listInput).toBeNull();
  });

  it('rejects malformed trusted organization context before persistence access', async () => {
    const repository = new FakeContactsRepository();
    const service = new ContactsService(repository, new RecordingContactEventPublisher());

    await expect(
      service.listCurrentOrganizationContacts({
        actorUserId: USER_ID,
        organizationId: 'not-a-uuid',
        permissionCodes: new Set([CONTACT_PERMISSIONS.view]),
      }),
    ).rejects.toMatchObject({ code: 'CONTACT_INTEGRITY_FAILURE' });
    expect(repository.listInput).toBeNull();
  });

  it('rejects a cursor outside the current organization boundary', async () => {
    const repository = new FakeContactsRepository();
    repository.listResult = { status: 'cursor_invalid' };
    const service = new ContactsService(repository, new RecordingContactEventPublisher());

    await expect(
      service.listCurrentOrganizationContacts(context(CONTACT_PERMISSIONS.view), {
        afterId: CONTACT_ID,
      }),
    ).rejects.toMatchObject({
      code: 'CONTACT_INVALID_INPUT',
      details: { field: 'afterId' },
    });
  });

  it('lists only records returned inside the trusted organization boundary', async () => {
    const repository = new FakeContactsRepository();
    const service = new ContactsService(repository, new RecordingContactEventPublisher());

    const page = await service.listCurrentOrganizationContacts(context(CONTACT_PERMISSIONS.view), {
      limit: 25,
    });

    expect(repository.listInput).toEqual({ organizationId: ORGANIZATION_ID, limit: 25 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).not.toHaveProperty('normalizedValue');
    expect(Object.isFrozen(page)).toBe(true);
    expect(Object.isFrozen(page.items)).toBe(true);
  });

  it('rejects a repository result from another organization', async () => {
    const repository = new FakeContactsRepository();
    repository.listResult = {
      status: 'available',
      items: [record({ organizationId: '00000000-0000-4000-8000-000000000099' })],
      nextCursor: null,
    };
    const service = new ContactsService(repository, new RecordingContactEventPublisher());

    await expect(
      service.listCurrentOrganizationContacts(context(CONTACT_PERMISSIONS.view)),
    ).rejects.toMatchObject({ code: 'CONTACT_INTEGRITY_FAILURE' });
  });

  it('rejects malformed repository normalization metadata', async () => {
    const repository = new FakeContactsRepository();
    repository.listResult = {
      status: 'available',
      items: [record({ normalizedValue: 'different@example.com' })],
      nextCursor: null,
    };
    const service = new ContactsService(repository, new RecordingContactEventPublisher());

    await expect(
      service.listCurrentOrganizationContacts(context(CONTACT_PERMISSIONS.view)),
    ).rejects.toMatchObject({ code: 'CONTACT_INTEGRITY_FAILURE' });
  });

  it('rejects global verification metadata at the organization contact boundary', async () => {
    const repository = new FakeContactsRepository();
    repository.listResult = {
      status: 'available',
      items: [
        record({
          isVerified: true,
          verifiedAt: new Date('2026-07-12T10:00:00.000Z'),
        }),
      ],
      nextCursor: null,
    };
    const service = new ContactsService(repository, new RecordingContactEventPublisher());

    await expect(
      service.listCurrentOrganizationContacts(context(CONTACT_PERMISSIONS.view)),
    ).rejects.toMatchObject({ code: 'CONTACT_INTEGRITY_FAILURE' });
  });

  it('classifies malformed stored contact types as repository integrity failures', async () => {
    const repository = new FakeContactsRepository();
    repository.listResult = {
      status: 'available',
      items: [record({ contactType: 'fax' as 'email' })],
      nextCursor: null,
    };
    const service = new ContactsService(repository, new RecordingContactEventPublisher());

    await expect(
      service.listCurrentOrganizationContacts(context(CONTACT_PERMISSIONS.view)),
    ).rejects.toMatchObject({ code: 'CONTACT_INTEGRITY_FAILURE' });
  });

  it.each([0, 101, 1.5])('rejects invalid page limits', async (limit) => {
    const service = new ContactsService(
      new FakeContactsRepository(),
      new RecordingContactEventPublisher(),
    );

    await expect(
      service.listCurrentOrganizationContacts(context(CONTACT_PERMISSIONS.view), { limit }),
    ).rejects.toMatchObject({ code: 'CONTACT_INVALID_INPUT' });
  });
});
