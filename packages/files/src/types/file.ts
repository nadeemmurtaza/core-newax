export interface FileRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly fileSize: bigint;
  readonly createdAt: Date;
}

export interface OrganizationFileRequestContext {
  readonly actorUserId: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly permissionCodes: ReadonlySet<string>;
}

export interface RegisterOrganizationFileInput {
  readonly storageProvider: string;
  readonly storageKey: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly fileSize: bigint;
  readonly checksum: string;
}

export interface OrganizationFileListQuery {
  readonly limit?: number;
  readonly afterId?: string;
}

export interface OrganizationFilePage {
  readonly items: readonly FileRecord[];
  readonly nextCursor: string | null;
}

export interface RegisterOrganizationFileRecordInput {
  readonly actorUserId: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly storageProvider: string;
  readonly storageKey: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly fileSize: bigint;
  readonly checksum: string;
}

export type RegisterOrganizationFileResult =
  | { readonly status: 'created'; readonly file: FileRecord }
  | { readonly status: 'conflict' }
  | { readonly status: 'actor_unavailable' }
  | { readonly status: 'organization_unavailable' };

export interface ListOrganizationFilesRecordInput {
  readonly tenantId: string;
  readonly organizationId: string;
  readonly limit: number;
  readonly afterId?: string;
}

export type ListOrganizationFilesResult =
  | {
      readonly status: 'available';
      readonly items: readonly FileRecord[];
      readonly nextCursor: string | null;
    }
  | { readonly status: 'cursor_invalid' }
  | { readonly status: 'organization_unavailable' };
