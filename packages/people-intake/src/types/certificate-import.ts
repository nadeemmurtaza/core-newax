import type {
  PeopleIntakePayload,
  PeopleIntakePayloadInput,
  PeopleIntakeRequestContext,
} from './people-intake';

export type CertificateImportStatus = 'pending' | 'extracted' | 'accepted' | 'rejected';
export type CertificateImportReviewDecision = 'accepted' | 'rejected';

export interface EvidenceFileSummary {
  readonly id: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly intakeId: string;
  readonly fileId: string;
  readonly documentType: string;
  readonly evidenceRole: string;
  readonly attachedByUserId: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly fileSize: bigint;
  readonly createdAt: Date;
  readonly certificateImportId: string | null;
  readonly certificateImportStatus: CertificateImportStatus | null;
}

export interface CertificateImportRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly evidenceId: string;
  readonly intakeId: string;
  readonly status: CertificateImportStatus;
  readonly extractionPayload: PeopleIntakePayload | null;
  readonly extractorCode: string | null;
  readonly extractionVersion: string | null;
  readonly confidenceBps: number | null;
  readonly extractedByUserId: string | null;
  readonly extractedAt: Date | null;
  readonly reviewedByUserId: string | null;
  readonly reviewedAt: Date | null;
  readonly reviewDecision: CertificateImportReviewDecision | null;
  readonly reviewNotes: string | null;
  readonly appliedByUserId: string | null;
  readonly appliedAt: Date | null;
  readonly version: number;
  readonly intakeVersion: number;
  readonly intakeStatus: string;
  readonly intakeCreatedByUserId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AttachEvidenceInput {
  readonly fileId: string;
  readonly documentType: string;
  readonly evidenceRole?: string;
}

export interface RecordCertificateExtractionInput {
  readonly expectedVersion: number;
  readonly extractorCode: string;
  readonly extractionVersion: string;
  readonly confidenceBps: number;
  readonly payload: PeopleIntakePayloadInput;
}

export interface ReviewCertificateImportInput {
  readonly expectedVersion: number;
  readonly decision: CertificateImportReviewDecision;
  readonly notes?: string | null;
}

export interface ApplyCertificateImportInput {
  readonly expectedImportVersion: number;
  readonly expectedIntakeVersion: number;
}

export interface EvidenceScopeInput {
  readonly tenantId: string;
  readonly organizationId: string;
  readonly intakeId: string;
}

export interface AttachEvidenceRecordInput extends EvidenceScopeInput {
  readonly fileId: string;
  readonly documentType: string;
  readonly evidenceRole: string;
  readonly actorUserId: string;
}

export type AttachEvidenceRecordResult =
  | { readonly status: 'attached'; readonly evidence: EvidenceFileSummary }
  | { readonly status: 'intake_not_found' | 'file_not_found' | 'state_conflict' | 'conflict' };

export type CreateCertificateImportRecordResult =
  | { readonly status: 'created'; readonly importRecord: CertificateImportRecord }
  | { readonly status: 'not_found' | 'conflict' };

export interface CertificateImportIdentityInput {
  readonly tenantId: string;
  readonly organizationId: string;
  readonly importId: string;
}

export interface ExtractCertificateImportRecordInput extends CertificateImportIdentityInput {
  readonly actorUserId: string;
  readonly expectedVersion: number;
  readonly extractorCode: string;
  readonly extractionVersion: string;
  readonly confidenceBps: number;
  readonly payload: PeopleIntakePayload;
  readonly extractedAt: Date;
}

export interface ReviewCertificateImportRecordInput extends CertificateImportIdentityInput {
  readonly reviewerUserId: string;
  readonly expectedVersion: number;
  readonly decision: CertificateImportReviewDecision;
  readonly notes: string | null;
  readonly reviewedAt: Date;
}

export interface ApplyCertificateImportRecordInput extends CertificateImportIdentityInput {
  readonly actorUserId: string;
  readonly expectedImportVersion: number;
  readonly expectedIntakeVersion: number;
  readonly appliedAt: Date;
}

export type ChangeCertificateImportResult =
  | { readonly status: 'changed'; readonly importRecord: CertificateImportRecord }
  | {
      readonly status:
        'not_found' | 'version_conflict' | 'state_conflict' | 'self_review' | 'creator_mismatch';
    };

export type CertificateEvidenceRequestContext = PeopleIntakeRequestContext;
