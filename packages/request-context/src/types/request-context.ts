export type TrustedContextScope = 'account' | 'organization';
export type TrustedMembershipStatus = 'active' | 'suspended' | 'ended';
export type TrustedOrganizationStatus = 'active' | 'suspended' | 'archived';
export type TrustedTenantStatus = 'active' | 'suspended' | 'archived';

export interface TrustedSessionRecord {
  readonly userId: string;
  readonly personId: string;
  readonly sessionId: string;
  readonly expiresAt: Date;
}

export interface TrustedMembershipRecord {
  readonly id: string;
  readonly personId: string;
  readonly tenantId: string;
  readonly tenantStatus: TrustedTenantStatus;
  readonly organizationId: string;
  readonly membershipStatus: TrustedMembershipStatus;
  readonly organizationStatus: TrustedOrganizationStatus;
}

export interface TrustedPermissionEvaluation {
  readonly membershipId: string;
  readonly organizationId: string;
  readonly evaluatedAt: Date;
  readonly effectivePermissionCodes: readonly string[];
}

export interface ResolveAccountContextInput {
  readonly sessionToken: string;
  readonly requestId?: string;
}

export interface ResolveOrganizationContextInput extends ResolveAccountContextInput {
  readonly membershipId: string;
}

export interface TrustedAccountRequestContext {
  readonly scope: 'account';
  readonly requestId: string;
  readonly userId: string;
  readonly personId: string;
  readonly sessionId: string;
  readonly sessionExpiresAt: Date;
}

export interface TrustedOrganizationRequestContext {
  readonly scope: 'organization';
  readonly requestId: string;
  readonly userId: string;
  readonly personId: string;
  readonly sessionId: string;
  readonly sessionExpiresAt: Date;
  readonly membershipId: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly permissionCodes: ReadonlySet<string>;
  readonly evaluatedAt: Date;
}

export type TrustedRequestContext =
  TrustedAccountRequestContext | TrustedOrganizationRequestContext;

export interface ModuleRequestContext {
  readonly actorUserId: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly permissionCodes: ReadonlySet<string>;
}

export interface AccountMembershipDiscoveryQuery {
  readonly page?: number;
  readonly perPage?: number;
}

export interface AccountMembershipCandidate {
  readonly membershipId: string;
  readonly personId: string;
  readonly organizationId: string;
  readonly organizationDisplayName: string;
  readonly organizationType: string;
  readonly organizationStatus: TrustedOrganizationStatus;
  readonly membershipType: string;
  readonly membershipStatus: TrustedMembershipStatus;
  readonly jobTitle: string | null;
  readonly startDate: Date | null;
}

export interface AccountMembershipDirectoryPage {
  readonly items: readonly AccountMembershipCandidate[];
  readonly total: number;
}

export interface AccountMembershipOption {
  readonly membershipId: string;
  readonly organizationId: string;
  readonly organizationDisplayName: string;
  readonly organizationType: string;
  readonly membershipType: string;
  readonly jobTitle: string | null;
  readonly startDate: Date | null;
}

export interface AccountMembershipDiscoveryPage {
  readonly items: readonly AccountMembershipOption[];
  readonly page: number;
  readonly perPage: number;
  readonly total: number;
}

export interface OrganizationContextConfirmationRecord {
  readonly membershipId: string;
  readonly personId: string;
  readonly tenantId: string;
  readonly tenantStatus: TrustedTenantStatus;
  readonly organizationId: string;
  readonly organizationDisplayName: string;
  readonly organizationType: string;
  readonly organizationStatus: TrustedOrganizationStatus;
  readonly membershipType: string;
  readonly membershipStatus: TrustedMembershipStatus;
  readonly jobTitle: string | null;
}

export interface OrganizationContextCapabilitySummary {
  readonly organizationView: boolean;
  readonly organizationManage: boolean;
  readonly peopleView: boolean;
  readonly peopleManage: boolean;
  readonly membershipsView: boolean;
  readonly membershipsManage: boolean;
  readonly usersView: boolean;
  readonly usersManage: boolean;
  readonly accessControlView: boolean;
  readonly accessControlManage: boolean;
}

export interface OrganizationContextConfirmation {
  readonly membershipId: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly organizationDisplayName: string;
  readonly organizationType: string;
  readonly membershipType: string;
  readonly jobTitle: string | null;
  readonly sessionExpiresAt: Date;
  readonly permissionsEvaluatedAt: Date;
  readonly capabilities: OrganizationContextCapabilitySummary;
}
