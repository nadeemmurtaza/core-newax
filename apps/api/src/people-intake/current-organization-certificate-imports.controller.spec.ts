import { HEADERS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';

import { PEOPLE_INTAKE_PERMISSIONS } from '@newax/people-intake';

import {
  HTTP_CONTEXT_MODE_KEY,
  HTTP_REQUIRED_PERMISSIONS_KEY,
} from '../http-security/http-security.decorators';
import { CurrentOrganizationCertificateImportsController } from './current-organization-certificate-imports.controller';

const operations = [
  ['listEvidence', PEOPLE_INTAKE_PERMISSIONS.evidenceView],
  ['attachEvidence', PEOPLE_INTAKE_PERMISSIONS.evidenceAttach],
  ['createImport', PEOPLE_INTAKE_PERMISSIONS.certificateExtract],
  ['getImport', PEOPLE_INTAKE_PERMISSIONS.evidenceView],
  ['extract', PEOPLE_INTAKE_PERMISSIONS.certificateExtract],
  ['review', PEOPLE_INTAKE_PERMISSIONS.certificateReview],
  ['apply', PEOPLE_INTAKE_PERMISSIONS.certificateApply],
] as const;

describe('CurrentOrganizationCertificateImportsController metadata', () => {
  it.each(operations)(
    '%s requires Organization context and its dedicated permission',
    (name, permission) => {
      const handler = CurrentOrganizationCertificateImportsController.prototype[name];

      expect(Reflect.getMetadata(HTTP_CONTEXT_MODE_KEY, handler)).toBe('organization');
      expect(Reflect.getMetadata(HTTP_REQUIRED_PERMISSIONS_KEY, handler)).toEqual([permission]);
    },
  );

  it.each(operations)('%s prevents response caching', (name) => {
    const handler = CurrentOrganizationCertificateImportsController.prototype[name];
    const headers = Reflect.getMetadata(HEADERS_METADATA, handler) as readonly {
      readonly name: string;
      readonly value: string;
    }[];

    expect(headers).toContainEqual({ name: 'Cache-Control', value: 'no-store' });
  });
});
