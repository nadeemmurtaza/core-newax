export type OrganizationAddressType =
  'registered' | 'office' | 'billing' | 'shipping' | 'mailing' | 'campus' | 'facility' | 'other';

export interface OrganizationAddressRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly addressId: string;
  readonly addressType: OrganizationAddressType;
  readonly isPrimary: boolean;
  readonly line1: string;
  readonly line2: string | null;
  readonly city: string;
  readonly stateRegion: string | null;
  readonly postalCode: string | null;
  readonly countryCode: string;
  readonly createdAt: Date;
}

export interface OrganizationAddressRequestContext {
  readonly actorUserId: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly permissionCodes: ReadonlySet<string>;
}

export interface CreateOrganizationAddressInput {
  readonly addressType: OrganizationAddressType;
  readonly isPrimary: boolean;
  readonly line1: string;
  readonly line2?: string | null;
  readonly city: string;
  readonly stateRegion?: string | null;
  readonly postalCode?: string | null;
  readonly countryCode: string;
}

// Full-replacement update: the caller always supplies the complete desired
// address state (mirrors CreateOrganizationAddressInput's ergonomics) rather
// than a partial patch merged with prior values. When the address value
// resolves to a different canonical CoreAddress than the one
// organizationAddressId currently links to, this relinks to the new (or
// newly created) shared address and retires the old join row -- it never
// mutates a shared address's own value in place, since other organizations
// or people may reference the same row.
export interface UpdateOrganizationAddressInput {
  readonly organizationAddressId: string;
  readonly addressType: OrganizationAddressType;
  readonly isPrimary: boolean;
  readonly line1: string;
  readonly line2?: string | null;
  readonly city: string;
  readonly stateRegion?: string | null;
  readonly postalCode?: string | null;
  readonly countryCode: string;
}

export interface OrganizationAddressListQuery {
  readonly addressType?: OrganizationAddressType;
  readonly limit?: number;
  readonly afterId?: string;
}

export interface OrganizationAddressPage {
  readonly items: readonly OrganizationAddressRecord[];
  readonly nextCursor: string | null;
}

export interface CreateOrganizationAddressRecordInput {
  readonly tenantId: string;
  readonly organizationId: string;
  readonly addressType: OrganizationAddressType;
  readonly isPrimary: boolean;
  readonly line1: string;
  readonly line2: string | null;
  readonly city: string;
  readonly stateRegion: string | null;
  readonly postalCode: string | null;
  readonly countryCode: string;
  readonly canonicalKey: string;
}

export type CreateOrganizationAddressResult =
  | {
      readonly status: 'created';
      readonly address: OrganizationAddressRecord;
    }
  | {
      readonly status: 'conflict';
    }
  | {
      readonly status: 'organization_unavailable';
    };

export interface UpdateOrganizationAddressRecordInput {
  readonly tenantId: string;
  readonly organizationId: string;
  readonly organizationAddressId: string;
  readonly addressType: OrganizationAddressType;
  readonly isPrimary: boolean;
  readonly line1: string;
  readonly line2: string | null;
  readonly city: string;
  readonly stateRegion: string | null;
  readonly postalCode: string | null;
  readonly countryCode: string;
  readonly canonicalKey: string;
}

export type UpdateOrganizationAddressResult =
  | {
      readonly status: 'updated';
      readonly address: OrganizationAddressRecord;
      readonly relinked: boolean;
    }
  | {
      readonly status: 'conflict';
    }
  | {
      readonly status: 'organization_unavailable';
    }
  | {
      readonly status: 'address_unavailable';
    };

export interface ListOrganizationAddressesRecordInput {
  readonly tenantId: string;
  readonly organizationId: string;
  readonly addressType?: OrganizationAddressType;
  readonly limit: number;
  readonly afterId?: string;
}

export type ListOrganizationAddressesResult =
  | {
      readonly status: 'available';
      readonly items: readonly OrganizationAddressRecord[];
      readonly nextCursor: string | null;
    }
  | {
      readonly status: 'cursor_invalid';
    }
  | {
      readonly status: 'organization_unavailable';
    };
