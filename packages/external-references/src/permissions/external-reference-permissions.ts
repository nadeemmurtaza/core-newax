export const EXTERNAL_REFERENCE_PERMISSIONS = {
  register: 'external_references.register',
  view: 'external_references.view',
} as const;

export type ExternalReferencePermission =
  (typeof EXTERNAL_REFERENCE_PERMISSIONS)[keyof typeof EXTERNAL_REFERENCE_PERMISSIONS];
