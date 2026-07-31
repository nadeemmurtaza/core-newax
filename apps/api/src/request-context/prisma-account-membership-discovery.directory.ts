import { Inject, Injectable } from '@nestjs/common';
import type {
  AccountMembershipCandidate,
  AccountMembershipDirectory,
  AccountMembershipDirectoryPage,
  TrustedMembershipStatus,
  TrustedOrganizationStatus,
} from '@newax/request-context';

import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';

interface AccountMembershipDatabaseRecord {
  readonly id: string;
  // Nullable at the database level (a CoreMembership may instead be
  // service-account-backed, see ADR 0035), but this query always filters by
  // a specific personId, so every row returned here is guaranteed
  // person-backed -- mapRecord() below still narrows explicitly rather than
  // asserting, since asserting would hide a real bug if that ever changed.
  readonly personId: string | null;
  readonly organizationId: string;
  readonly membershipType: string;
  readonly status: string;
  readonly jobTitle: string | null;
  readonly startDate: Date | null;
  readonly organization: {
    readonly displayName: string;
    readonly organizationType: string;
    readonly status: string;
  };
}

@Injectable()
export class PrismaAccountMembershipDiscoveryDirectory implements AccountMembershipDirectory {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listAvailableMemberships(
    personId: string,
    offset: number,
    limit: number,
  ): Promise<AccountMembershipDirectoryPage> {
    const where: Prisma.CoreMembershipWhereInput = {
      personId,
      status: 'active',
      endDate: null,
      person: {
        is: {
          status: 'active',
          deletedAt: null,
        },
      },
      organization: {
        is: {
          status: 'active',
          deletedAt: null,
          tenant: { is: { status: 'active', deletedAt: null } },
        },
      },
    };

    const [records, total] = await Promise.all([
      this.prisma.coreMembership.findMany({
        where,
        orderBy: [{ organizationId: 'asc' }, { membershipType: 'asc' }, { id: 'asc' }],
        skip: offset,
        take: limit,
        select: {
          id: true,
          personId: true,
          organizationId: true,
          membershipType: true,
          status: true,
          jobTitle: true,
          startDate: true,
          organization: {
            select: {
              displayName: true,
              organizationType: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.coreMembership.count({ where }),
    ]);

    return {
      items: records.map((record) => this.mapRecord(record)),
      total,
    };
  }

  private mapRecord(record: AccountMembershipDatabaseRecord): AccountMembershipCandidate {
    if (record.personId === null) {
      throw new Error(
        'A membership returned for an account-membership lookup was service-account-backed, ' +
          'not person-backed; this query should only ever match the requested personId.',
      );
    }
    return {
      membershipId: record.id,
      personId: record.personId,
      organizationId: record.organizationId,
      organizationDisplayName: record.organization.displayName,
      organizationType: record.organization.organizationType,
      organizationStatus: this.mapOrganizationStatus(record.organization.status),
      membershipType: record.membershipType,
      membershipStatus: this.mapMembershipStatus(record.status),
      jobTitle: record.jobTitle,
      startDate: record.startDate,
    };
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
