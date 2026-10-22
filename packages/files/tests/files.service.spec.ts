import { describe, expect, it } from 'vitest';

import type { FileRepository } from '../src/database/file-repository';
import type { FileEvent, FileEventPublisher } from '../src/events/file-event';
import { FILE_PERMISSIONS } from '../src/permissions/file-permissions';
import { FilesService } from '../src/services/files.service';
import type {
  FileRecord,
  ListOrganizationFilesRecordInput,
  ListOrganizationFilesResult,
  OrganizationFileRequestContext,
  RegisterOrganizationFileInput,
  RegisterOrganizationFileRecordInput,
  RegisterOrganizationFileResult,
} from '../src/types/file';

const ACTOR_ID = '00000000-0000-4000-8000-000000000001';
const TENANT_ID = '00000000-0000-4000-8000-000000000002';
const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000003';
const FILE_ID = '00000000-0000-4000-8000-000000000004';
const FOREIGN_TENANT_ID = '00000000-0000-4000-8000-000000000005';
const CHECKSUM = `sha256:${'a'.repeat(64)}`;

function context(...permissions: string[]): OrganizationFileRequestContext {
  return {
    actorUserId: ACTOR_ID,
    tenantId: TENANT_ID,
    organizationId: ORGANIZATION_ID,
    permissionCodes: new Set(permissions),
  };
}

function input(
  overrides: Partial<RegisterOrganizationFileInput> = {},
): RegisterOrganizationFileInput {
  return {
    storageProvider: 'primary.s3',
    storageKey: 'tenant/object-key',
    fileName: 'Board Pack.pdf',
    mimeType: 'application/pdf',
    fileSize: 1_024n,
    checksum: CHECKSUM,
    ...overrides,
  };
}

function record(overrides: Partial<FileRecord> = {}): FileRecord {
  return {
    id: FILE_ID,
    tenantId: TENANT_ID,
    organizationId: ORGANIZATION_ID,
    fileName: 'Board Pack.pdf',
    mimeType: 'application/pdf',
    fileSize: 1_024n,
    createdAt: new Date('2026-07-14T02:00:00.000Z'),
    ...overrides,
  };
}

class FakeFileRepository implements FileRepository {
  registerInput: RegisterOrganizationFileRecordInput | null = null;
  listInput: ListOrganizationFilesRecordInput | null = null;
  registerResult: RegisterOrganizationFileResult = {
    status: 'created',
    file: record(),
  };
  listResult: ListOrganizationFilesResult = {
    status: 'available',
    items: [record()],
    nextCursor: null,
  };

  async registerOrganizationFile(
    registerInput: RegisterOrganizationFileRecordInput,
  ): Promise<RegisterOrganizationFileResult> {
    this.registerInput = registerInput;
    return this.registerResult;
  }

  async listOrganizationFiles(
    listInput: ListOrganizationFilesRecordInput,
  ): Promise<ListOrganizationFilesResult> {
    this.listInput = listInput;
    return this.listResult;
  }
}

class RecordingFileEventPublisher implements FileEventPublisher {
  readonly events: FileEvent[] = [];

  async publish(event: FileEvent): Promise<void> {
    this.events.push(event);
  }
}

