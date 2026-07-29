export type ContactType = 'email' | 'phone' | 'whatsapp' | 'telegram';
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

// Full-replacement update: the caller always supplies the complete desired
// contact state (mirrors AddOrganizationContactInput's ergonomics) rather than
// a partial patch merged with prior values. When contactValue/contactType
// resolve to a different canonical CoreContactMethod than the one contactId
// currently links to, this relinks to the new (or newly created) shared
// contact method and retires the old join row -- it never mutates a shared
// contact method's own value in place, since other organizations or people
// may reference the same row.
export interface UpdateOrganizationContactInput {
  readonly contactId: string;
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

export interface UpdateOrganizationContactRecordInput {
  readonly organizationId: string;
  readonly contactId: string;
  readonly contactType: ContactType;
  readonly contactValue: string;
  readonly normalizedValue: string;
  readonly label: string | null;
  readonly isPrimary: boolean;
  readonly validFrom: Date | null;
  readonly validUntil: Date | null;
}

export type UpdateOrganizationContactResult =
  | {
      readonly status: 'updated';
      readonly contact: OrganizationContactRecord;
      readonly relinked: boolean;
    }
  | {
      readonly status: 'conflict';
    }
  | {
      readonly status: 'organization_unavailable';
    }
  | {
      readonly status: 'contact_unavailable';
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

export interface AddPersonContactInput {
  readonly personId: string;
  readonly contactType: ContactType;
  readonly contactValue: string;
  readonly label?: string | null;
  readonly isPrimary?: boolean;
  readonly validFrom?: Date | null;
  readonly validUntil?: Date | null;
}

export interface PersonContact {
  readonly id: string;
  readonly personId: string;
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

export interface PersonContactRecord {
  readonly id: string;
  readonly personId: string;
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

export interface CreatePersonContactRecordInput {
  readonly personId: string;
  readonly contactType: ContactType;
  readonly contactValue: string;
  readonly normalizedValue: string;
  readonly label: string | null;
  readonly isPrimary: boolean;
  readonly validFrom: Date | null;
  readonly validUntil: Date | null;
}

export type CreatePersonContactResult =
  | {
      readonly status: 'created';
      readonly contact: PersonContactRecord;
    }
  | {
      readonly status: 'conflict';
    }
  | {
      readonly status: 'person_unavailable';
    };
