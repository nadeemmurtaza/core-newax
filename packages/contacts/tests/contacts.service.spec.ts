import { describe, expect, it } from 'vitest';

import type { ContactsRepository } from '../src/database/contacts-repository';
import type { ContactEvent, ContactEventPublisher } from '../src/events/contact-event';
import { CONTACT_PERMISSIONS } from '../src/permissions/contact-permissions';
import { ContactsService } from '../src/services/contacts.service';
import type {
  ContactsRequestContext,
  CreateOrganizationContactRecordInput,
  CreateOrganizationContactResult,
  CreatePersonContactRecordInput,
  CreatePersonContactResult,
  ListOrganizationContactsRecordInput,
  ListOrganizationContactsResult,
  OrganizationContactRecord,
  PersonContactRecord,
  UpdateOrganizationContactRecordInput,
  UpdateOrganizationContactResult,
} from '../src/types/contact';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000002';
const CONTACT_ID = '00000000-0000-4000-8000-000000000003';
const CONTACT_METHOD_ID = '00000000-0000-4000-8000-000000000004';
const PERSON_ID = '00000000-0000-4000-8000-000000000005';
const PERSON_CONTACT_ID = '00000000-0000-4000-8000-000000000006';
const PERSON_CONTACT_METHOD_ID = '00000000-0000-4000-8000-000000000007';
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

function personRecord(overrides: Partial<PersonContactRecord> = {}): PersonContactRecord {
  return {
    id: PERSON_CONTACT_ID,
    personId: PERSON_ID,
    contactMethodId: PERSON_CONTACT_METHOD_ID,
    contactType: 'email',
    contactValue: 'hello@newax.co',
    normalizedValue: 'hello@newax.co',
    isVerified: false,
    verifiedAt: null,
    label: null,
    isPrimary: false,
    status: 'active',
    validFrom: null,
    validUntil: null,
    createdAt: NOW,
    ...overrides,
  };
}

class FakeContactsRepository implements ContactsRepository {
  createInput: CreateOrganizationContactRecordInput | null = null;
  updateInput: UpdateOrganizationContactRecordInput | null = null;
  listInput: ListOrganizationContactsRecordInput | null = null;
  createPersonInput: CreatePersonContactRecordInput | null = null;
  createResult: CreateOrganizationContactResult = { status: 'created', contact: record() };
  updateResult: UpdateOrganizationContactResult = {
    status: 'updated',
    contact: record(),
    relinked: false,
  };
  listResult: ListOrganizationContactsResult = {
    status: 'available',
    items: [record()],
    nextCursor: null,
  };
  createPersonResult: CreatePersonContactResult = {
    status: 'created',
    contact: personRecord(),
  };

  async createOrganizationContact(
    input: CreateOrganizationContactRecordInput,
  ): Promise<CreateOrganizationContactResult> {
    this.createInput = input;
    return this.createResult;
  }

  async updateOrganizationContact(
    input: UpdateOrganizationContactRecordInput,
  ): Promise<UpdateOrganizationContactResult> {
    this.updateInput = input;
    return this.updateResult;
  }

  async listOrganizationContacts(
    input: ListOrganizationContactsRecordInput,
  ): Promise<ListOrganizationContactsResult> {
    this.listInput = input;
    return this.listResult;
  }

