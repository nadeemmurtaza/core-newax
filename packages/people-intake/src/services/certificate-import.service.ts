import type { CertificateImportRepository } from '../database/certificate-import-repository';
import { PeopleIntakeModuleError } from '../errors/people-intake-module-error';
import {
  PEOPLE_INTAKE_PERMISSIONS,
  type PeopleIntakePermission,
} from '../permissions/people-intake-permissions';
import type {
  ApplyCertificateImportInput,
  AttachEvidenceInput,
  CertificateEvidenceRequestContext,
  CertificateImportRecord,
  CertificateImportReviewDecision,
  ChangeCertificateImportResult,
  EvidenceFileSummary,
  RecordCertificateExtractionInput,
  ReviewCertificateImportInput,
} from '../types/certificate-import';
import { PeopleIntakeValidator } from './people-intake-validator';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const CODE_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u;

export class CertificateImportService {
  private readonly validator = new PeopleIntakeValidator();

  constructor(private readonly repository: CertificateImportRepository) {}

  async attachEvidence(
    context: CertificateEvidenceRequestContext,
    intakeId: string,
    input: AttachEvidenceInput,
  ): Promise<EvidenceFileSummary> {
    const scope = this.scope(context, PEOPLE_INTAKE_PERMISSIONS.evidenceAttach);
    const result = await this.repository.attachEvidence({
      ...scope,
      intakeId: this.inputUuid(intakeId, 'intakeId'),
      fileId: this.inputUuid(input.fileId, 'fileId'),
      documentType: this.code(input.documentType, 'documentType', 64),
      evidenceRole: this.code(input.evidenceRole ?? 'primary', 'evidenceRole', 32),
      actorUserId: scope.actorUserId,
    });
    if (result.status === 'attached') {
      this.assertEvidence(result.evidence, scope);
      return result.evidence;
    }
    if (result.status === 'file_not_found') {
      throw new PeopleIntakeModuleError(
        'PEOPLE_INTAKE_NOT_FOUND',
        'The evidence file is unavailable in the current Organization.',
      );
    }
    if (result.status === 'intake_not_found') {
      throw new PeopleIntakeModuleError('PEOPLE_INTAKE_NOT_FOUND', 'The intake does not exist.');
    }
    if (result.status === 'state_conflict') {
      throw new PeopleIntakeModuleError(
        'PEOPLE_INTAKE_STATE_CONFLICT',
        'Evidence may only be attached to an editable draft.',
      );
    }
    throw new PeopleIntakeModuleError(
      'PEOPLE_INTAKE_CONFLICT',
      'The file is already attached to this intake.',
    );
  }

  async listEvidence(
    context: CertificateEvidenceRequestContext,
    intakeId: string,
  ): Promise<readonly EvidenceFileSummary[]> {
    const scope = this.scope(context, PEOPLE_INTAKE_PERMISSIONS.evidenceView);
    const items = await this.repository.listEvidence({
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      intakeId: this.inputUuid(intakeId, 'intakeId'),
    });
    for (const item of items) {
      this.assertEvidence(item, scope);
    }
    return items;
  }

  async createImport(
    context: CertificateEvidenceRequestContext,
    intakeId: string,
    evidenceId: string,
  ): Promise<CertificateImportRecord> {
    const scope = this.scope(context, PEOPLE_INTAKE_PERMISSIONS.certificateExtract);
    const result = await this.repository.createImport({
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      intakeId: this.inputUuid(intakeId, 'intakeId'),
      evidenceId: this.inputUuid(evidenceId, 'evidenceId'),
    });
    if (result.status === 'created') {
      return this.record(result.importRecord, scope);
    }
    if (result.status === 'not_found') {
      throw new PeopleIntakeModuleError('PEOPLE_INTAKE_NOT_FOUND', 'The evidence does not exist.');
    }
    throw new PeopleIntakeModuleError(
      'PEOPLE_INTAKE_CONFLICT',
      'A certificate import already exists for this evidence.',
    );
  }

