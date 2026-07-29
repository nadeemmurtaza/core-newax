import { Inject, Injectable } from '@nestjs/common';
import {
  UserModuleError,
  type AddUserIdentityRecordInput,
  type AddUserIdentityResult,
  type AuthenticationUserRecord,
  type CreateUserRecordInput,
  type CreateUserResult,
  type RemoveUserIdentityResult,
  type UserIdentityRecord,
  type UserIdentityType,
  type UserListQuery,
  type UserPage,
  type UserRecord,
  type UserStatus,
  type UsersRepository,
} from '@newax/users';

import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

interface UserDatabaseRecord {
  readonly id: string;
  // Nullable at the database level because a CoreUser may instead be backed by
  // a CoreServiceAccount (see ADR 0035) -- @newax/users only supports
  // person-backed accounts, so mapUser()/requirePersonBackedUser() below
  // narrow this to a non-null string or throw.
  readonly personId: string | null;
  readonly status: string;
  readonly lastLoginAt: Date | null;
  readonly lockedUntil: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

interface UserIdentityDatabaseRecord {
  readonly id: string;
  readonly userId: string;
  readonly identityType: string;
  readonly identityValue: string;
  readonly normalizedValue: string;
  readonly isPrimary: boolean;
  readonly isVerified: boolean;
  readonly verifiedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

@Injectable()
export class PrismaUsersRepository implements UsersRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async addIdentity(input: AddUserIdentityRecordInput): Promise<AddUserIdentityResult> {
    const lockKeys = [
      `identity:${input.identityType}:${input.normalizedValue}`,
      `user:${input.userId}`,
    ].sort();

    return this.prisma.$transaction(
      async (transaction: Prisma.TransactionClient): Promise<AddUserIdentityResult> => {
        await this.acquireLocks(transaction, lockKeys);

        const existing = await transaction.coreUserIdentity.findUnique({
          where: {
            identityType_normalizedValue: {
              identityType: input.identityType,
              normalizedValue: input.normalizedValue,
            },
          },
          select: { id: true },
        });
        if (existing !== null) {
          return { status: 'identity_conflict' };
        }

        const identityCount = await transaction.coreUserIdentity.count({
          where: { userId: input.userId },
        });
        const isPrimary = input.makePrimary || identityCount === 0;
        if (isPrimary) {
          await transaction.coreUserIdentity.updateMany({
            where: { userId: input.userId },
            data: { isPrimary: false },
          });
        }

        const created = await transaction.coreUserIdentity.create({
          data: {
            userId: input.userId,
            identityType: input.identityType,
            identityValue: input.identityValue,
            normalizedValue: input.normalizedValue,
            isPrimary,
          },
        });
        return {
          status: 'created',
          identity: this.mapIdentity(created),
        };
      },
    );
  }

  async create(input: CreateUserRecordInput): Promise<CreateUserResult> {
    const lockKeys = [
      `identity:${input.identityType}:${input.normalizedValue}`,
      `person:${input.personId}`,
    ].sort();

    return this.prisma.$transaction(
      async (transaction: Prisma.TransactionClient): Promise<CreateUserResult> => {
        await this.acquireLocks(transaction, lockKeys);

        const existingUser = await transaction.coreUser.findUnique({
          where: { personId: input.personId },
          select: { id: true },
        });
        if (existingUser !== null) {
          return {
            status: 'person_conflict',
            existingUserId: existingUser.id,
          };
        }

        const existingIdentity = await transaction.coreUserIdentity.findUnique({
          where: {
            identityType_normalizedValue: {
              identityType: input.identityType,
              normalizedValue: input.normalizedValue,
            },
          },
          select: { id: true },
        });
        if (existingIdentity !== null) {
          return { status: 'identity_conflict' };
        }

        const createdUser = await transaction.coreUser.create({
          data: {
            personId: input.personId,
            status: 'invited',
          },
        });
        const createdIdentity = await transaction.coreUserIdentity.create({
          data: {
            userId: createdUser.id,
            identityType: input.identityType,
            identityValue: input.identityValue,
            normalizedValue: input.normalizedValue,
            isPrimary: true,
          },
        });

        return {
          status: 'created',
          user: this.mapUser(createdUser),
          identity: this.mapIdentity(createdIdentity),
        };
      },
    );
  }

