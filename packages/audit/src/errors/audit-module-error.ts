export type AuditErrorCode =
  | 'AUDIT_ACTOR_UNAVAILABLE'
  | 'AUDIT_CURSOR_INVALID'
  | 'AUDIT_FORBIDDEN'
  | 'AUDIT_INTEGRITY_FAILURE'
  | 'AUDIT_INVALID_INPUT'
  | 'AUDIT_SCOPE_UNAVAILABLE';

export class AuditModuleError extends Error {
  constructor(
    readonly code: AuditErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AuditModuleError';
  }
}
