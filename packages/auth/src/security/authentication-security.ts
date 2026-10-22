import type {
  ExternalIdentityProfile,
  IssuedSessionToken,
  LoginFingerprintIdentityType,
  PasswordVerificationResult,
} from '../types/authentication';

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verifyOrBurn(password: string, secretHash: string | null): Promise<PasswordVerificationResult>;
}

export interface SessionTokenService {
  hash(token: string): string;
  issue(): IssuedSessionToken;
}

export interface LoginFingerprintService {
  fingerprint(identityType: LoginFingerprintIdentityType, identityValue: string): string;
}

export interface AuthenticationClock {
  now(): Date;
}

export interface OAuthProvider {
  readonly name: string;
  buildAuthorizationUrl(state: string): string;
  exchangeCode(code: string): Promise<string>;
  fetchProfile(accessToken: string): Promise<ExternalIdentityProfile>;
}