  async findById(id: string): Promise<UserRecord | null> {
    const record = await this.prisma.coreUser.findUnique({ where: { id } });
    return record === null ? null : this.mapUser(record);
  }

  async findByNormalizedIdentity(
    identityType: UserIdentityType,
    normalizedValue: string,
  ): Promise<AuthenticationUserRecord | null> {
    const record = await this.prisma.coreUserIdentity.findUnique({
      where: {
        identityType_normalizedValue: {
          identityType,
          normalizedValue,
        },
      },
      select: {
        id: true,
        identityType: true,
        isVerified: true,
        user: {
          select: {
            id: true,
            personId: true,
            status: true,
            lockedUntil: true,
          },
        },
      },
    });
    if (record === null) {
      return null;
    }

    return {
      userId: record.user.id,
      personId: this.requirePersonBackedUser(record.user.personId),
      userStatus: this.mapUserStatus(record.user.status),
      lockedUntil: record.user.lockedUntil,
      identityId: record.id,
      identityType: this.mapIdentityType(record.identityType),
      isVerified: record.isVerified,
    };
  }

  async list(organizationId: string, query: UserListQuery): Promise<UserPage> {
    const limit = query.limit ?? 50;
    const where: Prisma.CoreUserWhereInput = {
      person: {
        memberships: {
          some: {
            organizationId,
            status: { in: ['active', 'suspended'] },
          },
        },
      },
    };

    if (query.status !== undefined) {
      where.status = query.status;
    } else {
      where.status = {
        in: ['invited', 'active', 'suspended', 'disabled'],
      };
    }

    if (query.search !== undefined) {
      where.OR = [
        {
          person: {
            firstName: { contains: query.search, mode: 'insensitive' },
          },
        },
        {
          person: {
            middleName: { contains: query.search, mode: 'insensitive' },
          },
        },
        {
          person: {
            lastName: { contains: query.search, mode: 'insensitive' },
          },
        },
        {
          person: {
            preferredName: { contains: query.search, mode: 'insensitive' },
          },
        },
      ];
    }

    const records = await this.prisma.coreUser.findMany({
      where,
      orderBy: { id: 'asc' },
      take: limit + 1,
      ...(query.afterId === undefined ? {} : { cursor: { id: query.afterId }, skip: 1 }),
    });

    const hasMore = records.length > limit;
    const page = hasMore ? records.slice(0, limit) : records;
    const last = page.at(-1);
    return {
      items: page.map((record) => this.mapUser(record)),
      nextCursor: hasMore && last !== undefined ? last.id : null,
    };
  }

