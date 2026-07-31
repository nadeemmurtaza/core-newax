import { Inject, Injectable } from '@nestjs/common';
import type {
  AuthenticationRepository,
  AuthenticationSessionListQuery,
  AuthenticationSessionPage,
  AuthenticationSessionRecord,
  CreateAuthenticationSessionInput,
  CreateExternalIdentityInput,
  CreatePasswordCredentialInput,
  CredentialStatus,
  ExternalIdentityRecord,
  PasswordCredentialRecord,
  RecordAuthenticationAttemptInput,
  SessionStatus,
} from '@newax/auth';

import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';

interface CredentialDatabaseRecord {
  readonly id: string;
  readonly userId: string;
  readonly credentialType: string;
  readonly secretHash: string;
  readonly status: string;
  readonly expiresAt: Date | null;
  readonly lastUsedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

interface SessionDatabaseRecord {
  readonly id: string;
  readonly userId: string;
  readonly sessionTokenHash: string;
  readonly status: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly expiresAt: Date;
  readonly lastSeenAt: Date | null;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
}

interface ExternalIdentityDatabaseRecord {
  readonly id: string;
  readonly userId: string;
  readonly provider: string;
  readonly providerSubject: string;
  readonly providerUsername: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

@Injectable()
export class PrismaAuthenticationRepository implements AuthenticationRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async countRecentFailures(
    userId: string | null,
    identityFingerprint: string,
    since: Date,
  ): Promise<number> {
    return this.prisma.coreAuthenticationAttempt.count({
      where: {
        outcome: 'failed_invalid_secret',
        occurredAt: { gte: since },
        ...(userId === null ? { userId: null, identityFingerprint } : { userId }),
      },
    });
  }

  async createPasswordCredential(
    input: CreatePasswordCredentialInput,
  ): Promise<PasswordCredentialRecord | null> {
    return this.prisma.$transaction(
      async (transaction: Prisma.TransactionClient): Promise<PasswordCredentialRecord | null> => {
        await this.acquireLock(transaction, `password-credential:${input.userId}`);
        const existing = await transaction.coreUserCredential.findUnique({
          where: {
            userId_credentialType: {
              userId: input.userId,
              credentialType: 'password',
            },
          },
        });
        if (existing !== null) {
          return null;
        }

        const created = await transaction.coreUserCredential.create({
          data: {
            userId: input.userId,
            credentialType: 'password',
            secretHash: input.secretHash,
            status: 'active',
            createdAt: input.occurredAt,
            updatedAt: input.occurredAt,
          },
        });
        return this.mapCredential(created);
      },
    );
  }

  async createSession(
    input: CreateAuthenticationSessionInput,
  ): Promise<AuthenticationSessionRecord> {
    const created = await this.prisma.coreUserSession.create({
      data: {
        userId: input.userId,
        sessionTokenHash: input.sessionTokenHash,
        status: 'active',
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        expiresAt: input.expiresAt,
        lastSeenAt: input.occurredAt,
        createdAt: input.occurredAt,
      },
    });
    return this.mapSession(created);
  }

  async findPasswordCredential(userId: string): Promise<PasswordCredentialRecord | null> {
    const record = await this.prisma.coreUserCredential.findUnique({
      where: {
        userId_credentialType: {
          userId,
          credentialType: 'password',
        },
      },
    });
    return record === null ? null : this.mapCredential(record);
  }

  async findSessionByTokenHash(
    sessionTokenHash: string,
  ): Promise<AuthenticationSessionRecord | null> {
    const record = await this.prisma.coreUserSession.findUnique({
      where: { sessionTokenHash },
    });
    return record === null ? null : this.mapSession(record);
  }

  async listSessions(
    userId: string,
    query: AuthenticationSessionListQuery,
  ): Promise<AuthenticationSessionPage> {
    const limit = query.limit ?? 50;
    const records = await this.prisma.coreUserSession.findMany({
      where: {
        userId,
        ...(query.status === undefined ? {} : { status: query.status }),
      },
      orderBy: { id: 'asc' },
      take: limit + 1,
      ...(query.afterId === undefined ? {} : { cursor: { id: query.afterId }, skip: 1 }),
    });
    const hasMore = records.length > limit;
    const page = hasMore ? records.slice(0, limit) : records;
    const last = page.at(-1);
    return {
      items: page.map((record) => this.mapSession(record)),
      nextCursor: hasMore && last !== undefined ? last.id : null,
    };
  }

  async markCredentialUsed(credentialId: string, occurredAt: Date): Promise<void> {
    await this.prisma.coreUserCredential.update({
      where: { id: credentialId },
      data: { lastUsedAt: occurredAt },
    });
  }

  async recordAttempt(input: RecordAuthenticationAttemptInput): Promise<void> {
    await this.prisma.coreAuthenticationAttempt.create({
      data: {
        userId: input.userId,
        identityFingerprint: input.identityFingerprint,
        outcome: input.outcome,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        occurredAt: input.occurredAt,
      },
    });
  }

  async replacePasswordCredential(
    userId: string,
    secretHash: string,
    occurredAt: Date,
  ): Promise<PasswordCredentialRecord> {
    const record = await this.prisma.$transaction(
      async (transaction: Prisma.TransactionClient): Promise<CredentialDatabaseRecord> => {
        await this.acquireLock(transaction, `password-credential:${userId}`);
        return transaction.coreUserCredential.upsert({
          where: {
            userId_credentialType: {
              userId,
              credentialType: 'password',
            },
          },
          create: {
            userId,
            credentialType: 'password',
            secretHash,
            status: 'active',
            createdAt: occurredAt,
            updatedAt: occurredAt,
          },
          update: {
            secretHash,
            status: 'active',
            expiresAt: null,
            lastUsedAt: occurredAt,
            updatedAt: occurredAt,
          },
        });
      },
    );
    return this.mapCredential(record);
  }

