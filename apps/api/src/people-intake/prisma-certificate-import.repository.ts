import { Inject, Injectable } from '@nestjs/common';
import type {
  ApplyCertificateImportRecordInput,
  AttachEvidenceRecordInput,
  AttachEvidenceRecordResult,
  CertificateImportIdentityInput,
  CertificateImportRecord,
  CertificateImportRepository,
  CertificateImportReviewDecision,
  CertificateImportStatus,
  ChangeCertificateImportResult,
  CreateCertificateImportRecordResult,
  EvidenceFileSummary,
  EvidenceScopeInput,
  ExtractCertificateImportRecordInput,
  PeopleIntakePayload,
  ReviewCertificateImportRecordInput,
} from '@newax/people-intake';

import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

type EvidenceWithFileAndImport = Prisma.CorePeopleIntakeEvidenceGetPayload<{
  include: { file: true; certificateImports: true };
}>;

type ImportWithEvidenceAndIntake = Prisma.CoreCertificateImportGetPayload<{
  include: { evidence: { include: { intake: true } } };
}>;

const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const MAX_EVIDENCE_SIZE = 25n * 1024n * 1024n;

@Injectable()
export class PrismaCertificateImportRepository implements CertificateImportRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async attachEvidence(input: AttachEvidenceRecordInput): Promise<AttachEvidenceRecordResult> {
    const [intake, file] = await Promise.all([
      this.prisma.corePeopleIntake.findFirst({
        where: {
          id: input.intakeId,
          tenantId: input.tenantId,
          organizationId: input.organizationId,
        },
        select: { status: true },
      }),
      this.prisma.coreFile.findFirst({
        where: {
          id: input.fileId,
          tenantId: input.tenantId,
          organizationId: input.organizationId,
          status: 'active',
        },
      }),
    ]);
    if (intake === null) {
      return { status: 'intake_not_found' };
    }
    if (
      file === null ||
      !ALLOWED_MIME_TYPES.has(file.mimeType) ||
      file.fileSize > MAX_EVIDENCE_SIZE
    ) {
      return { status: 'file_not_found' };
    }
    if (intake.status !== 'draft') {
      return { status: 'state_conflict' };
    }
    try {
      const evidence = await this.prisma.corePeopleIntakeEvidence.create({
        data: {
          tenantId: input.tenantId,
          organizationId: input.organizationId,
          intakeId: input.intakeId,
          fileId: input.fileId,
          documentType: input.documentType,
          evidenceRole: input.evidenceRole,
          attachedByUserId: input.actorUserId,
        },
        include: { file: true, certificateImports: { take: 1 } },
      });
      return { status: 'attached', evidence: this.evidence(evidence) };
    } catch (error: unknown) {
      return this.conflict(error) ? { status: 'conflict' } : Promise.reject(error);
    }
  }

  async listEvidence(input: EvidenceScopeInput): Promise<readonly EvidenceFileSummary[]> {
    const records = await this.prisma.corePeopleIntakeEvidence.findMany({
      where: {
        tenantId: input.tenantId,
        organizationId: input.organizationId,
        intakeId: input.intakeId,
      },
      include: { file: true, certificateImports: { take: 1 } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return records.map((record) => this.evidence(record));
  }

  async createImport(
    input: EvidenceScopeInput & { readonly evidenceId: string },
  ): Promise<CreateCertificateImportRecordResult> {
    const evidence = await this.prisma.corePeopleIntakeEvidence.findFirst({
      where: {
        id: input.evidenceId,
        tenantId: input.tenantId,
        organizationId: input.organizationId,
        intakeId: input.intakeId,
      },
    });
    if (evidence === null) {
      return { status: 'not_found' };
    }
    try {
      const record = await this.prisma.coreCertificateImport.create({
        data: {
          tenantId: input.tenantId,
          organizationId: input.organizationId,
          evidenceId: input.evidenceId,
        },
        include: { evidence: { include: { intake: true } } },
      });
      return { status: 'created', importRecord: this.importRecord(record) };
    } catch (error: unknown) {
      return this.conflict(error) ? { status: 'conflict' } : Promise.reject(error);
    }
  }

  async findImport(input: CertificateImportIdentityInput): Promise<CertificateImportRecord | null> {
    const record = await this.prisma.coreCertificateImport.findFirst({
      where: {
        id: input.importId,
        tenantId: input.tenantId,
        organizationId: input.organizationId,
      },
      include: { evidence: { include: { intake: true } } },
    });
    return record === null ? null : this.importRecord(record);
  }

  async recordExtraction(
    input: ExtractCertificateImportRecordInput,
  ): Promise<ChangeCertificateImportResult> {
    return this.change(
      input,
      {
        status: 'extracted',
        extractionPayload: input.payload,
        extractorCode: input.extractorCode,
        extractionVersion: input.extractionVersion,
        confidenceBps: input.confidenceBps,
        extractedByUserId: input.actorUserId,
        extractedAt: input.extractedAt,
      },
      'pending',
    );
  }

  async reviewImport(
    input: ReviewCertificateImportRecordInput,
  ): Promise<ChangeCertificateImportResult> {
    const existing = await this.prisma.coreCertificateImport.findFirst({
      where: {
        id: input.importId,
        tenantId: input.tenantId,
        organizationId: input.organizationId,
      },
      select: { extractedByUserId: true },
    });
    if (existing === null) {
      return { status: 'not_found' };
    }
    if (existing.extractedByUserId === input.reviewerUserId) {
      return { status: 'self_review' };
    }
    return this.change(
      input,
      {
        status: input.decision,
        reviewedByUserId: input.reviewerUserId,
        reviewedAt: input.reviewedAt,
        reviewDecision: input.decision,
        reviewNotes: input.notes,
      },
      'extracted',
    );
  }

  async applyImport(
    input: ApplyCertificateImportRecordInput,
  ): Promise<ChangeCertificateImportResult> {
    return this.prisma.$transaction(async (transaction) => {
      const record = await transaction.coreCertificateImport.findFirst({
        where: {
          id: input.importId,
          tenantId: input.tenantId,
          organizationId: input.organizationId,
        },
        include: { evidence: { include: { intake: true } } },
      });
      if (record === null) {
        return { status: 'not_found' as const };
      }
      if (
        record.version !== input.expectedImportVersion ||
        record.evidence.intake.version !== input.expectedIntakeVersion
      ) {
        return { status: 'version_conflict' as const };
      }
      if (
        record.status !== 'accepted' ||
        record.appliedAt !== null ||
        record.extractionPayload === null ||
        record.evidence.intake.status !== 'draft'
      ) {
        return { status: 'state_conflict' as const };
      }
      if (record.evidence.intake.createdByUserId !== input.actorUserId) {
        return { status: 'creator_mismatch' as const };
      }
      const payload = record.extractionPayload as unknown as PeopleIntakePayload;
      const intakeUpdate = await transaction.corePeopleIntake.updateMany({
        where: {
          id: record.evidence.intakeId,
          tenantId: input.tenantId,
          organizationId: input.organizationId,
          status: 'draft',
          version: input.expectedIntakeVersion,
          createdByUserId: input.actorUserId,
        },
        data: {
          payload: payload as unknown as Prisma.InputJsonValue,
          personCount: payload.people.length,
          relationshipCount: payload.relationships.length,
          version: { increment: 1 },
        },
      });
      if (intakeUpdate.count !== 1) {
        return { status: 'version_conflict' as const };
      }
      const importUpdate = await transaction.coreCertificateImport.updateMany({
        where: {
          id: input.importId,
          tenantId: input.tenantId,
          organizationId: input.organizationId,
          version: input.expectedImportVersion,
          status: 'accepted',
          appliedAt: null,
        },
        data: {
          appliedByUserId: input.actorUserId,
          appliedAt: input.appliedAt,
          version: { increment: 1 },
        },
      });
      if (importUpdate.count !== 1) {
        throw new Error('Certificate import apply lost its atomic state.');
      }
      const updated = await transaction.coreCertificateImport.findUniqueOrThrow({
        where: { id: input.importId },
        include: { evidence: { include: { intake: true } } },
      });
      return { status: 'changed' as const, importRecord: this.importRecord(updated) };
    });
  }

  private async change(
    input: CertificateImportIdentityInput & { readonly expectedVersion: number },
    data: Record<string, unknown>,
    requiredStatus: CertificateImportStatus,
  ): Promise<ChangeCertificateImportResult> {
    const updated = await this.prisma.coreCertificateImport.updateMany({
      where: {
        id: input.importId,
        tenantId: input.tenantId,
        organizationId: input.organizationId,
        version: input.expectedVersion,
        status: requiredStatus,
      },
      data: { ...data, version: { increment: 1 } },
    });
    if (updated.count === 0) {
      const existing = await this.prisma.coreCertificateImport.findFirst({
        where: {
          id: input.importId,
          tenantId: input.tenantId,
          organizationId: input.organizationId,
        },
        select: { version: true, status: true },
      });
      if (existing === null) {
        return { status: 'not_found' };
      }
      return existing.version !== input.expectedVersion
        ? { status: 'version_conflict' }
        : { status: 'state_conflict' };
    }
    const record = await this.prisma.coreCertificateImport.findUniqueOrThrow({
      where: { id: input.importId },
      include: { evidence: { include: { intake: true } } },
    });
    return { status: 'changed', importRecord: this.importRecord(record) };
  }

  private evidence(record: EvidenceWithFileAndImport): EvidenceFileSummary {
    const importRecord = record.certificateImports[0] ?? null;
    return {
      id: record.id,
      tenantId: record.tenantId,
      organizationId: record.organizationId,
      intakeId: record.intakeId,
      fileId: record.fileId,
      documentType: record.documentType,
      evidenceRole: record.evidenceRole,
      attachedByUserId: record.attachedByUserId,
      fileName: record.file.fileName,
      mimeType: record.file.mimeType,
      fileSize: record.file.fileSize,
      createdAt: record.createdAt,
      certificateImportId: importRecord?.id ?? null,
      certificateImportStatus: importRecord === null ? null : this.status(importRecord.status),
    };
  }

  private importRecord(record: ImportWithEvidenceAndIntake): CertificateImportRecord {
    return {
      id: record.id,
      tenantId: record.tenantId,
      organizationId: record.organizationId,
      evidenceId: record.evidenceId,
      intakeId: record.evidence.intakeId,
      status: this.status(record.status),
      extractionPayload: record.extractionPayload as PeopleIntakePayload | null,
      extractorCode: record.extractorCode,
      extractionVersion: record.extractionVersion,
      confidenceBps: record.confidenceBps,
      extractedByUserId: record.extractedByUserId,
      extractedAt: record.extractedAt,
      reviewedByUserId: record.reviewedByUserId,
      reviewedAt: record.reviewedAt,
      reviewDecision: record.reviewDecision as CertificateImportReviewDecision | null,
      reviewNotes: record.reviewNotes,
      appliedByUserId: record.appliedByUserId,
      appliedAt: record.appliedAt,
      version: record.version,
      intakeVersion: record.evidence.intake.version,
      intakeStatus: record.evidence.intake.status,
      intakeCreatedByUserId: record.evidence.intake.createdByUserId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private status(value: string): CertificateImportStatus {
    if (
      value === 'pending' ||
      value === 'extracted' ||
      value === 'accepted' ||
      value === 'rejected'
    ) {
      return value;
    }
    throw new Error(`Unsupported certificate import status: ${value}`);
  }

  private conflict(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
    );
  }
}
