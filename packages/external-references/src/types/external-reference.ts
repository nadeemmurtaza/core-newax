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

// Repoints an existing mapping's entityId (and optionally its metadata) at a
// new underlying record. This is NOT a "relink instead of mutate" violation:
// unlike CoreAddress/CoreContactMethod, a CoreExternalReference row is not a
// shared/deduped canonical value referenced by multiple owners -- it is
// already a private 1:1 mapping scoped to one tenant/organization/external
// key, so updating it in place is safe. This exists because relink-not-mutate
// updates on the underlying entity (e.g. a contact method whose value
// changed) mint a new row id, and the external reference that named the old
// id must follow it.
export interface UpdateOrganizationExternalReferenceEntityInput {
  readonly externalSystem: string;
  readonly externalKey: string;
  readonly entityId: string;
  readonly metadata?: Record<string, unknown> | null;
}

export interface UpdateOrganizationExternalReferenceEntityRecordInput {
  readonly tenantId: string;
  readonly organizationId: string;
  readonly externalSystem: string;
  readonly externalKey: string;
  readonly entityId: string;
  readonly metadata?: Record<string, unknown> | null;
}

export type UpdateOrganizationExternalReferenceEntityResult =
  | { readonly status: 'updated'; readonly externalReference: ExternalReferenceRecord }
  | { readonly status: 'not_found' }
  | { readonly status: 'organization_unavailable' };