  async revokeAllSessions(
    userId: string,
    occurredAt: Date,
    exceptSessionId?: string,
  ): Promise<number> {
    const result = await this.prisma.coreUserSession.updateMany({
      where: {
        userId,
        status: 'active',
        ...(exceptSessionId === undefined ? {} : { id: { not: exceptSessionId } }),
      },
      data: {
        status: 'revoked',
        revokedAt: occurredAt,
      },
    });
    return result.count;
  }

  async revokeSessionById(
    userId: string,
    sessionId: string,
    occurredAt: Date,
  ): Promise<AuthenticationSessionRecord | null> {
    const existing = await this.prisma.coreUserSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (existing === null) {
      return null;
    }
    if (existing.status !== 'active') {
      return this.mapSession(existing);
    }
    const updated = await this.prisma.coreUserSession.update({
      where: { id: existing.id },
      data: { status: 'revoked', revokedAt: occurredAt },
    });
    return this.mapSession(updated);
  }

  async revokeSessionByTokenHash(
    sessionTokenHash: string,
    occurredAt: Date,
  ): Promise<AuthenticationSessionRecord | null> {
    const existing = await this.prisma.coreUserSession.findUnique({
      where: { sessionTokenHash },
    });
    if (existing === null) {
      return null;
    }
    if (existing.status !== 'active') {
      return this.mapSession(existing);
    }
    const updated = await this.prisma.coreUserSession.update({
      where: { id: existing.id },
      data: { status: 'revoked', revokedAt: occurredAt },
    });
    return this.mapSession(updated);
  }

  async setSessionStatus(
    sessionId: string,
    status: SessionStatus,
    occurredAt: Date,
  ): Promise<AuthenticationSessionRecord | null> {
    const existing = await this.prisma.coreUserSession.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });
    if (existing === null) {
      return null;
    }
    const updated = await this.prisma.coreUserSession.update({
      where: { id: sessionId },
      data: {
        status,
        revokedAt: status === 'active' ? null : occurredAt,
      },
    });
    return this.mapSession(updated);
  }

  async touchSession(
    sessionId: string,
    occurredAt: Date,
  ): Promise<AuthenticationSessionRecord | null> {
    const existing = await this.prisma.coreUserSession.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true },
    });
    if (existing === null || existing.status !== 'active') {
      return null;
    }
    const updated = await this.prisma.coreUserSession.update({
      where: { id: sessionId },
      data: { lastSeenAt: occurredAt },
    });
    return this.mapSession(updated);
  }

  async findExternalIdentity(
    provider: string,
    providerSubject: string,
  ): Promise<ExternalIdentityRecord | null> {
    const record = await this.prisma.coreUserExternalIdentity.findUnique({
      where: { provider_providerSubject: { provider, providerSubject } },
    });
    return record === null ? null : this.mapExternalIdentity(record);
  }

  async upsertExternalIdentity(
    input: CreateExternalIdentityInput,
  ): Promise<ExternalIdentityRecord> {
    const record = await this.prisma.coreUserExternalIdentity.upsert({
      where: {
        provider_providerSubject: {
          provider: input.provider,
          providerSubject: input.providerSubject,
        },
      },
      create: {
        userId: input.userId,
        provider: input.provider,
        providerSubject: input.providerSubject,
        providerUsername: input.providerUsername,
        createdAt: input.occurredAt,
        updatedAt: input.occurredAt,
      },
      update: {
        providerUsername: input.providerUsername,
        updatedAt: input.occurredAt,
      },
    });
    return this.mapExternalIdentity(record);
  }

  private async acquireLock(transaction: Prisma.TransactionClient, lockKey: string): Promise<void> {
    await transaction.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
    `;
  }

  private mapCredential(record: CredentialDatabaseRecord): PasswordCredentialRecord {
    return {
      id: record.id,
      userId: record.userId,
      secretHash: record.secretHash,
      status: this.mapCredentialStatus(record.status),
      expiresAt: record.expiresAt,
      lastUsedAt: record.lastUsedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private mapSession(record: SessionDatabaseRecord): AuthenticationSessionRecord {
    return {
      id: record.id,
      userId: record.userId,
      status: this.mapSessionStatus(record.status),
      ipAddress: record.ipAddress,
      userAgent: record.userAgent,
      expiresAt: record.expiresAt,
      lastSeenAt: record.lastSeenAt,
      revokedAt: record.revokedAt,
      createdAt: record.createdAt,
    };
  }

  private mapExternalIdentity(record: ExternalIdentityDatabaseRecord): ExternalIdentityRecord {
    return {
      id: record.id,
      userId: record.userId,
      provider: record.provider,
      providerSubject: record.providerSubject,
      providerUsername: record.providerUsername,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private mapCredentialStatus(value: string): CredentialStatus {
    if (value === 'active' || value === 'disabled' || value === 'revoked' || value === 'expired') {
      return value;
    }
    throw new Error(`Unsupported credential status: ${value}`);
  }

  private mapSessionStatus(value: string): SessionStatus {
    if (value === 'active' || value === 'revoked' || value === 'expired') {
      return value;
    }
    throw new Error(`Unsupported session status: ${value}`);
  }
}
