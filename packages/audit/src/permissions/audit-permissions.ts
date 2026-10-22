export const AUDIT_PERMISSIONS = Object.freeze({
  view: 'audit.view',
} as const);

export type AuditPermission = (typeof AUDIT_PERMISSIONS)[keyof typeof AUDIT_PERMISSIONS];
