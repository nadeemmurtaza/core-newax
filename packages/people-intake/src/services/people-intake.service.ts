import type { PeopleIntakeRepository } from '../database/people-intake-repository';
import { PeopleIntakeModuleError } from '../errors/people-intake-module-error';
import {
  PEOPLE_INTAKE_PERMISSIONS,
  type PeopleIntakePermission,
} from '../permissions/people-intake-permissions';
import type {
  CreatePeopleIntakeDraftInput,
  PeopleIntakeListQuery,
  PeopleIntakePage,
  PeopleIntakeRecord,
  PeopleIntakeRequestContext,
  PeopleIntakeReviewDecision,
  PeopleIntakeStatus,
  PeopleIntakeSummary,
  ReviewPeopleIntakeInput,
  StoredPeopleIntakeRecord,
  SubmitPeopleIntakeInput,
  UpdatePeopleIntakeDraftInput,
} from '../types/people-intake';
import { PeopleIntakeValidator } from './people-intake-validator';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const CODE_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u;
const STATUSES: ReadonlySet<string> = new Set(['draft', 'submitted', 'approved', 'rejected']);

export class PeopleIntakeService {
  private readonly validator = new PeopleIntakeValidator();

  constructor(private readonly repository: PeopleIntakeRepository) {}

  async createDraft(
    context: PeopleIntakeRequestContext,
    input: CreatePeopleIntakeDraftInput,
  ): Promise<PeopleIntakeRecord> {
    this.requirePermission(context, PEOPLE_INTAKE_PERMISSIONS.create);
    const scoped = this.scope(context);
    const payload = this.validator.normalizePayload(input.payload);
    const result = await this.repository.createDraft({
      ...scoped,
      actorUserId: scoped.actorUserId,
      title: this.text(input.title, 'title', 128),
      sourceType: this.code(input.sourceType, 'sourceType', 64),
      sourceReference: this.nullableText(input.sourceReference, 'sourceReference', 255),
      payload,
      personCount: payload.people.length,
      relationshipCount: payload.relationships.length,
    });
    if (result.status === 'organization_unavailable') {
      throw new PeopleIntakeModuleError(
        'PEOPLE_INTAKE_ORGANIZATION_UNAVAILABLE',
        'The current organization is unavailable for People Intake.',
      );
    }
    return this.record(result.intake);
  }

  async get(context: PeopleIntakeRequestContext, intakeId: string): Promise<PeopleIntakeRecord> {
    this.requirePermission(context, PEOPLE_INTAKE_PERMISSIONS.view);
    const scoped = this.scope(context);
    const record = await this.repository.findById({
      id: this.inputUuid(intakeId, 'intakeId'),
      tenantId: scoped.tenantId,
      organizationId: scoped.organizationId,
    });
    if (record === null) {
      throw new PeopleIntakeModuleError('PEOPLE_INTAKE_NOT_FOUND', 'The intake does not exist.');
    }
    return this.record(record);
  }

