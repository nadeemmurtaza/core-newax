export interface ExternalIdentityRecord {
  readonly id: string;
  readonly userId: string;
  readonly provider: string;
  readonly providerSubject: string;
  readonly providerUsername: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateExternalIdentityInput {
  readonly userId: string;
  readonly provider: string;
  readonly providerSubject: string;
  readonly providerUsername: string | null;
  readonly occurredAt: Date;
}

export interface OAuthRepository {
  findExternalIdentity(
    provider: string,
    providerSubject: string,
  ): Promise<ExternalIdentityRecord | null>;
  createExternalIdentity(input: CreateExternalIdentityInput): Promise<ExternalIdentityRecord>;
}
