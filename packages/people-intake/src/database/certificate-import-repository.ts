import type {
  ApplyCertificateImportRecordInput,
  AttachEvidenceRecordInput,
  AttachEvidenceRecordResult,
  CertificateImportIdentityInput,
  CertificateImportRecord,
  ChangeCertificateImportResult,
  CreateCertificateImportRecordResult,
  EvidenceFileSummary,
  EvidenceScopeInput,
  ExtractCertificateImportRecordInput,
  ReviewCertificateImportRecordInput,
} from '../types/certificate-import';

export interface CertificateImportRepository {
  attachEvidence(input: AttachEvidenceRecordInput): Promise<AttachEvidenceRecordResult>;
  listEvidence(input: EvidenceScopeInput): Promise<readonly EvidenceFileSummary[]>;
  createImport(
    input: EvidenceScopeInput & { readonly evidenceId: string },
  ): Promise<CreateCertificateImportRecordResult>;
  findImport(input: CertificateImportIdentityInput): Promise<CertificateImportRecord | null>;
  recordExtraction(
    input: ExtractCertificateImportRecordInput,
  ): Promise<ChangeCertificateImportResult>;
  reviewImport(input: ReviewCertificateImportRecordInput): Promise<ChangeCertificateImportResult>;
  applyImport(input: ApplyCertificateImportRecordInput): Promise<ChangeCertificateImportResult>;
}
