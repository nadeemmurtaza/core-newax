import { RequestContextError } from '../errors/request-context-error';
import type {
  ModuleRequestContext,
  TrustedOrganizationRequestContext,
} from '../types/request-context';

export class ContextAuthorizer {
  hasPermission(context: TrustedOrganizationRequestContext, permissionCode: string): boolean {
    const normalized = this.requirePermissionCode(permissionCode);
    return context.permissionCodes.has(normalized);
  }

  requirePermission(context: TrustedOrganizationRequestContext, permissionCode: string): void {
    const normalized = this.requirePermissionCode(permissionCode);
    if (!context.permissionCodes.has(normalized)) {
      throw new RequestContextError(
        'REQUEST_CONTEXT_FORBIDDEN',
        'The trusted request context does not grant the required permission.',
        { permissionCode: normalized },
      );
    }
  }

  requireAllPermissions(
    context: TrustedOrganizationRequestContext,
    permissionCodes: readonly string[],
  ): void {
    const normalized = permissionCodes.map((permissionCode) =>
      this.requirePermissionCode(permissionCode),
    );
    const missing = normalized.filter(
      (permissionCode) => !context.permissionCodes.has(permissionCode),
    );
    if (missing.length > 0) {
      throw new RequestContextError(
        'REQUEST_CONTEXT_FORBIDDEN',
        'The trusted request context does not grant every required permission.',
        { missingPermissionCodes: missing },
      );
    }
  }

  requireAnyPermission(
    context: TrustedOrganizationRequestContext,
    permissionCodes: readonly string[],
  ): void {
    const normalized = permissionCodes.map((permissionCode) =>
      this.requirePermissionCode(permissionCode),
    );
    if (
      normalized.length === 0 ||
      !normalized.some((permissionCode) => context.permissionCodes.has(permissionCode))
    ) {
      throw new RequestContextError(
        'REQUEST_CONTEXT_FORBIDDEN',
        'The trusted request context does not grant any accepted permission.',
        { acceptedPermissionCodes: normalized },
      );
    }
  }

  toModuleContext(context: TrustedOrganizationRequestContext): ModuleRequestContext {
    return {
      actorUserId: context.userId,
      tenantId: context.tenantId,
      organizationId: context.organizationId,
      permissionCodes: context.permissionCodes,
    };
  }

  private requirePermissionCode(permissionCode: string): string {
    const normalized = permissionCode.trim();
    if (normalized.length === 0 || normalized.length > 160) {
      throw new RequestContextError(
        'REQUEST_CONTEXT_INVALID_INPUT',
        'permissionCode must contain between 1 and 160 characters.',
      );
    }
    return normalized;
  }
}
