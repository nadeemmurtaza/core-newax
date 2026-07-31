export interface LeadHarvesterSyncRequestContext {
  readonly actorUserId: string;
  readonly tenantId: string;
  readonly permissionCodes: ReadonlySet<string>;
}

export interface LeadHarvesterInstitutionPayload {
  readonly id: string;
  readonly canonicalName: string;
  readonly institutionType: string;
  readonly domain: string | null;
  readonly website: string | null;
  readonly status: string;
}

export interface LeadHarvesterBranchPayload {
  readonly id: string;
  readonly branchName: string | null;
  readonly address: string;
  readonly city: string;
  readonly countryCode: string;
  readonly stateRegion?: string | null;
  readonly postalCode?: string | null;
}

export interface LeadHarvesterContactPointPayload {
  readonly id: string;
  readonly contactType: string;
  readonly contactValue: string;
  readonly personName?: string | null;
  readonly role?: string | null;
}

export interface LeadHarvesterInstitutionUpsertedPayload {
  readonly schemaVersion: number;
  readonly eventId: string;
  readonly eventType: 'institution.upserted';
  readonly occurredAt: string;
  readonly institution: LeadHarvesterInstitutionPayload;
  readonly branches: readonly LeadHarvesterBranchPayload[];
  readonly contactPoints: readonly LeadHarvesterContactPointPayload[];
}

export type LeadHarvesterSyncSkipReason = 'unsupported_contact_type';

export interface LeadHarvesterSyncSkippedItem {
  readonly kind: 'contact_point';
  readonly id: string;
  readonly reason: LeadHarvesterSyncSkipReason;
}

export type LeadHarvesterSyncResult =
  | {
      readonly status: 'applied';
      readonly organizationId: string;
      readonly skipped: readonly LeadHarvesterSyncSkippedItem[];
    }
  | {
      readonly status: 'stale';
      readonly organizationId: string;
    };