  async listIdentities(userId: string): Promise<readonly UserIdentityRecord[]> {
    const records = await this.prisma.coreUserIdentity.findMany({
      where: { userId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    return records.map((record) => this.mapIdentity(record));
  }

  async recordSuccessfulLogin(userId: string, occurredAt: Date): Promise<UserRecord | null> {
    const existing = await this.prisma.coreUser.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (existing === null) {
      return null;
    }
    const updated = await this.prisma.coreUser.update({
      where: { id: userId },
      data: {
        lastLoginAt: occurredAt,
        lockedUntil: null,
      },
    });
    return this.mapUser(updated);
  }

  async removeIdentity(userId: string, identityId: string): Promise<RemoveUserIdentityResult> {
    return this.prisma.$transaction(
      async (transaction: Prisma.TransactionClient): Promise<RemoveUserIdentityResult> => {
        await this.acquireLocks(transaction, [`user:${userId}`]);
        const identities = await transaction.coreUserIdentity.findMany({
          where: { userId },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });
        const target = identities.find((current) => current.id === identityId);
        if (target === undefined) {
          return { status: 'not_found' };
        }
        if (identities.length === 1) {
          return { status: 'last_identity' };
        }

        await transaction.coreUserIdentity.delete({
          where: { id: target.id },
        });

        let newPrimaryIdentityId: string | null = null;
        if (target.isPrimary) {
          const replacement = identities.find((current) => current.id !== target.id);
          if (replacement !== undefined) {
            await transaction.coreUserIdentity.update({
              where: { id: replacement.id },
              data: { isPrimary: true },
            });
            newPrimaryIdentityId = replacement.id;
          }
        }

        return {
          status: 'removed',
          removedIdentityId: target.id,
          newPrimaryIdentityId,
        };
      },
    );
  }

  async setLockedUntil(userId: string, lockedUntil: Date | null): Promise<UserRecord | null> {
    const existing = await this.prisma.coreUser.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (existing === null) {
      return null;
    }
    const updated = await this.prisma.coreUser.update({
      where: { id: userId },
      data: { lockedUntil },
    });
    return this.mapUser(updated);
  }

  async setPrimaryIdentity(userId: string, identityId: string): Promise<UserIdentityRecord | null> {
    return this.prisma.$transaction(
      async (transaction: Prisma.TransactionClient): Promise<UserIdentityRecord | null> => {
        await this.acquireLocks(transaction, [`user:${userId}`]);
        const identity = await transaction.coreUserIdentity.findFirst({
          where: { id: identityId, userId },
        });
        if (identity === null) {
          return null;
        }
        await transaction.coreUserIdentity.updateMany({
          where: { userId },
          data: { isPrimary: false },
        });
        const updated = await transaction.coreUserIdentity.update({
          where: { id: identity.id },
          data: { isPrimary: true },
        });
        return this.mapIdentity(updated);
      },
    );
  }

  async setStatus(id: string, status: UserStatus): Promise<UserRecord> {
    const updated = await this.prisma.coreUser.update({
      where: { id },
      data: { status },
    });
    return this.mapUser(updated);
  }

  private async acquireLocks(
    transaction: Prisma.TransactionClient,
    lockKeys: readonly string[],
  ): Promise<void> {
    for (const lockKey of lockKeys) {
      await transaction.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
      `;
    }
  }

  private mapUser(record: UserDatabaseRecord): UserRecord {
    return {
      id: record.id,
      personId: this.requirePersonBackedUser(record.personId),
      status: this.mapUserStatus(record.status),
      lastLoginAt: record.lastLoginAt,
      lockedUntil: record.lockedUntil,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  // @newax/users only supports person-backed accounts; a service-account-backed
  // CoreUser (see ADR 0035) reaching this repository's read paths would be a
  // caller bug (looking up a machine identity through the human-user API).
  private requirePersonBackedUser(personId: string | null): string {
    if (personId === null) {
      throw new UserModuleError(
        'USER_ACCOUNT_NOT_PERSON_BACKED',
        'This user account is a service-account identity, not a person-backed user.',
      );
    }
    return personId;
  }

  private mapIdentity(record: UserIdentityDatabaseRecord): UserIdentityRecord {
    return {
      ...record,
      identityType: this.mapIdentityType(record.identityType),
    };
  }

  private mapUserStatus(value: string): UserStatus {
    if (
      value === 'invited' ||
      value === 'active' ||
      value === 'suspended' ||
      value === 'disabled' ||
      value === 'archived'
    ) {
      return value;
    }
    throw new Error(`Unsupported user status: ${value}`);
  }

  private mapIdentityType(value: string): UserIdentityType {
    if (value === 'email' || value === 'username' || value === 'phone') {
      return value;
    }
    throw new Error(`Unsupported user identity type: ${value}`);
  }
}
