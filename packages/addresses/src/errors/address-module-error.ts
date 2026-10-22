export type AddressErrorCode =
  | 'ADDRESS_CONFLICT'
  | 'ADDRESS_CURSOR_INVALID'
  | 'ADDRESS_FORBIDDEN'
  | 'ADDRESS_INTEGRITY_FAILURE'
  | 'ADDRESS_INVALID_INPUT'
  | 'ADDRESS_ORGANIZATION_UNAVAILABLE';

export class AddressModuleError extends Error {
  readonly code: AddressErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: AddressErrorCode,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = 'AddressModuleError';
    this.code = code;
    this.details = details;
  }
}
