export type AuditOutcome = 'allowed' | 'denied' | 'failed' | 'success';
export type AuditSensitivity = 'security' | 'sensitive' | 'standard';

export type AuditJsonPrimitive = boolean | null | number | string;
export type AuditJsonValue = AuditJsonObject | AuditJsonPrimitive | readonly AuditJsonValue[];

export interface AuditJsonObject {
  readonly [key: string]: AuditJsonValue;
}

export interface AuditEntry {
  readonly id: string;
  readonly tenantId: string | null;
  readonly organizationId: string | null;
  readonly actorUserId: string | null;
  readonly moduleCode: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly outcome: AuditOutcome;
  readonly sensitivity: AuditSensitivity;
  readonly requestId: string | null;
  readonly createdAt: Date;
}

export interface TrustedAuditEntryInput {
  readonly tenantId?: string | null;
  readonly organizationId?: string | null;
  readonly actorUserId?: string | null;
  readonly moduleCode: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId?: string | null;
  readonly outcome?: AuditOutcome;
  readonly sensitivity?: AuditSensitivity;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly correlationId?: string | null;
  readonly requestId?: string | null;
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
  readonly occurredAt: Date;
}

export interface OrganizationAuditRequestContext {
  readonly actorUserId: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly permissionCodes: ReadonlySet<string>;
}

export interface OrganizationAuditListQuery {
  readonly limit?: number;
  readonly afterId?: string;
}

export interface OrganizationAuditPage {
  readonly items: readonly AuditEntry[];
  readonly nextCursor: string | null;
}

export interface RecordTrustedAuditEntryRecordInput {
  readonly tenantId: string | null;
  readonly organizationId: string | null;
  readonly actorUserId: string | null;
  readonly moduleCode: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly outcome: AuditOutcome;
  readonly sensitivity: AuditSensitivity;
  readonly metadata: AuditJsonObject;
  readonly correlationId: string | null;
  readonly requestId: string | null;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly occurredAt: Date;
}

export type RecordTrustedAuditEntryResult =
  | { readonly status: 'actor_unavailable' }
  | { readonly status: 'created'; readonly entry: AuditEntry }
  | { readonly status: 'scope_unavailable' };

export interface ListOrganizationAuditEntriesRecordInput {
  readonly tenantId: string;
  readonly organizationId: string;
  readonly limit: number;
  readonly afterId?: string;
}

export type ListOrganizationAuditEntriesResult =
  | { readonly status: 'cursor_invalid' }
  | {
      readonly status: 'available';
      readonly items: readonly AuditEntry[];
      readonly nextCursor: string | null;
    }
  | { readonly status: 'scope_unavailable' };
