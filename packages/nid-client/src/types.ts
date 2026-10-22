export interface NidAccount {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null | undefined;
  avatarUrl?: string | null | undefined;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isStaff: boolean;
  tenantId?: string | null | undefined;
  roles: string[];
  permissions: string[];
}

export interface NidSession {
  sessionId: string;
  token: string;
  accountId: string;
  tenantId?: string | null | undefined;
  account: NidAccount;
  expiresAt: string;
  issuedAt: string;
  active: boolean;
}

export interface NidTokenResponse {
  accessToken: string;
  refreshToken?: string | undefined;
  tokenType: string;
  expiresIn: number;
  scope: string;
  idToken?: string | undefined;
  account?: NidAccount | undefined;
}

export interface NidClientConfig {
  baseUrl: string;
  clientId: string;
  clientSecret?: string | undefined;
  redirectUri?: string | undefined;
  vaultToken?: string | undefined;
  allowMockAuth?: boolean | undefined;
}

export interface NidVaultSecret {
  key: string;
  value: string;
  environment: string;
  version: number;
  updatedAt: string;
}

export class NidAuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 401,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'NidAuthError';
  }
}
