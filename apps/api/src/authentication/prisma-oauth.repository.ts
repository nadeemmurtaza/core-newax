import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateExternalIdentityInput,
  ExternalIdentityRecord,
  OAuthRepository,
} from '@newax/auth';

import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PrismaOAuthRepository implements OAuthRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findExternalIdentity(
    provider: string,
    providerSubject: string,
  ): Promise<ExternalIdentityRecord | null> {
    const record = await this.prisma.coreUserExternalIdentity.findUnique({
      where: {
        provider_providerSubject: {
          provider,
          providerSubject,
        },
      },
    });
    return record === null ? null : this.mapRecord(record);
  }

  async createExternalIdentity(
    input: CreateExternalIdentityInput,
  ): Promise<ExternalIdentityRecord> {
    const created = await this.prisma.coreUserExternalIdentity.create({
      data: {
        userId: input.userId,
        provider: input.provider,
        providerSubject: input.providerSubject,
        providerUsername: input.providerUsername,
        createdAt: input.occurredAt,
        updatedAt: input.occurredAt,
      },
    });
    return this.mapRecord(created);
  }

  private mapRecord(record: {
    readonly id: string;
    readonly userId: string;
    readonly provider: string;
    readonly providerSubject: string;
    readonly providerUsername: string | null;
    readonly createdAt: Date;
    readonly updatedAt: Date;
  }): ExternalIdentityRecord {
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
}