  async createPersonContact(
    input: CreatePersonContactRecordInput,
  ): Promise<CreatePersonContactResult> {
    this.createPersonInput = input;
    return this.createPersonResult;
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

describe('ContactsService whatsapp and telegram contact types', () => {
  it('normalizes a whatsapp value the same way as phone', async () => {
    const repository = new FakeContactsRepository();
    repository.createResult = {
      status: 'created',
      contact: record({
        contactType: 'whatsapp',
        contactValue: '+923709861100',
        normalizedValue: '+923709861100',
      }),
    };
    const service = new ContactsService(repository, new RecordingContactEventPublisher());

    await service.addCurrentOrganizationContact(context(CONTACT_PERMISSIONS.create), {
      contactType: 'whatsapp',
      contactValue: '+92 (370) 986-1100',
    });

    expect(repository.createInput).toMatchObject({
      contactType: 'whatsapp',
      contactValue: '+923709861100',
      normalizedValue: '+923709861100',
    });
  });

  it('normalizes a telegram handle by stripping the leading @ and lowercasing it', async () => {
    const repository = new FakeContactsRepository();
    repository.createResult = {
      status: 'created',
      contact: record({
        contactType: 'telegram',
        contactValue: 'newax_sales',
        normalizedValue: 'newax_sales',
      }),
    };
    const service = new ContactsService(repository, new RecordingContactEventPublisher());

    await service.addCurrentOrganizationContact(context(CONTACT_PERMISSIONS.create), {
      contactType: 'telegram',
      contactValue: '@NEWAX_Sales',
    });

    expect(repository.createInput).toMatchObject({
      contactType: 'telegram',
      contactValue: 'newax_sales',
      normalizedValue: 'newax_sales',
    });
  });

  it.each([
    { contactType: 'whatsapp' as const, contactValue: '03709861100' },
    { contactType: 'telegram' as const, contactValue: 'ab' },
    { contactType: 'telegram' as const, contactValue: '1notaletterstart' },
  ])('rejects invalid whatsapp and telegram values', async (input) => {
    const service = new ContactsService(
      new FakeContactsRepository(),
      new RecordingContactEventPublisher(),
    );

    await expect(
      service.addCurrentOrganizationContact(context(CONTACT_PERMISSIONS.create), input),
    ).rejects.toMatchObject({ code: 'CONTACT_INVALID_INPUT' });
  });
});

describe('ContactsService updateCurrentOrganizationContact', () => {
  it('requires explicit update permission', async () => {
    const service = new ContactsService(
      new FakeContactsRepository(),
      new RecordingContactEventPublisher(),
    );

    await expect(
      service.updateCurrentOrganizationContact(context(), {
        contactId: CONTACT_ID,
        contactType: 'email',
        contactValue: 'new@newax.co',
      }),
    ).rejects.toMatchObject({ code: 'CONTACT_FORBIDDEN' });
  });

  it('passes normalized fields through to the repository', async () => {
    const repository = new FakeContactsRepository();
    const service = new ContactsService(repository, new RecordingContactEventPublisher());

    await service.updateCurrentOrganizationContact(context(CONTACT_PERMISSIONS.update), {
      contactId: CONTACT_ID,
      contactType: 'email',
      contactValue: ' New@NEWAX.co ',
      label: ' Sales ',
      isPrimary: true,
    });

    expect(repository.updateInput).toEqual({
      organizationId: ORGANIZATION_ID,
      contactId: CONTACT_ID,
      contactType: 'email',
      contactValue: 'new@newax.co',
      normalizedValue: 'new@newax.co',
      label: 'Sales',
      isPrimary: true,
      validFrom: null,
      validUntil: null,
    });
  });

  it('publishes an update event carrying the relink flag', async () => {
    const repository = new FakeContactsRepository();
    repository.updateResult = {
      status: 'updated',
      contact: record({
        id: '00000000-0000-4000-8000-000000000099',
        contactType: 'phone',
        contactValue: '+923001234567',
        normalizedValue: '+923001234567',
      }),
      relinked: true,
    };
    const publisher = new RecordingContactEventPublisher();
    const service = new ContactsService(repository, publisher);

    const contact = await service.updateCurrentOrganizationContact(
      context(CONTACT_PERMISSIONS.update),
      {
        contactId: CONTACT_ID,
        contactType: 'phone',
        contactValue: '+923001234567',
      },
    );

    expect(contact.id).toBe('00000000-0000-4000-8000-000000000099');
    expect(publisher.events).toEqual([
      {
        name: 'contact.updated',
        actorUserId: USER_ID,
        organizationId: ORGANIZATION_ID,
        contactId: '00000000-0000-4000-8000-000000000099',
        contactMethodId: CONTACT_METHOD_ID,
        contactType: 'phone',
        relinked: true,
        occurredAt: expect.any(Date),
      },
    ]);
  });

  it('maps a missing contact to a not-found error', async () => {
    const repository = new FakeContactsRepository();
    repository.updateResult = { status: 'contact_unavailable' };
    const service = new ContactsService(repository, new RecordingContactEventPublisher());

    await expect(
      service.updateCurrentOrganizationContact(context(CONTACT_PERMISSIONS.update), {
        contactId: CONTACT_ID,
        contactType: 'email',
        contactValue: 'new@newax.co',
      }),
    ).rejects.toMatchObject({ code: 'CONTACT_NOT_FOUND' });
  });

  it('maps a relink collision to a conflict', async () => {
    const repository = new FakeContactsRepository();
    repository.updateResult = { status: 'conflict' };
    const service = new ContactsService(repository, new RecordingContactEventPublisher());

    await expect(
      service.updateCurrentOrganizationContact(context(CONTACT_PERMISSIONS.update), {
        contactId: CONTACT_ID,
        contactType: 'email',
        contactValue: 'new@newax.co',
      }),
    ).rejects.toMatchObject({ code: 'CONTACT_CONFLICT' });
  });

  it('fails closed when the current organization is unavailable', async () => {
    const repository = new FakeContactsRepository();
    repository.updateResult = { status: 'organization_unavailable' };
    const service = new ContactsService(repository, new RecordingContactEventPublisher());

    await expect(
      service.updateCurrentOrganizationContact(context(CONTACT_PERMISSIONS.update), {
        contactId: CONTACT_ID,
        contactType: 'email',
        contactValue: 'new@newax.co',
      }),
    ).rejects.toMatchObject({ code: 'CONTACT_ORGANIZATION_UNAVAILABLE' });
  });
});

describe('ContactsService addCurrentPersonContact', () => {
  it('requires explicit create permission', async () => {
    const service = new ContactsService(
      new FakeContactsRepository(),
      new RecordingContactEventPublisher(),
    );

    await expect(
      service.addCurrentPersonContact(context(), {
        personId: PERSON_ID,
        contactType: 'email',
        contactValue: 'hello@newax.co',
      }),
    ).rejects.toMatchObject({ code: 'CONTACT_FORBIDDEN' });
  });

  it('normalizes input and publishes an identifier-only event', async () => {
    const repository = new FakeContactsRepository();
    repository.createPersonResult = {
      status: 'created',
      contact: personRecord({
        contactType: 'whatsapp',
        contactValue: '+923709861100',
        normalizedValue: '+923709861100',
      }),
    };
    const publisher = new RecordingContactEventPublisher();
    const service = new ContactsService(repository, publisher);

    const contact = await service.addCurrentPersonContact(context(CONTACT_PERMISSIONS.create), {
      personId: PERSON_ID,
      contactType: 'whatsapp',
      contactValue: '+92 (370) 986-1100',
    });

    expect(repository.createPersonInput).toMatchObject({
      personId: PERSON_ID,
      contactType: 'whatsapp',
      contactValue: '+923709861100',
      normalizedValue: '+923709861100',
    });
    expect(contact.personId).toBe(PERSON_ID);
    expect(Object.isFrozen(contact)).toBe(true);
    expect(publisher.events).toEqual([
      {
        name: 'person_contact.created',
        actorUserId: USER_ID,
        personId: PERSON_ID,
        contactId: PERSON_CONTACT_ID,
        contactMethodId: PERSON_CONTACT_METHOD_ID,
        contactType: 'whatsapp',
        occurredAt: expect.any(Date),
      },
    ]);
  });

  it('maps duplicate assignments to a conflict', async () => {
    const repository = new FakeContactsRepository();
    repository.createPersonResult = { status: 'conflict' };
    const service = new ContactsService(repository, new RecordingContactEventPublisher());

    await expect(
      service.addCurrentPersonContact(context(CONTACT_PERMISSIONS.create), {
        personId: PERSON_ID,
        contactType: 'email',
        contactValue: 'hello@newax.co',
      }),
    ).rejects.toMatchObject({ code: 'CONTACT_CONFLICT' });
  });

  it('fails closed when the person is unavailable', async () => {
    const repository = new FakeContactsRepository();
    repository.createPersonResult = { status: 'person_unavailable' };
    const service = new ContactsService(repository, new RecordingContactEventPublisher());

    await expect(
      service.addCurrentPersonContact(context(CONTACT_PERMISSIONS.create), {
        personId: PERSON_ID,
        contactType: 'email',
        contactValue: 'hello@newax.co',
      }),
    ).rejects.toMatchObject({ code: 'CONTACT_PERSON_UNAVAILABLE' });
  });

  it('rejects a repository result from another person', async () => {
    const repository = new FakeContactsRepository();
    repository.createPersonResult = {
      status: 'created',
      contact: personRecord({ personId: '00000000-0000-4000-8000-000000000099' }),
    };
    const service = new ContactsService(repository, new RecordingContactEventPublisher());

    await expect(
      service.addCurrentPersonContact(context(CONTACT_PERMISSIONS.create), {
        personId: PERSON_ID,
        contactType: 'email',
        contactValue: 'hello@newax.co',
      }),
    ).rejects.toMatchObject({ code: 'CONTACT_INTEGRITY_FAILURE' });
  });
});