  async getImport(
    context: CertificateEvidenceRequestContext,
    importId: string,
  ): Promise<CertificateImportRecord> {
    const scope = this.scope(context, PEOPLE_INTAKE_PERMISSIONS.evidenceView);
    const record = await this.repository.findImport({
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      importId: this.inputUuid(importId, 'importId'),
    });
    if (record === null) {
      throw new PeopleIntakeModuleError(
        'PEOPLE_INTAKE_NOT_FOUND',
        'The certificate import does not exist.',
      );
    }
    return this.record(record, scope);
  }

  async recordExtraction(
    context: CertificateEvidenceRequestContext,
    importId: string,
    input: RecordCertificateExtractionInput,
  ): Promise<CertificateImportRecord> {
    const scope = this.scope(context, PEOPLE_INTAKE_PERMISSIONS.certificateExtract);
    const confidenceBps = input.confidenceBps;
    if (!Number.isInteger(confidenceBps) || confidenceBps < 0 || confidenceBps > 10_000) {
      this.invalid('confidenceBps', 'confidenceBps must be an integer from 0 to 10000.');
    }
    const result = await this.repository.recordExtraction({
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      importId: this.inputUuid(importId, 'importId'),
      actorUserId: scope.actorUserId,
      expectedVersion: this.version(input.expectedVersion),
      extractorCode: this.code(input.extractorCode, 'extractorCode', 64),
      extractionVersion: this.text(input.extractionVersion, 'extractionVersion', 64),
      confidenceBps,
      payload: this.validator.normalizePayload(input.payload),
      extractedAt: new Date(),
    });
    return this.changed(result, scope);
  }

  async reviewImport(
    context: CertificateEvidenceRequestContext,
    importId: string,
    input: ReviewCertificateImportInput,
  ): Promise<CertificateImportRecord> {
    const scope = this.scope(context, PEOPLE_INTAKE_PERMISSIONS.certificateReview);
    const decision = this.decision(input.decision);
    const notes = this.nullableText(input.notes, 'notes', 2_000);
    if (decision === 'rejected' && notes === null) {
      this.invalid('notes', 'A rejected extraction requires reviewer notes.');
    }
    const result = await this.repository.reviewImport({
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      importId: this.inputUuid(importId, 'importId'),
      reviewerUserId: scope.actorUserId,
      expectedVersion: this.version(input.expectedVersion),
      decision,
      notes,
      reviewedAt: new Date(),
    });
    return this.changed(result, scope);
  }

  async applyImport(
    context: CertificateEvidenceRequestContext,
    importId: string,
    input: ApplyCertificateImportInput,
  ): Promise<CertificateImportRecord> {
    const scope = this.scope(context, PEOPLE_INTAKE_PERMISSIONS.certificateApply);
    const result = await this.repository.applyImport({
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      importId: this.inputUuid(importId, 'importId'),
      actorUserId: scope.actorUserId,
      expectedImportVersion: this.version(input.expectedImportVersion),
      expectedIntakeVersion: this.version(input.expectedIntakeVersion),
      appliedAt: new Date(),
    });
    return this.changed(result, scope);
  }

  private changed(result: ChangeCertificateImportResult, scope: Scope): CertificateImportRecord {
    if (result.status === 'changed') {
      return this.record(result.importRecord, scope);
    }
    if (result.status === 'not_found') {
      throw new PeopleIntakeModuleError(
        'PEOPLE_INTAKE_NOT_FOUND',
        'The certificate import does not exist.',
      );
    }
    if (result.status === 'self_review') {
      throw new PeopleIntakeModuleError(
        'PEOPLE_INTAKE_FORBIDDEN',
        'The extraction actor cannot review the same certificate import.',
      );
    }
    if (result.status === 'creator_mismatch') {
      throw new PeopleIntakeModuleError(
        'PEOPLE_INTAKE_FORBIDDEN',
        'Only the intake creator can apply an accepted extraction to the draft.',
      );
    }
    if (result.status === 'version_conflict') {
      throw new PeopleIntakeModuleError(
        'PEOPLE_INTAKE_CONFLICT',
        'The import or intake changed after it was loaded. Reload before continuing.',
      );
    }
    throw new PeopleIntakeModuleError(
      'PEOPLE_INTAKE_STATE_CONFLICT',
      'The certificate import is not in the required workflow state.',
    );
  }

