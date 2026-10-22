import { describe, expect, it } from 'vitest';

import type { CertificateImportRepository } from '../database/certificate-import-repository';
import { PEOPLE_INTAKE_PERMISSIONS } from '../permissions/people-intake-permissions';
import type { CertificateImportRecord, EvidenceFileSummary } from '../types/certificate-import';
import type { PeopleIntakeRequestContext } from '../types/people-intake';
import { CertificateImportService } from './certificate-import.service';

const actor = '11111111-1111-4111-8111-111111111111';
const reviewer = '22222222-2222-4222-8222-222222222222';
const tenant = '33333333-3333-4333-8333-333333333333';
const organization = '44444444-4444-4444-8444-444444444444';
const intake = '55555555-5555-4555-8555-555555555555';
const evidenceId = '66666666-6666-4666-8666-666666666666';
const importId = '77777777-7777-4777-8777-777777777777';
const fileId = '88888888-8888-4888-8888-888888888888';

function context(user: string, ...permissions: string[]): PeopleIntakeRequestContext {
  return {
    actorUserId: user,
    tenantId: tenant,
    organizationId: organization,
    permissionCodes: new Set(permissions),
  };
}

const payload = {
  schemaVersion: 1 as const,
  people: [{ clientKey: 'child', firstName: 'Sara', lastName: 'Khan' }],
  relationships: [],
};

function evidence(): EvidenceFileSummary {
  return {
    id: evidenceId,
    tenantId: tenant,
    organizationId: organization,
    intakeId: intake,
    fileId,
    documentType: 'birth_certificate',
    evidenceRole: 'primary',
    attachedByUserId: actor,
    fileName: 'certificate.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024n,
    createdAt: new Date(),
    certificateImportId: null,
    certificateImportStatus: null,
  };
}

function importRecord(overrides: Partial<CertificateImportRecord> = {}): CertificateImportRecord {
  const now = new Date();
  return {
    id: importId,
    tenantId: tenant,
    organizationId: organization,
    evidenceId,
    intakeId: intake,
    status: 'pending',
    extractionPayload: null,
    extractorCode: null,
    extractionVersion: null,
    confidenceBps: null,
    extractedByUserId: null,
    extractedAt: null,
    reviewedByUserId: null,
    reviewedAt: null,
    reviewDecision: null,
    reviewNotes: null,
    appliedByUserId: null,
    appliedAt: null,
    version: 1,
    intakeVersion: 1,
    intakeStatus: 'draft',
    intakeCreatedByUserId: actor,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function repository(): CertificateImportRepository {
  let current = importRecord();
  return {
    async attachEvidence() {
      return { status: 'attached', evidence: evidence() };
    },
    async listEvidence() {
      return [evidence()];
    },
    async createImport() {
      return { status: 'created', importRecord: current };
    },
    async findImport() {
      return current;
    },
    async recordExtraction(input) {
      current = importRecord({
        status: 'extracted',
        extractionPayload: input.payload,
        extractorCode: input.extractorCode,
        extractionVersion: input.extractionVersion,
        confidenceBps: input.confidenceBps,
        extractedByUserId: input.actorUserId,
        extractedAt: input.extractedAt,
        version: 2,
      });
      return { status: 'changed', importRecord: current };
    },
    async reviewImport(input) {
      if (current.extractedByUserId === input.reviewerUserId) {
        return { status: 'self_review' };
      }
      current = importRecord({
        ...current,
        status: input.decision,
        reviewedByUserId: input.reviewerUserId,
        reviewedAt: input.reviewedAt,
        reviewDecision: input.decision,
        reviewNotes: input.notes,
        version: current.version + 1,
      });
      return { status: 'changed', importRecord: current };
    },
    async applyImport(input) {
      current = importRecord({
        ...current,
        appliedByUserId: input.actorUserId,
        appliedAt: input.appliedAt,
        version: current.version + 1,
        intakeVersion: current.intakeVersion + 1,
      });
      return { status: 'changed', importRecord: current };
    },
  };
}

describe('CertificateImportService', () => {
  it('attaches eligible evidence through a dedicated permission', async () => {
    const service = new CertificateImportService(repository());
    const result = await service.attachEvidence(
      context(actor, PEOPLE_INTAKE_PERMISSIONS.evidenceAttach),
      intake,
      { fileId, documentType: 'BIRTH_CERTIFICATE' },
    );
    expect(result.documentType).toBe('birth_certificate');
  });

  it('normalizes and stages structured extraction', async () => {
    const service = new CertificateImportService(repository());
    const result = await service.recordExtraction(
      context(actor, PEOPLE_INTAKE_PERMISSIONS.certificateExtract),
      importId,
      {
        expectedVersion: 1,
        extractorCode: 'MANUAL',
        extractionVersion: '1.0',
        confidenceBps: 9000,
        payload,
      },
    );
    expect(result.status).toBe('extracted');
    expect(result.extractionPayload?.people[0]?.firstName).toBe('Sara');
  });

  it('prevents the extraction actor from reviewing the same import', async () => {
    const service = new CertificateImportService(repository());
    await service.recordExtraction(
      context(actor, PEOPLE_INTAKE_PERMISSIONS.certificateExtract),
      importId,
      {
        expectedVersion: 1,
        extractorCode: 'manual',
        extractionVersion: '1',
        confidenceBps: 8000,
        payload,
      },
    );
    await expect(
      service.reviewImport(context(actor, PEOPLE_INTAKE_PERMISSIONS.certificateReview), importId, {
        expectedVersion: 2,
        decision: 'accepted',
      }),
    ).rejects.toMatchObject({ code: 'PEOPLE_INTAKE_FORBIDDEN' });
  });

  it('accepts independent review and explicit application', async () => {
    const service = new CertificateImportService(repository());
    const extracted = await service.recordExtraction(
      context(actor, PEOPLE_INTAKE_PERMISSIONS.certificateExtract),
      importId,
      {
        expectedVersion: 1,
        extractorCode: 'manual',
        extractionVersion: '1',
        confidenceBps: 8000,
        payload,
      },
    );
    const accepted = await service.reviewImport(
      context(reviewer, PEOPLE_INTAKE_PERMISSIONS.certificateReview),
      importId,
      { expectedVersion: extracted.version, decision: 'accepted' },
    );
    const applied = await service.applyImport(
      context(actor, PEOPLE_INTAKE_PERMISSIONS.certificateApply),
      importId,
      { expectedImportVersion: accepted.version, expectedIntakeVersion: accepted.intakeVersion },
    );
    expect(applied.appliedByUserId).toBe(actor);
  });
});
