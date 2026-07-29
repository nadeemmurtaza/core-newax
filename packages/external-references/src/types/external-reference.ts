export interface ExternalReferenceRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly domainCode: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly externalSystem: string;
  readonly externalKey: string;
  readonly metadata: Record<string, unknown> | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface OrganizationExternalReferenceRequestContext {
  readonly actorUserId: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly permissionCodes: ReadonlySet<string>;
}

// For lookups that must resolve BEFORE an organizationId is known -- e.g.
// "does this external institution already map to some organization in our
// tenant" the first time a source system's record is seen.
export interface TenantExternalReferenceRequestContext {
  readonly actorUserId: string;
  readonly tenantId: string;
  readonly permissionCodes: ReadonlySet<string>;
}

export interface RegisterOrganizationExternalReferenceInput {
  readonly domainCode: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly externalSystem: string;
  readonly externalKey: string;
  readonly metadata?: Record<string, unknown> | null;
}

export interface OrganizationExternalReferenceListQuery {
  readonly limit?: number;
  readonly afterId?: string;
}

export interface OrganizationExternalReferencePage {
  readonly items: readonly ExternalReferenceRecord[];
  readonly nextCursor: string | null;
}

export interface RegisterOrganizationExternalReferenceRecordInput {
  readonly actorUserId: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly domainCode: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly externalSystem: string;
  readonly externalKey: string;
  readonly metadata: Record<string, unknown> | null;
}

export type RegisterOrganizationExternalReferenceResult =
  | { readonly status: 'created'; readonly externalReference: ExternalReferenceRecord }
  | { readonly status: 'conflict' }
  | { readonly status: 'actor_unavailable' }
  | { readonly status: 'organization_unavailable' };

export interface ListOrganizationExternalReferencesRecordInput {
  readonly tenantId: string;
  readonly organizationId: string;
  readonly limit: number;
  readonly afterId?: string;
}

export type ListOrganizationExternalReferencesResult =
  | {
      readonly status: 'available';
      readonly items: readonly ExternalReferenceRecord[];
      readonly nextCursor: string | null;
    }
  | { readonly status: 'cursor_invalid' }
  | { readonly status: 'organization_unavailable' };

export interface FindByExternalKeyInput {
  readonly externalSystem: string;
  readonly externalKey: string;
}

export interface FindOrganizationExternalReferenceByKeyRecordInput {
  readonly tenantId: string;
  readonly organizationId: string;
  readonly externalSystem: string;
  readonly externalKey: string;
}

export type FindOrganizationExternalReferenceByKeyResult =
  | { readonly status: 'found'; readonly externalReference: ExternalReferenceRecord }
  | { readonly status: 'not_found' }
  | { readonly status: 'organization_unavailable' };

export interface FindTenantExternalReferenceByKeyRecordInput {
  readonly tenantId: string;
  readonly externalSystem: string;
  readonly externalKey: string;
}

export type FindTenantExternalReferenceByKeyResult =
  | { readonly status: 'found'; readonly externalReference: ExternalReferenceRecord }
  | { readonly status: 'not_found' };
