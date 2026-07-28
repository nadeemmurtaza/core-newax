export type TenantErrorCode =
  'TENANT_FORBIDDEN' | 'TENANT_INTEGRITY_FAILURE' | 'TENANT_INVALID_INPUT' | 'TENANT_NOT_FOUND';

export class TenantModuleError extends Error {
  readonly code: TenantErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: TenantErrorCode,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = 'TenantModuleError';
    this.code = code;
    this.details = details;
  }
}
