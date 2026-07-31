export type LeadHarvesterSyncErrorCode =
  | 'LEAD_HARVESTER_SYNC_FORBIDDEN'
  | 'LEAD_HARVESTER_SYNC_INTEGRITY_FAILURE'
  | 'LEAD_HARVESTER_SYNC_INVALID_INPUT';

export class LeadHarvesterSyncModuleError extends Error {
  readonly code: LeadHarvesterSyncErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: LeadHarvesterSyncErrorCode,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = 'LeadHarvesterSyncModuleError';
    this.code = code;
    this.details = details;
  }
}
