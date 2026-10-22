import type { TenantRepository } from '../database/tenant-repository';
import type { TenantEventPublisher } from '../events/tenant-event';
import { TenantModuleError } from '../errors/tenant-module-error';
import { TENANT_PERMISSIONS, type TenantPermission } from '../permissions/tenant-permissions';
import type {
  CreateTenantInput,
  TenantListQuery,
  TenantPage,
  TenantRecord,
  TenantRequestContext,
} from '../types/tenant';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export class TenantsService {
  constructor(
    private readonly repository: TenantRepository,
    private readonly eventPublisher: TenantEventPublisher,
  ) {}

  async create(context: TenantRequestContext, input: CreateTenantInput): Promise<TenantRecord> {
    this.requirePermission(context, TENANT_PERMISSIONS.create);
    const tenant = await this.repository.create({ name: this.requireText(input.name, 'name') });
    this.assertRecordIntegrity(tenant);
    await this.eventPublisher.publish({
      name: 'tenant.created',
      actorUserId: context.actorUserId,
      tenantId: tenant.id,
      occurredAt: new Date(),
      tenant,
    });
    return tenant;
  }

  async getById(context: TenantRequestContext, tenantId: string): Promise<TenantRecord> {
    this.requirePermission(context, TENANT_PERMISSIONS.view);
    const id = this.requireUuid(tenantId, 'tenantId', 'TENANT_INVALID_INPUT');
    const tenant = await this.repository.findById(id);
    if (tenant === null || tenant.deletedAt !== null) {
      throw new TenantModuleError('TENANT_NOT_FOUND', 'The tenant does not exist.');
    }
    this.assertRecordIntegrity(tenant);
    return tenant;
  }

  async list(context: TenantRequestContext, query: TenantListQuery = {}): Promise<TenantPage> {
    this.requirePermission(context, TENANT_PERMISSIONS.view);
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
      throw new TenantModuleError(
        'TENANT_INVALID_INPUT',
        `limit must be an integer between 1 and ${String(MAX_PAGE_SIZE)}.`,
      );
    }
    const normalized: TenantListQuery = {
      limit,
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.search === undefined || query.search.trim().length === 0
        ? {}
        : { search: query.search.trim() }),
      ...(query.afterId === undefined
        ? {}
        : { afterId: this.requireUuid(query.afterId, 'afterId', 'TENANT_INVALID_INPUT') }),
    };
    const page = await this.repository.list(normalized);
    if (!Array.isArray(page.items) || page.items.length > limit) {
      throw new TenantModuleError('TENANT_INTEGRITY_FAILURE', 'The tenant page is invalid.');
    }
    page.items.forEach((tenant) => this.assertRecordIntegrity(tenant));
    if (page.nextCursor !== null) {
      this.requireUuid(page.nextCursor, 'nextCursor', 'TENANT_INTEGRITY_FAILURE');
    }
    return page;
  }

  private requirePermission(context: TenantRequestContext, permission: TenantPermission): void {
    this.requireUuid(context.actorUserId, 'context.actorUserId', 'TENANT_INVALID_INPUT');
    if (!context.permissionCodes.has(permission)) {
      throw new TenantModuleError('TENANT_FORBIDDEN', `The operation requires ${permission}.`);
    }
  }

  private assertRecordIntegrity(tenant: TenantRecord): void {
    this.requireUuid(tenant.id, 'tenant.id', 'TENANT_INTEGRITY_FAILURE');
    if (
      tenant.name.length === 0 ||
      tenant.name.length > 255 ||
      tenant.name.trim() !== tenant.name ||
      !['active', 'suspended', 'archived'].includes(tenant.status) ||
      !(tenant.createdAt instanceof Date) ||
      Number.isNaN(tenant.createdAt.getTime()) ||
      !(tenant.updatedAt instanceof Date) ||
      Number.isNaN(tenant.updatedAt.getTime()) ||
      tenant.updatedAt.getTime() < tenant.createdAt.getTime()
    ) {
      throw new TenantModuleError('TENANT_INTEGRITY_FAILURE', 'The tenant record is invalid.');
    }
  }

  private requireText(value: string, field: string): string {
    const normalized = value.trim();
    if (normalized.length === 0 || normalized.length > 255) {
      throw new TenantModuleError('TENANT_INVALID_INPUT', `${field} is invalid.`);
    }
    return normalized;
  }

  private requireUuid(
    value: string,
    field: string,
    code: 'TENANT_INTEGRITY_FAILURE' | 'TENANT_INVALID_INPUT',
  ): string {
    const normalized = value.trim().toLowerCase();
    if (!UUID_PATTERN.test(normalized)) {
      throw new TenantModuleError(code, `${field} must be a valid UUID.`);
    }
    return normalized;
  }
}