describe('FilesService metadata registry foundation', () => {
  it('normalizes trusted metadata and publishes a sensitive-value-free event', async () => {
    const repository = new FakeFileRepository();
    const publisher = new RecordingFileEventPublisher();
    const service = new FilesService(repository, publisher);

    const file = await service.registerCurrentOrganizationFile(
      context(FILE_PERMISSIONS.register),
      input({
        storageProvider: ' PRIMARY.S3 ',
        fileName: '  Board   Pack.pdf  ',
        mimeType: ' APPLICATION/PDF ',
        checksum: CHECKSUM.toUpperCase(),
      }),
    );

    expect(repository.registerInput).toEqual({
      actorUserId: ACTOR_ID,
      tenantId: TENANT_ID,
      organizationId: ORGANIZATION_ID,
      storageProvider: 'primary.s3',
      storageKey: 'tenant/object-key',
      fileName: 'Board Pack.pdf',
      mimeType: 'application/pdf',
      fileSize: 1_024n,
      checksum: CHECKSUM,
    });
    expect(file).toEqual(record());
    expect(publisher.events).toHaveLength(1);
    expect(publisher.events[0]).toMatchObject({
      name: 'file.registered',
      actorUserId: ACTOR_ID,
      tenantId: TENANT_ID,
      organizationId: ORGANIZATION_ID,
      fileId: FILE_ID,
    });
    expect(publisher.events[0]).not.toHaveProperty('storageProvider');
    expect(publisher.events[0]).not.toHaveProperty('storageKey');
    expect(publisher.events[0]).not.toHaveProperty('fileName');
    expect(publisher.events[0]).not.toHaveProperty('mimeType');
    expect(publisher.events[0]).not.toHaveProperty('checksum');
  });

  it('requires files.register before repository access', async () => {
    const repository = new FakeFileRepository();
    const service = new FilesService(repository, new RecordingFileEventPublisher());

    await expect(service.registerCurrentOrganizationFile(context(), input())).rejects.toMatchObject(
      {
        code: 'FILE_FORBIDDEN',
      },
    );
    expect(repository.registerInput).toBeNull();
  });

  it.each([
    ['storage provider', input({ storageProvider: 'ends-with-' })],
    ['storage key', input({ storageKey: 'bad\u0000key' })],
    ['UTF-8 storage key byte length', input({ storageKey: '\u00e9'.repeat(1_025) })],
    ['file name', input({ fileName: '../secret.pdf' })],
    ['mime type', input({ mimeType: 'application/pdf; charset=utf-8' })],
    ['negative file size', input({ fileSize: -1n })],
    ['oversized file size', input({ fileSize: 9_223_372_036_854_775_808n })],
    ['checksum', input({ checksum: 'a'.repeat(64) })],
  ])('rejects invalid %s metadata before repository access', async (_label, invalidInput) => {
    const repository = new FakeFileRepository();
    const service = new FilesService(repository, new RecordingFileEventPublisher());

    await expect(
      service.registerCurrentOrganizationFile(context(FILE_PERMISSIONS.register), invalidInput),
    ).rejects.toMatchObject({ code: 'FILE_INVALID_INPUT' });
    expect(repository.registerInput).toBeNull();
  });

  it.each([
    ['conflict', 'FILE_CONFLICT'],
    ['actor_unavailable', 'FILE_ACTOR_UNAVAILABLE'],
    ['organization_unavailable', 'FILE_ORGANIZATION_UNAVAILABLE'],
  ] as const)('maps repository %s results to stable errors', async (status, code) => {
    const repository = new FakeFileRepository();
    repository.registerResult = { status };
    const service = new FilesService(repository, new RecordingFileEventPublisher());

    await expect(
      service.registerCurrentOrganizationFile(context(FILE_PERMISSIONS.register), input()),
    ).rejects.toMatchObject({ code });
  });

  it('lists bounded current-organization metadata with a scoped cursor', async () => {
    const repository = new FakeFileRepository();
    repository.listResult = {
      status: 'available',
      items: [record()],
      nextCursor: FILE_ID,
    };
    const service = new FilesService(repository, new RecordingFileEventPublisher());

    const page = await service.listCurrentOrganizationFiles(context(FILE_PERMISSIONS.view), {
      limit: 25,
      afterId: FILE_ID.toUpperCase(),
    });

    expect(repository.listInput).toEqual({
      tenantId: TENANT_ID,
      organizationId: ORGANIZATION_ID,
      limit: 25,
      afterId: FILE_ID,
    });
    expect(page).toEqual({ items: [record()], nextCursor: FILE_ID });
    expect(Object.isFrozen(page)).toBe(true);
    expect(Object.isFrozen(page.items)).toBe(true);
  });

  it('uses a bounded default list size', async () => {
    const repository = new FakeFileRepository();
    const service = new FilesService(repository, new RecordingFileEventPublisher());

    await service.listCurrentOrganizationFiles(context(FILE_PERMISSIONS.view));

    expect(repository.listInput).toMatchObject({ limit: 50 });
  });

  it('requires files.view and validates list input before repository access', async () => {
    const repository = new FakeFileRepository();
    const service = new FilesService(repository, new RecordingFileEventPublisher());

    await expect(service.listCurrentOrganizationFiles(context())).rejects.toMatchObject({
      code: 'FILE_FORBIDDEN',
    });
    await expect(
      service.listCurrentOrganizationFiles(context(FILE_PERMISSIONS.view), { limit: 101 }),
    ).rejects.toMatchObject({ code: 'FILE_INVALID_INPUT' });
    await expect(
      service.listCurrentOrganizationFiles(context(FILE_PERMISSIONS.view), {
        afterId: 'not-a-uuid',
      }),
    ).rejects.toMatchObject({ code: 'FILE_INVALID_INPUT' });
    expect(repository.listInput).toBeNull();
  });

  it.each([
    ['cursor_invalid', 'FILE_CURSOR_INVALID'],
    ['organization_unavailable', 'FILE_ORGANIZATION_UNAVAILABLE'],
  ] as const)('maps list %s results to stable errors', async (status, code) => {
    const repository = new FakeFileRepository();
    repository.listResult = { status };
    const service = new FilesService(repository, new RecordingFileEventPublisher());

    await expect(
      service.listCurrentOrganizationFiles(context(FILE_PERMISSIONS.view)),
    ).rejects.toMatchObject({ code });
  });

  it('fails closed on cross-Tenant repository records', async () => {
    const repository = new FakeFileRepository();
    repository.listResult = {
      status: 'available',
      items: [record({ tenantId: FOREIGN_TENANT_ID })],
      nextCursor: null,
    };
    const service = new FilesService(repository, new RecordingFileEventPublisher());

    await expect(
      service.listCurrentOrganizationFiles(context(FILE_PERMISSIONS.view)),
    ).rejects.toMatchObject({ code: 'FILE_INTEGRITY_FAILURE' });
  });

  it.each([
    record({ fileName: '../secret.pdf' }),
    record({ mimeType: 'application/pdf; charset=utf-8' }),
    record({ fileSize: -1n }),
    record({ createdAt: new Date(Number.NaN) }),
  ])('fails closed on malformed stored metadata', async (malformed) => {
    const repository = new FakeFileRepository();
    repository.listResult = {
      status: 'available',
      items: [malformed],
      nextCursor: null,
    };
    const service = new FilesService(repository, new RecordingFileEventPublisher());

    await expect(
      service.listCurrentOrganizationFiles(context(FILE_PERMISSIONS.view)),
    ).rejects.toMatchObject({ code: 'FILE_INTEGRITY_FAILURE' });
  });

  it('rejects oversized pages and malformed repository cursors', async () => {
    const repository = new FakeFileRepository();
    repository.listResult = {
      status: 'available',
      items: [record(), record({ id: '00000000-0000-4000-8000-000000000006' })],
      nextCursor: null,
    };
    const service = new FilesService(repository, new RecordingFileEventPublisher());

    await expect(
      service.listCurrentOrganizationFiles(context(FILE_PERMISSIONS.view), { limit: 1 }),
    ).rejects.toMatchObject({ code: 'FILE_INTEGRITY_FAILURE' });

    repository.listResult = {
      status: 'available',
      items: [],
      nextCursor: 'not-a-uuid',
    };
    await expect(
      service.listCurrentOrganizationFiles(context(FILE_PERMISSIONS.view)),
    ).rejects.toMatchObject({ code: 'FILE_INTEGRITY_FAILURE' });
  });
});
