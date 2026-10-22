export interface ObjectTypeRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly category: string | null;
  readonly description: string | null;
  readonly createdAt: Date;
}

export interface ObjectRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly owningOrganizationId: string;
  readonly objectTypeId: string;
  readonly objectTypeCode: string;
  readonly parentObjectId: string | null;
  readonly name: string;
  readonly referenceCode: string | null;
  readonly serialNumber: string | null;
  readonly description: string | null;
  readonly createdAt: Date;
}

export interface PlatformObjectRequestContext {
  readonly actorUserId: string;
  readonly permissionCodes: ReadonlySet<string>;
}

export interface OrganizationObjectRequestContext {
  readonly actorUserId: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly permissionCodes: ReadonlySet<string>;
}

export interface RegisterObjectTypeInput {
  readonly code: string;
  readonly name: string;
  readonly category?: string | null;
  readonly description?: string | null;
}

export interface CreateOrganizationObjectInput {
  readonly objectTypeCode: string;
  readonly parentObjectId?: string | null;
  readonly name: string;
  readonly referenceCode?: string | null;
  readonly serialNumber?: string | null;
  readonly description?: string | null;
}

export interface OrganizationObjectListQuery {
  readonly objectTypeCode?: string;
  readonly limit?: number;
  readonly afterId?: string;
}

export interface OrganizationObjectPage {
  readonly items: readonly ObjectRecord[];
  readonly nextCursor: string | null;
}

export interface RegisterObjectTypeRecordInput {
  readonly code: string;
  readonly name: string;
  readonly category: string | null;
  readonly description: string | null;
}

export type RegisterObjectTypeResult =
  | {
      readonly status: 'created';
      readonly objectType: ObjectTypeRecord;
    }
  | {
      readonly status: 'conflict';
    };

export interface CreateOrganizationObjectRecordInput {
  readonly tenantId: string;
  readonly organizationId: string;
  readonly objectTypeCode: string;
  readonly parentObjectId: string | null;
  readonly name: string;
  readonly referenceCode: string | null;
  readonly serialNumber: string | null;
  readonly description: string | null;
}

export type CreateOrganizationObjectResult =
  | {
      readonly status: 'created';
      readonly object: ObjectRecord;
    }
  | {
      readonly status: 'conflict';
    }
  | {
      readonly status: 'object_type_unavailable';
    }
  | {
      readonly status: 'organization_unavailable';
    }
  | {
      readonly status: 'parent_unavailable';
    };

export interface ListOrganizationObjectsRecordInput {
  readonly tenantId: string;
  readonly organizationId: string;
  readonly objectTypeCode?: string;
  readonly limit: number;
  readonly afterId?: string;
}

export type ListOrganizationObjectsResult =
  | {
      readonly status: 'available';
      readonly items: readonly ObjectRecord[];
      readonly nextCursor: string | null;
    }
  | {
      readonly status: 'cursor_invalid';
    }
  | {
      readonly status: 'organization_unavailable';
    };
