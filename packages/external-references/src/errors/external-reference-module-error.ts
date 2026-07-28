export type ExternalReferenceErrorCode =
  | 'EXTERNAL_REFERENCE_ACTOR_UNAVAILABLE'
  | 'EXTERNAL_REFERENCE_CONFLICT'
  | 'EXTERNAL_REFERENCE_CURSOR_INVALID'
  | 'EXTERNAL_REFERENCE_FORBIDDEN'
  | 'EXTERNAL_REFERENCE_INTEGRITY_FAILURE'
  | 'EXTERNAL_REFERENCE_INVALID_INPUT'
  | 'EXTERNAL_REFERENCE_ORGANIZATION_UNAVAILABLE';

export class ExternalReferenceModuleError extends Error {
  readonly code: ExternalReferenceErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: ExternalReferenceErrorCode,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = 'ExternalReferenceModuleError';
    this.code = code;
    this.details = details;
  }
}
