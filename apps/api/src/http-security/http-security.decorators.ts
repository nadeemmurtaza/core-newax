import { applyDecorators, SetMetadata } from '@nestjs/common';
import type { HttpSecurityContextMode } from '@newax/http-security';

export const HTTP_CONTEXT_MODE_KEY = 'newax:http-security:context-mode';
export const HTTP_REQUIRED_PERMISSIONS_KEY = 'newax:http-security:required-permissions';
export const HTTP_AUTHENTICATION_SENSITIVE_KEY = 'newax:http-security:authentication-sensitive';
export const HTTP_PUBLIC_AUTHENTICATION_MUTATION_KEY =
  'newax:http-security:public-authentication-mutation';
export const HTTP_PUBLIC_SIGNED_MUTATION_KEY = 'newax:http-security:public-signed-mutation';
export const HTTP_AUDIT_AS_STATE_CHANGING_KEY = 'newax:http-security:audit-as-state-changing';

const PERMISSION_CODE_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u;

export function PublicEndpoint(): MethodDecorator & ClassDecorator {
  return SetMetadata(HTTP_CONTEXT_MODE_KEY, 'public' satisfies HttpSecurityContextMode);
}

export function PublicAuthenticationEndpoint(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    SetMetadata(HTTP_CONTEXT_MODE_KEY, 'public' satisfies HttpSecurityContextMode),
    SetMetadata(HTTP_AUTHENTICATION_SENSITIVE_KEY, true),
    SetMetadata(HTTP_PUBLIC_AUTHENTICATION_MUTATION_KEY, true),
  );
}

// For endpoints authenticated by a verified request signature (e.g. an inbound
// integration webhook) rather than a session cookie. The route's own guard is
// responsible for verifying the signature and rejecting unauthenticated calls —
// this decorator only tells HttpSecurityGuard that session/CSRF enforcement does
// not apply here, it does not grant any permission by itself.
export function PublicSignedMutationEndpoint(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    SetMetadata(HTTP_CONTEXT_MODE_KEY, 'public' satisfies HttpSecurityContextMode),
    SetMetadata(HTTP_PUBLIC_SIGNED_MUTATION_KEY, true),
  );
}

export function AccountContextEndpoint(): MethodDecorator & ClassDecorator {
  return SetMetadata(HTTP_CONTEXT_MODE_KEY, 'account' satisfies HttpSecurityContextMode);
}

export function OrganizationContextEndpoint(): MethodDecorator & ClassDecorator {
  return SetMetadata(HTTP_CONTEXT_MODE_KEY, 'organization' satisfies HttpSecurityContextMode);
}

export function RequirePermissions(
  ...permissionCodes: readonly string[]
): MethodDecorator & ClassDecorator {
  if (permissionCodes.length === 0) {
    throw new Error('RequirePermissions requires at least one permission code.');
  }

  const normalized = permissionCodes.map((permissionCode) => {
    if (
      permissionCode.length === 0 ||
      permissionCode.length > 160 ||
      permissionCode.trim() !== permissionCode ||
      !PERMISSION_CODE_PATTERN.test(permissionCode)
    ) {
      throw new Error(`Invalid HTTP permission code: ${permissionCode}`);
    }
    return permissionCode;
  });

  return SetMetadata(HTTP_REQUIRED_PERMISSIONS_KEY, [...new Set(normalized)]);
}

export function AuthenticationSensitiveEndpoint(): MethodDecorator & ClassDecorator {
  return SetMetadata(HTTP_AUTHENTICATION_SENSITIVE_KEY, true);
}

// Forces an HTTP-boundary audit record on success even for a safe HTTP method (e.g. a GET OAuth callback); independent of the CSRF-driving newaxStateChanging flag.
export function AuditAsStateChanging(): MethodDecorator & ClassDecorator {
  return SetMetadata(HTTP_AUDIT_AS_STATE_CHANGING_KEY, true);
}
