export type TenantStatus = 'active' | 'suspended' | 'archived';

export interface TenantRecord {
  readonly id: string;
  readonly name: string;
  readonly status: TenantStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

export interface TenantRequestContext {
  readonly actorUserId: string;
  readonly permissionCodes: ReadonlySet<string>;
}

export interface CreateTenantInput {
  readonly name: string;
}

export interface CreateTenantRecordInput {
  readonly name: string;
}

export interface TenantListQuery {
  readonly status?: TenantStatus;
  readonly search?: string;
  readonly limit?: number;
  readonly afterId?: string;
}

export interface TenantPage {
  readonly items: readonly TenantRecord[];
  readonly nextCursor: string | null;
}
