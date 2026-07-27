import { describe, expect, it } from 'vitest';

import {
  parseCurrentOrganizationObjectBody,
  parseCurrentOrganizationObjectCreateQuery,
  parseCurrentOrganizationObjectsQuery,
} from './current-organization-objects.input';

describe('current organization objects HTTP input contracts', () => {
  it('rejects repeated and unsupported list query parameters', () => {
    expect(() => parseCurrentOrganizationObjectsQuery({ limit: ['10', '20'] })).toThrowError(
      /limit must be a single non-empty string/u,
    );

    expect(() => parseCurrentOrganizationObjectsQuery({ tenant_id: 'not-authority' })).toThrowError(
      /unsupported field/u,
    );
  });

  it('requires object identity fields without accepting client authority', () => {
    expect(() => parseCurrentOrganizationObjectBody({ name: 'MRI Scanner 1' })).toThrowError(
      /object_type_code/u,
    );

    expect(() =>
      parseCurrentOrganizationObjectBody({
        object_type_code: 'medical_device',
        name: 'MRI Scanner 1',
        organization_id: 'not-authority',
      }),
    ).toThrowError(/unsupported field/u);
  });

  it('preserves nullable relationship and descriptive fields for service validation', () => {
    expect(
      parseCurrentOrganizationObjectBody({
        object_type_code: ' medical_device ',
        parent_object_id: null,
        name: ' MRI Scanner 1 ',
        reference_code: ' mri-001 ',
        serial_number: null,
        description: ' Radiology asset ',
      }),
    ).toEqual({
      objectTypeCode: ' medical_device ',
      parentObjectId: null,
      name: ' MRI Scanner 1 ',
      referenceCode: ' mri-001 ',
      serialNumber: null,
      description: ' Radiology asset ',
    });
  });

  it('enforces an empty creation query contract', () => {
    expect(() => parseCurrentOrganizationObjectCreateQuery({})).not.toThrow();
    expect(() => parseCurrentOrganizationObjectCreateQuery({ object_id: 'x' })).toThrowError(
      /does not support parameters/u,
    );
  });
});
