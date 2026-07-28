export type FileErrorCode =
  | 'FILE_ACTOR_UNAVAILABLE'
  | 'FILE_CONFLICT'
  | 'FILE_CURSOR_INVALID'
  | 'FILE_FORBIDDEN'
  | 'FILE_INTEGRITY_FAILURE'
  | 'FILE_INVALID_INPUT'
  | 'FILE_ORGANIZATION_UNAVAILABLE';

export class FileModuleError extends Error {
  readonly code: FileErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: FileErrorCode,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = 'FileModuleError';
    this.code = code;
    this.details = details;
  }
}