  async list(
    context: PeopleIntakeRequestContext,
    query: PeopleIntakeListQuery = {},
  ): Promise<PeopleIntakePage> {
    this.requirePermission(context, PEOPLE_INTAKE_PERMISSIONS.view);
    const scoped = this.scope(context);
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
      this.invalid('limit', `limit must be between 1 and ${String(MAX_PAGE_SIZE)}.`);
    }
    const input: {
      tenantId: string;
      organizationId: string;
      limit: number;
      status?: PeopleIntakeStatus;
      afterId?: string;
    } = {
      tenantId: scoped.tenantId,
      organizationId: scoped.organizationId,
      limit,
    };
    if (query.status !== undefined) {
      input.status = this.status(query.status);
    }
    if (query.afterId !== undefined) {
      input.afterId = this.inputUuid(query.afterId, 'afterId');
    }
    const result = await this.repository.list(input);
    if (result.status === 'organization_unavailable') {
      throw new PeopleIntakeModuleError(
        'PEOPLE_INTAKE_ORGANIZATION_UNAVAILABLE',
        'The current organization is unavailable for People Intake.',
      );
    }
    if (result.status === 'cursor_invalid') {
      throw new PeopleIntakeModuleError(
        'PEOPLE_INTAKE_CURSOR_INVALID',
        'The intake cursor is invalid for the current organization.',
      );
    }
    return {
      items: result.items.map((item) => this.summary(item)),
      nextCursor: result.nextCursor,
    };
  }

  async updateDraft(
    context: PeopleIntakeRequestContext,
    intakeId: string,
    input: UpdatePeopleIntakeDraftInput,
  ): Promise<PeopleIntakeRecord> {
    this.requirePermission(context, PEOPLE_INTAKE_PERMISSIONS.update);
    const scoped = this.scope(context);
    const payload = this.validator.normalizePayload(input.payload);
    const result = await this.repository.updateDraft({
      id: this.inputUuid(intakeId, 'intakeId'),
      ...scoped,
      actorUserId: scoped.actorUserId,
      expectedVersion: this.version(input.expectedVersion),
      title: this.text(input.title, 'title', 128),
      sourceType: this.code(input.sourceType, 'sourceType', 64),
      sourceReference: this.nullableText(input.sourceReference, 'sourceReference', 255),
      payload,
      personCount: payload.people.length,
      relationshipCount: payload.relationships.length,
    });
    return this.changed(result);
  }

  async submit(
    context: PeopleIntakeRequestContext,
    intakeId: string,
    input: SubmitPeopleIntakeInput,
  ): Promise<PeopleIntakeRecord> {
    this.requirePermission(context, PEOPLE_INTAKE_PERMISSIONS.submit);
    const scoped = this.scope(context);
    const result = await this.repository.submit({
      id: this.inputUuid(intakeId, 'intakeId'),
      tenantId: scoped.tenantId,
      organizationId: scoped.organizationId,
      actorUserId: scoped.actorUserId,
      expectedVersion: this.version(input.expectedVersion),
      submittedAt: new Date(),
    });
    if (result.status === 'submitted') {
      return this.record(result.intake);
    }
    return this.transitionError(result.status);
  }

  async review(
    context: PeopleIntakeRequestContext,
    intakeId: string,
    input: ReviewPeopleIntakeInput,
  ): Promise<PeopleIntakeRecord> {
    this.requirePermission(context, PEOPLE_INTAKE_PERMISSIONS.review);
    const scoped = this.scope(context);
    const decision = this.decision(input.decision);
    const notes = this.nullableText(input.notes, 'notes', 2_000);
    if (decision === 'rejected' && notes === null) {
      this.invalid('notes', 'A rejection requires reviewer notes.');
    }
    const result = await this.repository.review({
      id: this.inputUuid(intakeId, 'intakeId'),
      tenantId: scoped.tenantId,
      organizationId: scoped.organizationId,
      reviewerUserId: scoped.actorUserId,
      expectedVersion: this.version(input.expectedVersion),
      decision,
      notes,
      reviewedAt: new Date(),
    });
    if (result.status === 'reviewed') {
      return this.record(result.intake);
    }
    if (result.status === 'self_review') {
      throw new PeopleIntakeModuleError(
        'PEOPLE_INTAKE_FORBIDDEN',
        'The creator of an intake cannot review the same submission.',
      );
    }
    return this.transitionError(result.status);
  }

  private changed(
    result:
      | { readonly status: 'updated'; readonly intake: StoredPeopleIntakeRecord }
      | { readonly status: 'not_found' }
      | { readonly status: 'version_conflict' }
      | { readonly status: 'state_conflict' }
      | { readonly status: 'creator_mismatch' },
  ): PeopleIntakeRecord {
    if (result.status === 'updated') {
      return this.record(result.intake);
    }
    if (result.status === 'creator_mismatch') {
      throw new PeopleIntakeModuleError(
        'PEOPLE_INTAKE_FORBIDDEN',
        'Only the intake creator can edit the draft.',
      );
    }
    return this.transitionError(result.status);
  }

  private transitionError(
    status: 'not_found' | 'version_conflict' | 'state_conflict' | 'creator_mismatch',
  ): never {
    if (status === 'not_found') {
      throw new PeopleIntakeModuleError('PEOPLE_INTAKE_NOT_FOUND', 'The intake does not exist.');
    }
    if (status === 'creator_mismatch') {
      throw new PeopleIntakeModuleError(
        'PEOPLE_INTAKE_FORBIDDEN',
        'Only the intake creator can submit the draft.',
      );
    }
    if (status === 'version_conflict') {
      throw new PeopleIntakeModuleError(
        'PEOPLE_INTAKE_CONFLICT',
        'The intake changed after it was loaded. Reload before continuing.',
      );
    }
    throw new PeopleIntakeModuleError(
      'PEOPLE_INTAKE_STATE_CONFLICT',
      'The intake is not in the required workflow state.',
    );
  }

  private record(stored: StoredPeopleIntakeRecord): PeopleIntakeRecord {
    const summary = this.summary(stored);
    const payload = this.validator.normalizePayload(stored.payload as never);
    if (
      payload.people.length !== summary.personCount ||
      payload.relationships.length !== summary.relationshipCount
    ) {
      throw new PeopleIntakeModuleError(
        'PEOPLE_INTAKE_INTEGRITY_FAILURE',
        'The stored intake counts do not match its payload.',
      );
    }
    return { ...summary, payload };
  }

  private summary(summary: PeopleIntakeSummary): PeopleIntakeSummary {
    this.uuid(summary.id, 'intake.id');
    this.uuid(summary.tenantId, 'intake.tenantId');
    this.uuid(summary.organizationId, 'intake.organizationId');
    this.uuid(summary.createdByUserId, 'intake.createdByUserId');
    if (summary.reviewedByUserId !== null) {
      this.uuid(summary.reviewedByUserId, 'intake.reviewedByUserId');
    }
    this.status(summary.status);
    this.text(summary.title, 'intake.title', 128);
    this.code(summary.sourceType, 'intake.sourceType', 64);
    this.version(summary.version);
    if (
      !Number.isInteger(summary.personCount) ||
      summary.personCount < 1 ||
      summary.personCount > 50 ||
      !Number.isInteger(summary.relationshipCount) ||
      summary.relationshipCount < 0 ||
      summary.relationshipCount > 100
    ) {
      throw new PeopleIntakeModuleError(
        'PEOPLE_INTAKE_INTEGRITY_FAILURE',
        'The stored intake counts are invalid.',
      );
    }
    return summary;
  }

  private scope(context: PeopleIntakeRequestContext): {
    actorUserId: string;
    tenantId: string;
    organizationId: string;
  } {
    return {
      actorUserId: this.uuid(context.actorUserId, 'context.actorUserId'),
      tenantId: this.uuid(context.tenantId, 'context.tenantId'),
      organizationId: this.uuid(context.organizationId, 'context.organizationId'),
    };
  }

  private requirePermission(
    context: PeopleIntakeRequestContext,
    permission: PeopleIntakePermission,
  ): void {
    if (!context.permissionCodes.has(permission)) {
      throw new PeopleIntakeModuleError(
        'PEOPLE_INTAKE_FORBIDDEN',
        `The operation requires the ${permission} permission.`,
        { permission },
      );
    }
  }

  private status(value: PeopleIntakeStatus): PeopleIntakeStatus {
    if (!STATUSES.has(value)) {
      this.invalid('status', 'status is not supported.');
    }
    return value;
  }

  private decision(value: PeopleIntakeReviewDecision): PeopleIntakeReviewDecision {
    if (value !== 'approved' && value !== 'rejected') {
      this.invalid('decision', 'decision must be approved or rejected.');
    }
    return value;
  }

  private version(value: number): number {
    if (!Number.isInteger(value) || value < 1) {
      this.invalid('expectedVersion', 'expectedVersion must be a positive integer.');
    }
    return value;
  }

  private inputUuid(value: string, field: string): string {
    if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
      this.invalid(field, `${field} must be a UUID.`);
    }
    return value.toLowerCase();
  }

  private uuid(value: string, field: string): string {
    if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
      throw new PeopleIntakeModuleError(
        'PEOPLE_INTAKE_INTEGRITY_FAILURE',
        `${field} must be a UUID.`,
        { field },
      );
    }
    return value.toLowerCase();
  }

  private text(value: string, field: string, maximum: number): string {
    if (typeof value !== 'string') {
      this.invalid(field, `${field} must be text.`);
    }
    const normalized = value.trim();
    if (normalized.length < 1 || normalized.length > maximum) {
      this.invalid(field, `${field} must contain between 1 and ${String(maximum)} characters.`);
    }
    return normalized;
  }

  private nullableText(
    value: string | null | undefined,
    field: string,
    maximum: number,
  ): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    return this.text(value, field, maximum);
  }

  private code(value: string, field: string, maximum: number): string {
    const normalized = this.text(value, field, maximum).toLowerCase();
    if (!CODE_PATTERN.test(normalized)) {
      this.invalid(field, `${field} must be a lowercase machine-readable code.`);
    }
    return normalized;
  }

  private invalid(field: string, message: string): never {
    throw new PeopleIntakeModuleError('PEOPLE_INTAKE_INVALID_INPUT', message, { field });
  }
}
