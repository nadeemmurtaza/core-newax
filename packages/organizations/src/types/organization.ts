export type OrganizationStatus = 'active' | 'suspended' | 'archived';

export interface OrganizationRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly parentOrganizationId: string | null;
  readonly legalName: string;
  readonly displayName: string;
  readonly organizationType: string;
  readonly registrationNumber: string | null;
  readonly taxNumber: string | null;
  readonly status: OrganizationStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

export interface OrganizationRequestContext {
  readonly actorUserId: string;
  readonly tenantId: string;
  readonly permissionCodes: ReadonlySet<string>;
}

export interface CurrentOrganizationRequestContext extends OrganizationRequestContext {
  readonly organizationId: string;
}

export interface CurrentOrganizationProfile {
  readonly id: string;
  readonly tenantId: string;
  readonly legalName: string;
  readonly displayName: string;
  readonly organizationType: string;
  readonly status: 'active';
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateOrganizationInput {
  readonly parentOrganizationId?: string | null;
  readonly legalName: string;
  readonly displayName: string;
  readonly organizationType: string;
  readonly registrationNumber?: string | null;
  readonly taxNumber?: string | null;
}

export interface UpdateOrganizationInput {
  readonly parentOrganizationId?: string | null;
  readonly legalName?: string;
  readonly displayName?: string;
  readonly organizationType?: string;
  readonly registrationNumber?: string | null;
  readonly taxNumber?: string | null;
}

export interface OrganizationListQuery {
  readonly parentOrganizationId?: string | null;
  readonly status?: OrganizationStatus;
  readonly search?: string;
  readonly limit?: number;
  readonly afterId?: string;
}

export interface OrganizationPage {
  readonly items: readonly OrganizationRecord[];
  readonly nextCursor: string | null;
}

export interface CreateOrganizationRecordInput {
  readonly tenantId: string;
  readonly parentOrganizationId: string | null;
  readonly legalName: string;
  readonly displayName: string;
  readonly organizationType: string;
  readonly registrationNumber: string | null;
  readonly taxNumber: string | null;
}

export interface UpdateOrganizationRecordInput {
  readonly parentOrganizationId?: string | null;
  readonly legalName?: string;
  readonly displayName?: string;
  readonly organizationType?: string;
  readonly registrationNumber?: string | null;
  readonly taxNumber?: string | null;
}