  private record(record: CertificateImportRecord, scope: Scope): CertificateImportRecord {
    if (record.tenantId !== scope.tenantId || record.organizationId !== scope.organizationId) {
      throw new PeopleIntakeModuleError(
        'PEOPLE_INTAKE_INTEGRITY_FAILURE',
        'The certificate import escaped its trusted Organization boundary.',
      );
    }
    this.version(record.version);
    return record;
  }

  private assertEvidence(item: EvidenceFileSummary, scope: Scope): void {
    if (item.tenantId !== scope.tenantId || item.organizationId !== scope.organizationId) {
      throw new PeopleIntakeModuleError(
        'PEOPLE_INTAKE_INTEGRITY_FAILURE',
        'The evidence record escaped its trusted Organization boundary.',
      );
    }
  }

  private scope(
    context: CertificateEvidenceRequestContext,
    permission: PeopleIntakePermission,
  ): Scope {
    if (!context.permissionCodes.has(permission)) {
      throw new PeopleIntakeModuleError(
        'PEOPLE_INTAKE_FORBIDDEN',
        `The operation requires the ${permission} permission.`,
        { permission },
      );
    }
    return {
      actorUserId: this.trustedUuid(context.actorUserId, 'context.actorUserId'),
      tenantId: this.trustedUuid(context.tenantId, 'context.tenantId'),
      organizationId: this.trustedUuid(context.organizationId, 'context.organizationId'),
    };
  }

  private inputUuid(value: string, field: string): string {
    if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
      this.invalid(field, `${field} must be a UUID.`);
    }
    return value.toLowerCase();
  }

  private trustedUuid(value: unknown, field: string): string {
    if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
      throw new PeopleIntakeModuleError(
        'PEOPLE_INTAKE_INTEGRITY_FAILURE',
        `${field} must be a UUID.`,
      );
    }
    return value.toLowerCase();
  }

  private version(value: number): number {
    if (!Number.isInteger(value) || value < 1) {
      this.invalid('expectedVersion', 'A version must be a positive integer.');
    }
    return value;
  }

  private decision(value: CertificateImportReviewDecision): CertificateImportReviewDecision {
    if (value !== 'accepted' && value !== 'rejected') {
      this.invalid('decision', 'decision must be accepted or rejected.');
    }
    return value;
  }

  private code(value: string, field: string, maximum: number): string {
    const normalized = this.text(value, field, maximum).toLowerCase();
    if (!CODE_PATTERN.test(normalized)) {
      this.invalid(field, `${field} must be a stable machine-readable code.`);
    }
    return normalized;
  }

  private text(value: string, field: string, maximum: number): string {
    if (typeof value !== 'string') {
      this.invalid(field, `${field} must be text.`);
    }
    const normalized = value.trim();
    if (normalized.length < 1 || normalized.length > maximum) {
      this.invalid(field, `${field} must contain between 1 and ${String(maximum)} characters.`);
    }
    return normalized;
  }

  private nullableText(
    value: string | null | undefined,
    field: string,
    maximum: number,
  ): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    return this.text(value, field, maximum);
  }

  private invalid(field: string, message: string): never {
    throw new PeopleIntakeModuleError('PEOPLE_INTAKE_INVALID_INPUT', message, { field });
  }
}

interface Scope {
  readonly actorUserId: string;
  readonly tenantId: string;
  readonly organizationId: string;
}
