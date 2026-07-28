import { createHmac, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { promisify } from 'node:util';

import type {
  AuthenticationClock,
  IssuedSessionToken,
  LoginFingerprintIdentityType,
  LoginFingerprintService,
  PasswordBlocklist,
  PasswordHasher,
  PasswordVerificationResult,
  SessionTokenService,
} from '@newax/auth';

const SCRYPT_COST = 131_072;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_MAX_MEMORY = 160 * 1024 * 1024;
const SCRYPT_MAX_COST = 131_072;
const SCRYPT_MAX_PARALLELIZATION = 10;
const SCRYPT_PREFIX = 'scrypt';

const BASELINE_BLOCKED_PASSWORDS = new Set([
  '123456789012345',
  'correcthorsebatterystaple',
  'letmeinletmeinletmein',
  'newax-newax-newax',
  'newaxpasswordnewax',
  'passwordpassword',
  'qwertyqwertyqwerty',
]);

const deriveScryptKey = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
) => Promise<Buffer>;

export class BaselinePasswordBlocklist implements PasswordBlocklist {
  async contains(password: string): Promise<boolean> {
    return BASELINE_BLOCKED_PASSWORDS.has(password.normalize('NFC').toLowerCase());
  }
}

export class NodePasswordHasher implements PasswordHasher {
  private readonly dummySalt = randomBytes(16);
  private readonly dummyHash = randomBytes(SCRYPT_KEY_LENGTH);

  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derivedKey = await this.derive(password, salt, {
      cost: SCRYPT_COST,
      blockSize: SCRYPT_BLOCK_SIZE,
      parallelization: SCRYPT_PARALLELIZATION,
    });

    return [
      SCRYPT_PREFIX,
      String(SCRYPT_COST),
      String(SCRYPT_BLOCK_SIZE),
      String(SCRYPT_PARALLELIZATION),
      salt.toString('base64url'),
      derivedKey.toString('base64url'),
    ].join('$');
  }

  async verifyOrBurn(
    password: string,
    secretHash: string | null,
  ): Promise<PasswordVerificationResult> {
    const parsed = secretHash === null ? null : this.parse(secretHash);
    if (parsed === null) {
      const derivedKey = await this.derive(password, this.dummySalt, {
        cost: SCRYPT_COST,
        blockSize: SCRYPT_BLOCK_SIZE,
        parallelization: SCRYPT_PARALLELIZATION,
      });
      timingSafeEqual(derivedKey, this.dummyHash);
      return { verified: false, needsRehash: false };
    }

    const derivedKey = await this.derive(password, parsed.salt, {
      cost: parsed.cost,
      blockSize: parsed.blockSize,
      parallelization: parsed.parallelization,
    });
    const verified = timingSafeEqual(derivedKey, parsed.hash);

    return {
      verified,
      needsRehash:
        verified &&
        (parsed.cost !== SCRYPT_COST ||
          parsed.blockSize !== SCRYPT_BLOCK_SIZE ||
          parsed.parallelization !== SCRYPT_PARALLELIZATION),
    };
  }

  private async derive(
    password: string,
    salt: Buffer,
    parameters: {
      readonly cost: number;
      readonly blockSize: number;
      readonly parallelization: number;
    },
  ): Promise<Buffer> {
    return deriveScryptKey(password, salt, SCRYPT_KEY_LENGTH, {
      N: parameters.cost,
      r: parameters.blockSize,
      p: parameters.parallelization,
      maxmem: SCRYPT_MAX_MEMORY,
    });
  }

  private parse(secretHash: string): {
    readonly cost: number;
    readonly blockSize: number;
    readonly parallelization: number;
    readonly salt: Buffer;
    readonly hash: Buffer;
  } | null {
    const parts = secretHash.split('$');
    if (parts.length !== 6) {
      return null;
    }

    const [prefix, costValue, blockSizeValue, parallelizationValue, saltValue, hashValue] = parts;
    if (
      prefix !== SCRYPT_PREFIX ||
      costValue === undefined ||
      blockSizeValue === undefined ||
      parallelizationValue === undefined ||
      saltValue === undefined ||
      hashValue === undefined
    ) {
      return null;
    }

    const cost = Number(costValue);
    const blockSize = Number(blockSizeValue);
    const parallelization = Number(parallelizationValue);
    if (
      !Number.isInteger(cost) ||
      !Number.isInteger(blockSize) ||
      !Number.isInteger(parallelization) ||
      cost < 2 ||
      cost > SCRYPT_MAX_COST ||
      (cost & (cost - 1)) !== 0 ||
      blockSize !== SCRYPT_BLOCK_SIZE ||
      parallelization < 1 ||
      parallelization > SCRYPT_MAX_PARALLELIZATION
    ) {
      return null;
    }

    try {
      const salt = Buffer.from(saltValue, 'base64url');
      const hash = Buffer.from(hashValue, 'base64url');
      if (salt.length < 16 || hash.length !== SCRYPT_KEY_LENGTH) {
        return null;
      }
      return { cost, blockSize, parallelization, salt, hash };
    } catch {
      return null;
    }
  }
}

abstract class HmacAuthenticationSecurity {
  constructor(private readonly pepper: string) {
    if (pepper.length < 32) {
      throw new Error('Authentication token pepper must contain at least 32 characters.');
    }
  }

  protected digest(domain: string, value: string): string {
    return createHmac('sha256', this.pepper)
      .update(domain)
      .update('\0')
      .update(value)
      .digest('hex');
  }
}

export class NodeSessionTokenService
  extends HmacAuthenticationSecurity
  implements SessionTokenService
{
  issue(): IssuedSessionToken {
    const token = randomBytes(32).toString('base64url');
    return { token, tokenHash: this.hash(token) };
  }

  hash(token: string): string {
    return this.digest('newax-auth-session-v1', token);
  }
}

export class NodeLoginFingerprintService
  extends HmacAuthenticationSecurity
  implements LoginFingerprintService
{
  fingerprint(identityType: LoginFingerprintIdentityType, identityValue: string): string {
    return this.digest(
      'newax-auth-login-fingerprint-v1',
      `${identityType}:${identityValue.trim().toLowerCase()}`,
    );
  }
}

export class SystemAuthenticationClock implements AuthenticationClock {
  now(): Date {
    return new Date();
  }
}
