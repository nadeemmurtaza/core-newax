export type ContactType = 'email' | 'phone';
export type OrganizationContactStatus = 'active' | 'removed';

export interface ContactsRequestContext {
  readonly actorUserId: string;
  readonly organizationId: string;
  readonly permissionCodes: ReadonlySet<string>;
}

export interface AddOrganizationContactInput {
  readonly contactType: ContactType;
  readonly contactValue: string;
  readonly label?: string | null;
  readonly isPrimary?: boolean;
  readonly validFrom?: Date | null;
  readonly validUntil?: Date | null;
}

export interface OrganizationContactListQuery {
  readonly limit?: number;
  readonly afterId?: string;
}

export interface OrganizationContact {
  readonly id: string;
  readonly organizationId: string;
  readonly contactMethodId: string;
  readonly contactType: ContactType;
  readonly contactValue: string;
  readonly isVerified: boolean;
  readonly verifiedAt: Date | null;
  readonly label: string | null;
  readonly isPrimary: boolean;
  readonly status: 'active';
  readonly validFrom: Date | null;
  readonly validUntil: Date | null;
  readonly createdAt: Date;
}

export interface OrganizationContactPage {
  readonly items: readonly OrganizationContact[];
  readonly nextCursor: string | null;
}

export interface OrganizationContactRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly contactMethodId: string;
  readonly contactType: ContactType;
  readonly contactValue: string;
  readonly normalizedValue: string;
  readonly isVerified: boolean;
  readonly verifiedAt: Date | null;
  readonly label: string | null;
  readonly isPrimary: boolean;
  readonly status: OrganizationContactStatus;
  readonly validFrom: Date | null;
  readonly validUntil: Date | null;
  readonly createdAt: Date;
}

export interface CreateOrganizationContactRecordInput {
  readonly organizationId: string;
  readonly contactType: ContactType;
  readonly contactValue: string;
  readonly normalizedValue: string;
  readonly label: string | null;
  readonly isPrimary: boolean;
  readonly validFrom: Date | null;
  readonly validUntil: Date | null;
}

export type CreateOrganizationContactResult =
  | {
      readonly status: 'created';
      readonly contact: OrganizationContactRecord;
    }
  | {
      readonly status: 'conflict';
    }
  | {
      readonly status: 'organization_unavailable';
    };

export interface ListOrganizationContactsRecordInput {
  readonly organizationId: string;
  readonly limit: number;
  readonly afterId?: string;
}

export type ListOrganizationContactsResult =
  | {
      readonly status: 'available';
      readonly items: readonly OrganizationContactRecord[];
      readonly nextCursor: string | null;
    }
  | {
      readonly status: 'cursor_invalid';
    }
  | {
      readonly status: 'organization_unavailable';
    };
