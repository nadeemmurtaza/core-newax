import { RequestContextError } from '../errors/request-context-error';
import type {
  OrganizationContextCapabilitySummary,
  OrganizationContextConfirmation,
  OrganizationContextConfirmationRecord,
  TrustedMembershipStatus,
  TrustedOrganizationRequestContext,
  TrustedOrganizationStatus,
  TrustedTenantStatus,
} from '../types/request-context';
import type { OrganizationContextConfirmationDirectory } from './request-context-ports';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const ORGANIZATION_MANAGE_PERMISSIONS = [
  'organizations.create',
  'organizations.update',
  'organizations.archive',
] as const;
const PEOPLE_MANAGE_PERMISSIONS = [
  'people.create',
  'people.update',
  'people.archive',
  'people.identifiers.manage',
] as const;
const MEMBERSHIP_MANAGE_PERMISSIONS = [
  'memberships.create',
  'memberships.update',
  'memberships.remove',
] as const;
const USER_VIEW_PERMISSIONS = ['users.view', 'users.identities.view'] as const;
const USER_MANAGE_PERMISSIONS = [
  'users.create',
  'users.suspend',
  'users.disable',
  'users.enable',
  'users.archive',
  'users.identities.manage',
] as const;
const ACCESS_CONTROL_VIEW_PERMISSIONS = [
  'access_control.permissions.view',
  'access_control.roles.view',
  'access_control.assignments.view',
] as const;
const ACCESS_CONTROL_MANAGE_PERMISSIONS = [
  'access_control.permissions.manage',
  'access_control.roles.create',
  'access_control.roles.update',
  'access_control.roles.archive',
  'access_control.roles.permissions.manage',
  'access_control.assignments.manage',
  'access_control.templates.manage',
] as const;

export class OrganizationContextConfirmationService {
  constructor(private readonly directory: OrganizationContextConfirmationDirectory) {}

  async confirm(
    context: TrustedOrganizationRequestContext,
  ): Promise<OrganizationContextConfirmation> {
    const trusted = this.assertOrganizationContext(context);
    const record = await this.directory.findConfirmationRecord(trusted.membershipId);

    if (record === null) {
      throw this.membershipUnavailable();
    }

    const validated = this.validateRecord(record);
    if (
      validated.membershipId !== trusted.membershipId ||
      validated.personId !== trusted.personId ||
      validated.tenantId !== trusted.tenantId ||
      validated.organizationId !== trusted.organizationId
    ) {
      throw this.integrityFailure(
        'Organization context confirmation did not match the trusted request boundary.',
      );
    }

    if (
      validated.membershipStatus !== 'active' ||
      validated.tenantStatus !== 'active' ||
      validated.organizationStatus !== 'active'
    ) {
      throw this.membershipUnavailable();
    }

    const capabilities = Object.freeze(this.summarizeCapabilities(context.permissionCodes));

    return Object.freeze({
      membershipId: validated.membershipId,
      tenantId: validated.tenantId,
      organizationId: validated.organizationId,
      organizationDisplayName: validated.organizationDisplayName,
      organizationType: validated.organizationType,
      membershipType: validated.membershipType,
      jobTitle: validated.jobTitle,
      sessionExpiresAt: new Date(trusted.sessionExpiresAt.getTime()),
      permissionsEvaluatedAt: new Date(trusted.evaluatedAt.getTime()),
      capabilities,
    });
  }

  private assertOrganizationContext(context: TrustedOrganizationRequestContext): {
    readonly personId: string;
    readonly membershipId: string;
    readonly tenantId: string;
    readonly organizationId: string;
    readonly sessionExpiresAt: Date;
    readonly evaluatedAt: Date;
  } {
    if (context.scope !== 'organization') {
      throw this.integrityFailure(
        'Organization context confirmation requires trusted organization context.',
      );
    }

    this.requireUuid(context.userId, 'context.userId');
    const personId = this.requireUuid(context.personId, 'context.personId');
    this.requireUuid(context.sessionId, 'context.sessionId');
    const membershipId = this.requireUuid(context.membershipId, 'context.membershipId');
    const tenantId = this.requireUuid(context.tenantId, 'context.tenantId');
    const organizationId = this.requireUuid(context.organizationId, 'context.organizationId');
    this.requireText(context.requestId, 'context.requestId', 128);
    const sessionExpiresAt = this.requireDate(context.sessionExpiresAt, 'context.sessionExpiresAt');
    const evaluatedAt = this.requireDate(context.evaluatedAt, 'context.evaluatedAt');

    if (evaluatedAt.getTime() > sessionExpiresAt.getTime()) {
      throw this.integrityFailure('Permission evaluation cannot occur after session expiry.');
    }
    if (
      context.permissionCodes === null ||
      typeof context.permissionCodes !== 'object' ||
      typeof context.permissionCodes.has !== 'function'
    ) {
      throw this.integrityFailure('Organization context did not contain a valid permission set.');
    }

    return {
      personId,
      membershipId,
      tenantId,
      organizationId,
      sessionExpiresAt,
      evaluatedAt,
    };
  }

