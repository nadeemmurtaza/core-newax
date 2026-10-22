import type { OrganizationRepository } from '../database/organization-repository';
import type { OrganizationEventPublisher } from '../events/organization-event';
import { OrganizationModuleError } from '../errors/organization-module-error';
import {
  ORGANIZATION_PERMISSIONS,
  type OrganizationPermission,
} from '../permissions/organization-permissions';
import type {
  CreateOrganizationInput,
  CurrentOrganizationProfile,
  CurrentOrganizationRequestContext,
  OrganizationListQuery,
  OrganizationPage,
  OrganizationRecord,
  OrganizationRequestContext,
  UpdateOrganizationInput,
  UpdateOrganizationRecordInput,
} from '../types/organization';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

type Mutable<T> = {
  -readonly [Key in keyof T]: T[Key];
};

export class OrganizationsService {
  constructor(
    private readonly repository: OrganizationRepository,
    private readonly eventPublisher: OrganizationEventPublisher,
  ) {}

  async create(
    context: OrganizationRequestContext,
    input: CreateOrganizationInput,
  ): Promise<OrganizationRecord> {
    this.requirePermission(context, ORGANIZATION_PERMISSIONS.create);

    const tenantId = this.requireTrustedUuid(context.tenantId, 'context.tenantId');
    const parentOrganizationId = input.parentOrganizationId ?? null;
    await this.validateParent(tenantId, parentOrganizationId);

    const organization = await this.repository.create({
      tenantId,
      parentOrganizationId,
      legalName: this.requireText(input.legalName, 'legalName'),
      displayName: this.requireText(input.displayName, 'displayName'),
      organizationType: this.requireText(input.organizationType, 'organizationType'),
      registrationNumber: this.normalizeNullableText(input.registrationNumber),
      taxNumber: this.normalizeNullableText(input.taxNumber),
    });

    await this.eventPublisher.publish({
      name: 'organization.created',
      actorUserId: context.actorUserId,
      tenantId: organization.tenantId,
      organizationId: organization.id,
      occurredAt: new Date(),
      organization,
    });

    return organization;
  }

  async getById(
    context: OrganizationRequestContext,
    organizationId: string,
  ): Promise<OrganizationRecord> {
    this.requirePermission(context, ORGANIZATION_PERMISSIONS.view);
    return this.requireOrganization(
      this.requireTrustedUuid(context.tenantId, 'context.tenantId'),
      organizationId,
    );
  }

  async getCurrent(
    context: CurrentOrganizationRequestContext,
  ): Promise<CurrentOrganizationProfile> {
    this.requireTrustedUuid(context.actorUserId, 'context.actorUserId');
    this.requirePermission(context, ORGANIZATION_PERMISSIONS.view);
    const tenantId = this.requireTrustedUuid(context.tenantId, 'context.tenantId');
    const organizationId = this.requireTrustedUuid(
      context.organizationId,
      'context.organizationId',
    );
    const organization = await this.repository.findById(tenantId, organizationId);

    if (
      organization === null ||
      organization.status !== 'active' ||
      organization.deletedAt !== null
    ) {
      throw new OrganizationModuleError(
        'ORGANIZATION_NOT_FOUND',
        'The current organization is unavailable.',
      );
    }

    const persistedId = this.requireTrustedUuid(organization.id, 'organization.id');
    const persistedTenantId = this.requireTrustedUuid(
      organization.tenantId,
      'organization.tenantId',
    );
    if (persistedId !== organizationId || persistedTenantId !== tenantId) {
      throw new OrganizationModuleError(
        'ORGANIZATION_INTEGRITY_FAILURE',
        'The organization repository returned a record outside the trusted organization boundary.',
      );
    }

    const createdAt = this.requireDate(organization.createdAt, 'organization.createdAt');
    const updatedAt = this.requireDate(organization.updatedAt, 'organization.updatedAt');
    if (updatedAt.getTime() < createdAt.getTime()) {
      throw new OrganizationModuleError(
        'ORGANIZATION_INTEGRITY_FAILURE',
        'The organization record contains an invalid update timestamp.',
      );
    }

    return Object.freeze({
      id: persistedId,
      tenantId: persistedTenantId,
      legalName: this.requireStoredText(organization.legalName, 'organization.legalName', 255),
      displayName: this.requireStoredText(
        organization.displayName,
        'organization.displayName',
        255,
      ),
      organizationType: this.requireStoredText(
        organization.organizationType,
        'organization.organizationType',
        64,
      ),
      status: 'active',
      createdAt: new Date(createdAt.getTime()),
      updatedAt: new Date(updatedAt.getTime()),
    });
  }

