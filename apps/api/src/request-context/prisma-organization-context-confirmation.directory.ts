import { Inject, Injectable } from '@nestjs/common';
import type {
  OrganizationContextConfirmationDirectory,
  OrganizationContextConfirmationRecord,
  TrustedMembershipStatus,
  TrustedOrganizationStatus,
  TrustedTenantStatus,
} from '@newax/request-context';

import { PrismaService } from '../database/prisma.service';

interface OrganizationContextDatabaseRecord {
  readonly id: string;
  // Nullable at the database level (a CoreMembership may instead be
  // service-account-backed, see ADR 0035), but this query's `person: { is: {
  // ... } }` filter already excludes rows with no person relation --
  // mapRecord() below still narrows explicitly rather than asserting.
  readonly personId: string | null;
  readonly organizationId: string;
  readonly membershipType: string;
  readonly status: string;
  readonly jobTitle: string | null;
  readonly organization: {
    readonly tenantId: string;
    readonly tenant: { readonly status: string };
    readonly displayName: string;
    readonly organizationType: string;
    readonly status: string;
  };
}

@Injectable()
export class PrismaOrganizationContextConfirmationDirectory implements OrganizationContextConfirmationDirectory {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findConfirmationRecord(
    membershipId: string,
  ): Promise<OrganizationContextConfirmationRecord | null> {
    const record = await this.prisma.coreMembership.findFirst({
      where: {
        id: membershipId,
        status: 'active',
        endDate: null,
        person: {
          is: {
            status: 'active',
            deletedAt: null,
            tenant: { is: { status: 'active', deletedAt: null } },
          },
        },
        organization: {
          is: {
            status: 'active',
            deletedAt: null,
          },
        },
      },
      select: {
        id: true,
        personId: true,
        organizationId: true,
        membershipType: true,
        status: true,
        jobTitle: true,
        organization: {
          select: {
            tenantId: true,
            tenant: { select: { status: true } },
            displayName: true,
            organizationType: true,
            status: true,
          },
        },
      },
    });

    return record === null ? null : this.mapRecord(record);
  }

  private mapRecord(
    record: OrganizationContextDatabaseRecord,
  ): OrganizationContextConfirmationRecord {
    if (record.personId === null) {
      throw new Error(
        'An organization-context membership lookup returned a service-account-backed ' +
          'membership, not a person-backed one; this query should exclude those.',
      );
    }
    return {
      membershipId: record.id,
      personId: record.personId,
      tenantId: record.organization.tenantId,
      tenantStatus: this.mapTenantStatus(record.organization.tenant.status),
      organizationId: record.organizationId,
      organizationDisplayName: record.organization.displayName,
      organizationType: record.organization.organizationType,
      organizationStatus: this.mapOrganizationStatus(record.organization.status),
      membershipType: record.membershipType,
      membershipStatus: this.mapMembershipStatus(record.status),
      jobTitle: record.jobTitle,
    };
  }

  private mapTenantStatus(value: string): TrustedTenantStatus {
    if (value === 'active' || value === 'suspended' || value === 'archived') {
      return value;
    }
    throw new Error(`Unsupported tenant status: ${value}`);
  }

  private mapMembershipStatus(value: string): TrustedMembershipStatus {
    if (value === 'active' || value === 'suspended' || value === 'ended') {
      return value;
    }
    throw new Error(`Unsupported membership status: ${value}`);
  }

  private mapOrganizationStatus(value: string): TrustedOrganizationStatus {
    if (value === 'active' || value === 'suspended' || value === 'archived') {
      return value;
    }
    throw new Error(`Unsupported organization status: ${value}`);
  }
}
