import { describe, expect, it } from 'vitest';

import {
  parseCurrentOrganizationContactBody,
  parseCurrentOrganizationContactCreateQuery,
  parseCurrentOrganizationContactsQuery,
} from './current-organization-contacts.input';

function expectInvalid(operation: () => unknown): void {
  try {
    operation();
    throw new Error('Expected input parsing to fail.');
  } catch (error: unknown) {
    expect(error).toMatchObject({
      code: 'HTTP_SECURITY_INVALID_INPUT',
      statusCode: 400,
    });
  }
}

describe('current organization contacts HTTP input', () => {
  it('accepts only an empty contact creation query', () => {
    expect(parseCurrentOrganizationContactCreateQuery({})).toBeUndefined();
  });

  it.each([
    { organization_id: '00000000-0000-4000-8000-000000000001' },
    { tenant_id: '00000000-0000-4000-8000-000000000002' },
    { limit: '1' },
    null,
    [],
  ])('rejects a contact creation query parameter: %o', (query) => {
    expectInvalid(() => parseCurrentOrganizationContactCreateQuery(query));
  });

  it('parses a bounded contact creation body', () => {
    expect(
      parseCurrentOrganizationContactBody({
        contact_type: 'email',
        contact_value: 'Operations@NEWAX.CO',
        label: 'Operations',
        is_primary: true,
        valid_from: '2026-07-12',
        valid_until: null,
      }),
    ).toEqual({
      contactType: 'email',
      contactValue: 'Operations@NEWAX.CO',
      label: 'Operations',
      isPrimary: true,
      validFrom: new Date('2026-07-12T00:00:00.000Z'),
      validUntil: null,
    });
  });

  it.each([
    { organization_id: '00000000-0000-4000-8000-000000000001' },
    { contact_method_id: '00000000-0000-4000-8000-000000000002' },
    { normalized_value: 'operations@newax.co' },
    { is_verified: true },
    { permission_codes: ['contacts.create'] },
  ])('rejects client authority and internal contact fields: %o', (field) => {
    expectInvalid(() =>
      parseCurrentOrganizationContactBody({
        contact_type: 'email',
        contact_value: 'operations@newax.co',
        ...field,
      }),
    );
  });

  it.each([
    null,
    [],
    {},
    { contact_type: 'fax', contact_value: '123' },
    { contact_type: 'email', contact_value: 123 },
    { contact_type: 'email', contact_value: 'a@b.test', is_primary: 'true' },
    { contact_type: 'email', contact_value: 'a@b.test', valid_from: '2026-02-30' },
    { contact_type: 'phone', contact_value: '+923001234567', label: [] },
  ])('rejects an invalid creation body: %o', (body) => {
    expectInvalid(() => parseCurrentOrganizationContactBody(body));
  });

  it('parses the allowed pagination query', () => {
    expect(
      parseCurrentOrganizationContactsQuery({
        limit: '25',
        after_id: '00000000-0000-4000-8000-000000000009',
      }),
    ).toEqual({
      limit: 25,
      afterId: '00000000-0000-4000-8000-000000000009',
    });
    expect(parseCurrentOrganizationContactsQuery({})).toEqual({});
  });

  it.each([
    { organization_id: '00000000-0000-4000-8000-000000000001' },
    { include: 'people' },
    { limit: ['10', '20'] },
    { limit: '0' },
    { limit: '101' },
    { limit: '1.5' },
    { after_id: [] },
    null,
    [],
  ])('rejects an invalid list query: %o', (query) => {
    expectInvalid(() => parseCurrentOrganizationContactsQuery(query));
  });
});