  async list(
    context: OrganizationRequestContext,
    query: OrganizationListQuery = {},
  ): Promise<OrganizationPage> {
    this.requirePermission(context, ORGANIZATION_PERMISSIONS.view);

    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
      throw new OrganizationModuleError(
        'ORGANIZATION_INVALID_INPUT',
        `limit must be an integer between 1 and ${String(MAX_PAGE_SIZE)}.`,
        { field: 'limit' },
      );
    }

    const normalizedQuery: Mutable<OrganizationListQuery> = { limit };

    if ('parentOrganizationId' in query) {
      normalizedQuery.parentOrganizationId = query.parentOrganizationId ?? null;
    }

    if (query.status !== undefined) {
      normalizedQuery.status = query.status;
    }

    if (query.search !== undefined) {
      const search = query.search.trim();
      if (search.length > 0) {
        normalizedQuery.search = search;
      }
    }

    if (query.afterId !== undefined) {
      normalizedQuery.afterId = this.requireText(query.afterId, 'afterId');
    }

    return this.repository.list(
      this.requireTrustedUuid(context.tenantId, 'context.tenantId'),
      normalizedQuery,
    );
  }

  async update(
    context: OrganizationRequestContext,
    organizationId: string,
    input: UpdateOrganizationInput,
  ): Promise<OrganizationRecord> {
    this.requirePermission(context, ORGANIZATION_PERMISSIONS.update);
    const tenantId = this.requireTrustedUuid(context.tenantId, 'context.tenantId');
    const current = await this.requireOrganization(tenantId, organizationId);

    if (current.status === 'archived') {
      throw new OrganizationModuleError(
        'ORGANIZATION_INVALID_INPUT',
        'Archived organizations cannot be updated.',
        { organizationId },
      );
    }

    const update: Mutable<UpdateOrganizationRecordInput> = {};

    if ('parentOrganizationId' in input) {
      const parentOrganizationId = input.parentOrganizationId ?? null;

      if (parentOrganizationId === organizationId) {
        throw new OrganizationModuleError(
          'ORGANIZATION_HIERARCHY_CYCLE',
          'An organization cannot be its own parent.',
          { organizationId, parentOrganizationId },
        );
      }

      await this.validateParent(tenantId, parentOrganizationId);

      if (
        parentOrganizationId !== null &&
        (await this.repository.wouldCreateCycle(tenantId, organizationId, parentOrganizationId))
      ) {
        throw new OrganizationModuleError(
          'ORGANIZATION_HIERARCHY_CYCLE',
          'The selected parent would create an organization hierarchy cycle.',
          { organizationId, parentOrganizationId },
        );
      }

      update.parentOrganizationId = parentOrganizationId;
    }

    if (input.legalName !== undefined) {
      update.legalName = this.requireText(input.legalName, 'legalName');
    }

    if (input.displayName !== undefined) {
      update.displayName = this.requireText(input.displayName, 'displayName');
    }

    if (input.organizationType !== undefined) {
      update.organizationType = this.requireText(input.organizationType, 'organizationType');
    }

    if ('registrationNumber' in input) {
      update.registrationNumber = this.normalizeNullableText(input.registrationNumber);
    }

    if ('taxNumber' in input) {
      update.taxNumber = this.normalizeNullableText(input.taxNumber);
    }

    if (Object.keys(update).length === 0) {
      throw new OrganizationModuleError(
        'ORGANIZATION_INVALID_INPUT',
        'At least one organization field must be supplied for update.',
      );
    }

    const organization = await this.repository.update(tenantId, organizationId, update);

    await this.eventPublisher.publish({
      name: 'organization.updated',
      actorUserId: context.actorUserId,
      tenantId: organization.tenantId,
      organizationId: organization.id,
      occurredAt: new Date(),
      organization,
    });

    return organization;
  }

  async archive(
    context: OrganizationRequestContext,
    organizationId: string,
  ): Promise<OrganizationRecord> {
    this.requirePermission(context, ORGANIZATION_PERMISSIONS.archive);
    const tenantId = this.requireTrustedUuid(context.tenantId, 'context.tenantId');
    const current = await this.requireOrganization(tenantId, organizationId);

    if (current.status === 'archived') {
      return current;
    }

    if (await this.repository.hasActiveChildren(tenantId, organizationId)) {
      throw new OrganizationModuleError(
        'ORGANIZATION_HAS_ACTIVE_CHILDREN',
        'An organization with active child organizations cannot be archived.',
        { organizationId },
      );
    }

    const organization = await this.repository.archive(tenantId, organizationId, new Date());

    await this.eventPublisher.publish({
      name: 'organization.archived',
      actorUserId: context.actorUserId,
      tenantId: organization.tenantId,
      organizationId: organization.id,
      occurredAt: new Date(),
      organization,
    });

    return organization;
  }

  private requirePermission(
    context: OrganizationRequestContext,
    permission: OrganizationPermission,
  ): void {
    this.requireTrustedUuid(context.tenantId, 'context.tenantId');
    if (context.actorUserId.trim().length === 0) {
      throw new OrganizationModuleError(
        'ORGANIZATION_INVALID_INPUT',
        'actorUserId is required for organization operations.',
      );
    }

    if (!context.permissionCodes.has(permission)) {
      throw new OrganizationModuleError(
        'ORGANIZATION_FORBIDDEN',
        `The operation requires the ${permission} permission.`,
        { permission },
      );
    }
  }

  private async requireOrganization(
    tenantId: string,
    organizationId: string,
  ): Promise<OrganizationRecord> {
    const id = this.requireText(organizationId, 'organizationId');
    const organization = await this.repository.findById(tenantId, id);

    if (organization === null || organization.tenantId !== tenantId) {
      throw new OrganizationModuleError(
        'ORGANIZATION_NOT_FOUND',
        'The organization does not exist.',
        { organizationId: id },
      );
    }

    return organization;
  }

  private async validateParent(
    tenantId: string,
    parentOrganizationId: string | null,
  ): Promise<void> {
    if (parentOrganizationId === null) {
      return;
    }

    const parent = await this.repository.findById(
      tenantId,
      this.requireText(parentOrganizationId, 'parentOrganizationId'),
    );

    if (parent === null) {
      throw new OrganizationModuleError(
        'ORGANIZATION_PARENT_NOT_FOUND',
        'The parent organization does not exist.',
        { parentOrganizationId },
      );
    }

    if (parent.status === 'archived') {
      throw new OrganizationModuleError(
        'ORGANIZATION_PARENT_ARCHIVED',
        'An archived organization cannot be selected as a parent.',
        { parentOrganizationId },
      );
    }
  }

  private requireTrustedUuid(value: string, field: string): string {
    const normalized = value.trim().toLowerCase();
    if (!UUID_PATTERN.test(normalized)) {
      throw new OrganizationModuleError(
        'ORGANIZATION_INTEGRITY_FAILURE',
        `${field} must be a valid UUID.`,
      );
    }
    return normalized;
  }

  private requireStoredText(value: string, field: string, maximumLength: number): string {
    if (
      typeof value !== 'string' ||
      value.length === 0 ||
      value.length > maximumLength ||
      value.trim() !== value
    ) {
      throw new OrganizationModuleError('ORGANIZATION_INTEGRITY_FAILURE', `${field} is invalid.`);
    }
    return value;
  }

  private requireDate(value: Date, field: string): Date {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      throw new OrganizationModuleError(
        'ORGANIZATION_INTEGRITY_FAILURE',
        `${field} must be a valid date.`,
      );
    }
    return value;
  }

  private requireText(value: string, field: string): string {
    const normalized = value.trim();

    if (normalized.length === 0) {
      throw new OrganizationModuleError(
        'ORGANIZATION_INVALID_INPUT',
        `${field} must not be empty.`,
        { field },
      );
    }

    return normalized;
  }

  private normalizeNullableText(value: string | null | undefined): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = value.trim();
    return normalized.length === 0 ? null : normalized;
  }
}
