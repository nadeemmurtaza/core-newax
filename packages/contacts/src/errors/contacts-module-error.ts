export type ContactsErrorCode =
  | 'CONTACT_CONFLICT'
  | 'CONTACT_FORBIDDEN'
  | 'CONTACT_INTEGRITY_FAILURE'
  | 'CONTACT_INVALID_INPUT'
  | 'CONTACT_ORGANIZATION_UNAVAILABLE';

export class ContactsModuleError extends Error {
  readonly code: ContactsErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: ContactsErrorCode,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = 'ContactsModuleError';
    this.code = code;
    this.details = details;
  }
}
