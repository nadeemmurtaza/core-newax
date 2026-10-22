import { describe, expect, it } from 'vitest';

import {
  parseCurrentOrganizationAddressBody,
  parseCurrentOrganizationAddressCreateQuery,
  parseCurrentOrganizationAddressesQuery,
} from './current-organization-addresses.input';

describe('current organization addresses HTTP input contracts', () => {
  it('rejects repeated and unsupported list query parameters', () => {
    expect(() => parseCurrentOrganizationAddressesQuery({ limit: ['10', '20'] })).toThrowError(
      /limit must be a single non-empty string/u,
    );

    expect(() =>
      parseCurrentOrganizationAddressesQuery({ tenant_id: 'not-authority' }),
    ).toThrowError(/unsupported field/u);
  });

  it('requires the complete creation identity without accepting client authority', () => {
    expect(() =>
      parseCurrentOrganizationAddressBody({
        address_type: 'office',
        line_1: 'NEWAX Tower',
        city: 'Islamabad',
        country_code: 'PK',
      }),
    ).toThrowError(/is_primary/u);

    expect(() =>
      parseCurrentOrganizationAddressBody({
        address_type: 'office',
        is_primary: true,
        line_1: 'NEWAX Tower',
        city: 'Islamabad',
        country_code: 'PK',
        organization_id: 'not-authority',
      }),
    ).toThrowError(/unsupported field/u);
  });

  it('enforces an empty creation query contract', () => {
    expect(() => parseCurrentOrganizationAddressCreateQuery({})).not.toThrow();
    expect(() => parseCurrentOrganizationAddressCreateQuery({ address_id: 'x' })).toThrowError(
      /does not support parameters/u,
    );
  });
});
