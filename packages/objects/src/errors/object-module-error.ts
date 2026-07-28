export type ObjectErrorCode =
  | 'OBJECT_CONFLICT'
  | 'OBJECT_CURSOR_INVALID'
  | 'OBJECT_FORBIDDEN'
  | 'OBJECT_INTEGRITY_FAILURE'
  | 'OBJECT_INVALID_INPUT'
  | 'OBJECT_ORGANIZATION_UNAVAILABLE'
  | 'OBJECT_PARENT_UNAVAILABLE'
  | 'OBJECT_TYPE_UNAVAILABLE';

export class ObjectModuleError extends Error {
  readonly code: ObjectErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: ObjectErrorCode,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = 'ObjectModuleError';
    this.code = code;
    this.details = details;
  }
}
