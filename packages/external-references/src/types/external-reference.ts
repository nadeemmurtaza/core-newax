export interface ExternalReferenceRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly domainCode: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly externalSystem: string;
  readonly externalKey: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface OrganizationExternalReferenceRequestContext {
  readonly actorUserId: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly permissionCodes: ReadonlySet<string>;
}

export interface RegisterOrganizationExternalReferenceInput {
  readonly domainCode: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly externalSystem: string;
  readonly externalKey: string;
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