  private validateRecord(
    record: OrganizationContextConfirmationRecord,
  ): OrganizationContextConfirmationRecord {
    return {
      membershipId: this.requireUuid(record.membershipId, 'confirmation.membershipId'),
      personId: this.requireUuid(record.personId, 'confirmation.personId'),
      tenantId: this.requireUuid(record.tenantId, 'confirmation.tenantId'),
      tenantStatus: this.requireTenantStatus(record.tenantStatus),
      organizationId: this.requireUuid(record.organizationId, 'confirmation.organizationId'),
      organizationDisplayName: this.requireText(
        record.organizationDisplayName,
        'confirmation.organizationDisplayName',
        255,
      ),
      organizationType: this.requireText(
        record.organizationType,
        'confirmation.organizationType',
        64,
      ),
      organizationStatus: this.requireOrganizationStatus(record.organizationStatus),
      membershipType: this.requireText(record.membershipType, 'confirmation.membershipType', 64),
      membershipStatus: this.requireMembershipStatus(record.membershipStatus),
      jobTitle: this.requireNullableText(record.jobTitle, 'confirmation.jobTitle', 128),
    };
  }

  private summarizeCapabilities(
    permissions: ReadonlySet<string>,
  ): OrganizationContextCapabilitySummary {
    return {
      organizationView: permissions.has('organizations.view'),
      organizationManage: this.hasAny(permissions, ORGANIZATION_MANAGE_PERMISSIONS),
      peopleView: permissions.has('people.view'),
      peopleManage: this.hasAny(permissions, PEOPLE_MANAGE_PERMISSIONS),
      membershipsView: permissions.has('memberships.view'),
      membershipsManage: this.hasAny(permissions, MEMBERSHIP_MANAGE_PERMISSIONS),
      usersView: this.hasAny(permissions, USER_VIEW_PERMISSIONS),
      usersManage: this.hasAny(permissions, USER_MANAGE_PERMISSIONS),
      accessControlView: this.hasAny(permissions, ACCESS_CONTROL_VIEW_PERMISSIONS),
      accessControlManage: this.hasAny(permissions, ACCESS_CONTROL_MANAGE_PERMISSIONS),
    };
  }

  private hasAny(permissions: ReadonlySet<string>, required: readonly string[]): boolean {
    return required.some((permission) => permissions.has(permission));
  }

  private requireTenantStatus(value: string): TrustedTenantStatus {
    if (value === 'active' || value === 'suspended' || value === 'archived') {
      return value;
    }
    throw this.integrityFailure('confirmation.tenantStatus is invalid.');
  }

  private requireMembershipStatus(value: string): TrustedMembershipStatus {
    if (value === 'active' || value === 'suspended' || value === 'ended') {
      return value;
    }
    throw this.integrityFailure('confirmation.membershipStatus is invalid.');
  }

  private requireOrganizationStatus(value: string): TrustedOrganizationStatus {
    if (value === 'active' || value === 'suspended' || value === 'archived') {
      return value;
    }
    throw this.integrityFailure('confirmation.organizationStatus is invalid.');
  }

  private requireUuid(value: string, field: string): string {
    if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
      throw this.integrityFailure(`${field} must be a valid UUID.`);
    }
    return value.toLowerCase();
  }

  private requireText(value: string, field: string, maximumLength: number): string {
    if (
      typeof value !== 'string' ||
      value.length === 0 ||
      value.length > maximumLength ||
      value.trim() !== value
    ) {
      throw this.integrityFailure(`${field} is invalid.`);
    }
    return value;
  }

  private requireNullableText(
    value: string | null,
    field: string,
    maximumLength: number,
  ): string | null {
    return value === null ? null : this.requireText(value, field, maximumLength);
  }

  private requireDate(value: Date, field: string): Date {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      throw this.integrityFailure(`${field} must be a valid date.`);
    }
    return value;
  }

  private membershipUnavailable(): RequestContextError {
    return new RequestContextError(
      'REQUEST_CONTEXT_MEMBERSHIP_UNAVAILABLE',
      'The selected membership is unavailable for this authenticated account.',
    );
  }

  private integrityFailure(message: string): RequestContextError {
    return new RequestContextError('REQUEST_CONTEXT_INTEGRITY_FAILURE', message);
  }
}
