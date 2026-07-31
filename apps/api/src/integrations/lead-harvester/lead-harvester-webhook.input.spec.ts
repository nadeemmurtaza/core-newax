import { describe, expect, it } from 'vitest';

import { parseLeadHarvesterInstitutionUpsertedPayload } from './lead-harvester-webhook.input';

function validBody(overrides: Record<string, unknown> = {}): unknown {
  return {
    schemaVersion: 1,
    eventId: '00000000-0000-4000-8000-000000000099',
    eventType: 'institution.upserted',
    occurredAt: '2026-07-20T10:00:00.000Z',
    institution: {
      id: 'institution-1',
      canonicalName: 'Riverside School',
      institutionType: 'school',
      domain: 'riverside.edu',
      website: null,
      status: 'qualified',
    },
    branches: [
      {
        id: 'branch-1',
        branchName: 'Main Campus',
        address: '12 River Road',
        city: 'Islamabad',
        countryCode: 'PK',
        stateRegion: null,
        postalCode: null,
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
    ],
    ...overrides,
  };
}

describe('parseLeadHarvesterInstitutionUpsertedPayload', () => {
  it('parses a fully-populated valid payload', () => {
    const parsed = parseLeadHarvesterInstitutionUpsertedPayload(validBody());

    expect(parsed).toEqual({
      schemaVersion: 1,
      eventId: '00000000-0000-4000-8000-000000000099',
      eventType: 'institution.upserted',
      occurredAt: '2026-07-20T10:00:00.000Z',
      institution: {
        id: 'institution-1',
        canonicalName: 'Riverside School',
        institutionType: 'school',
        domain: 'riverside.edu',
        website: null,
        status: 'qualified',
      },
      branches: [
        {
          id: 'branch-1',
          branchName: 'Main Campus',
          address: '12 River Road',
          city: 'Islamabad',
          countryCode: 'PK',
          stateRegion: null,
          postalCode: null,
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
      ],
    });
  });

  it('accepts a minimal payload with no branches or contacts and optional fields omitted', () => {
    const parsed = parseLeadHarvesterInstitutionUpsertedPayload(
      validBody({
        branches: [],
        contactPoints: [{ id: 'contact-1', contactType: 'email', contactValue: 'a@b.co' }],
      }),
    );

    expect(parsed.branches).toEqual([]);
    expect(parsed.contactPoints).toEqual([
      { id: 'contact-1', contactType: 'email', contactValue: 'a@b.co' },
    ]);
  });

  it('rejects a non-object body', async () => {
    expect(() => parseLeadHarvesterInstitutionUpsertedPayload('nope')).toThrowError(
      expect.objectContaining({ code: 'HTTP_SECURITY_INVALID_INPUT' }),
    );
    expect(() => parseLeadHarvesterInstitutionUpsertedPayload(null)).toThrow();
    expect(() => parseLeadHarvesterInstitutionUpsertedPayload([])).toThrow();
  });

  it('rejects an unsupported top-level field', () => {
    expect(() =>
      parseLeadHarvesterInstitutionUpsertedPayload(validBody({ extra: 'field' })),
    ).toThrowError(expect.objectContaining({ code: 'HTTP_SECURITY_INVALID_INPUT' }));
  });

  it('rejects a non-1 schemaVersion type', () => {
    expect(() =>
      parseLeadHarvesterInstitutionUpsertedPayload(validBody({ schemaVersion: '1' })),
    ).toThrow();
  });

  it('rejects an eventType other than institution.upserted', () => {
    expect(() =>
      parseLeadHarvesterInstitutionUpsertedPayload(validBody({ eventType: 'institution.deleted' })),
    ).toThrow();
  });

  it('rejects a blank institution.id', () => {
    expect(() =>
      parseLeadHarvesterInstitutionUpsertedPayload(
        validBody({
          institution: { ...(validBody() as { institution: object }).institution, id: '  ' },
        }),
      ),
    ).toThrow();
  });

  it('rejects an unsupported field inside a branch', () => {
    expect(() =>
      parseLeadHarvesterInstitutionUpsertedPayload(
        validBody({
          branches: [
            {
              id: 'branch-1',
              branchName: null,
              address: '12 River Road',
              city: 'Islamabad',
              countryCode: 'PK',
              extra: 'nope',
            },
          ],
        }),
      ),
    ).toThrow();
  });

  it('rejects branches that is not an array', () => {
    expect(() =>
      parseLeadHarvesterInstitutionUpsertedPayload(validBody({ branches: {} })),
    ).toThrow();
  });
});
