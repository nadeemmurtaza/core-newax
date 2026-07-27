import type {
  ListOrganizationAuditEntriesRecordInput,
  ListOrganizationAuditEntriesResult,
  RecordTrustedAuditEntryRecordInput,
  RecordTrustedAuditEntryResult,
} from '../types/audit';

export interface AuditRepository {
  recordTrustedEntry(
    input: RecordTrustedAuditEntryRecordInput,
  ): Promise<RecordTrustedAuditEntryResult>;

  listOrganizationEntries(
    input: ListOrganizationAuditEntriesRecordInput,
  ): Promise<ListOrganizationAuditEntriesResult>;
}
