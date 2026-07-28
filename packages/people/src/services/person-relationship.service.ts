import type { PersonRelationshipRepository } from '../database/person-relationship-repository';
import type {
  PersonRelationshipEventName,
  PersonRelationshipEventPublisher,
} from '../events/person-relationship-event';
import { PeopleModuleError } from '../errors/people-module-error';
import { PEOPLE_PERMISSIONS, type PeoplePermission } from '../permissions/people-permissions';
import type { PersonIdentifierRecord, PersonRecord } from '../types/person';
import type {
  CreatePersonRelationshipInput,
  EndPersonRelationshipInput,
  FamilyPersonIdentifierProjection,
  FamilyPersonNode,
  FamilyTreeGraph,
  FamilyTreeQuery,
  FamilyTreeRelationship,
  PersonRelationshipRecord,
  PersonRelationshipRequestContext,
  RevokePersonRelationshipVerificationInput,
  UpdatePersonRelationshipInput,
  UpdatePersonRelationshipRecordInput,
  VerifyPersonRelationshipInput,
} from '../types/person-relationship';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CODE_PATTERN = /^[a-z0-9][a-z0-9._-]*$/u;
const MAX_GRAPH_DEPTH = 4;
const MAX_GRAPH_NODES = 250;

export class PersonRelationshipService {
  constructor(
    private readonly repository: PersonRelationshipRepository,
    private readonly events: PersonRelationshipEventPublisher,
  ) {}

  async create(
    context: PersonRelationshipRequestContext,
    input: CreatePersonRelationshipInput,
  ): Promise<PersonRelationshipRecord> {
    const trusted = this.requireContext(context, PEOPLE_PERMISSIONS.relationshipsManage);
    const sourcePersonId = this.inputUuid(input.sourcePersonId, 'sourcePersonId');
    const targetPersonId = this.inputUuid(input.targetPersonId, 'targetPersonId');
    if (sourcePersonId === targetPersonId) {
      this.invalid('targetPersonId', 'A person relationship must connect two different people.');
    }
    await Promise.all([
      this.requireActivePerson(sourcePersonId),
      this.requireActivePerson(targetPersonId),
    ]);
    await this.requireRelationshipScope(trusted, sourcePersonId, targetPersonId);
    const validFrom = this.optionalDate(input.validFrom, 'validFrom');
    const validUntil = this.optionalDate(input.validUntil, 'validUntil');
    this.dateRange(validFrom, validUntil);
    const result = await this.repository.createRelationship({
      tenantId: trusted.tenantId,
      sourcePersonId,
      targetPersonId,
      relationshipType: this.code(input.relationshipType, 'relationshipType', 64),
      relationshipRole: this.code(input.relationshipRole, 'relationshipRole', 64),
      relationshipBasis: this.code(input.relationshipBasis, 'relationshipBasis', 64),
      validFrom,
      validUntil,
      sourceReference: this.nullableText(input.sourceReference, 'sourceReference', 255),
    });
    if (result.status === 'conflict') {
      throw new PeopleModuleError(
        'PERSON_RELATIONSHIP_CONFLICT',
        'The relationship conflicts with an existing relationship or family-tree rule.',
      );
    }
    await this.publish('person.relationship.created', trusted, result.relationship);
    return result.relationship;
  }

  async get(
    context: PersonRelationshipRequestContext,
    relationshipId: string,
    includeSensitive = false,
  ): Promise<PersonRelationshipRecord> {
    const trusted = this.requireContext(context, PEOPLE_PERMISSIONS.relationshipsView);
    this.requireSensitivePermission(trusted, includeSensitive);
    const relationship = await this.requireScopedRelationship(
      trusted,
      this.inputUuid(relationshipId, 'relationshipId'),
    );
    return includeSensitive ? relationship : { ...relationship, sourceReference: null };
  }

  async update(
    context: PersonRelationshipRequestContext,
    relationshipId: string,
    input: UpdatePersonRelationshipInput,
  ): Promise<PersonRelationshipRecord> {
    const trusted = this.requireContext(context, PEOPLE_PERMISSIONS.relationshipsManage);
    const current = await this.requireScopedRelationship(
      trusted,
      this.inputUuid(relationshipId, 'relationshipId'),
    );
    this.requireActiveRelationship(current);
    const expectedVersion = this.version(input.expectedVersion);
    const changed =
      input.relationshipRole !== undefined ||
      input.relationshipBasis !== undefined ||
      'validFrom' in input ||
      'validUntil' in input ||
      'sourceReference' in input;
    if (!changed) {
      this.invalid('body', 'At least one relationship field must be supplied for update.');
    }
    const validFrom =
      'validFrom' in input ? this.optionalDate(input.validFrom, 'validFrom') : current.validFrom;
    const validUntil =
      'validUntil' in input
        ? this.optionalDate(input.validUntil, 'validUntil')
        : current.validUntil;
    this.dateRange(validFrom, validUntil);
    const updated = await this.save({
      ...this.copy(current),
      tenantId: trusted.tenantId,
      relationshipId: current.id,
      expectedVersion,
      relationshipRole:
        input.relationshipRole === undefined
          ? current.relationshipRole
          : this.code(input.relationshipRole, 'relationshipRole', 64),
      relationshipBasis:
        input.relationshipBasis === undefined
          ? current.relationshipBasis
          : this.code(input.relationshipBasis, 'relationshipBasis', 64),
      validFrom,
      validUntil,
      sourceReference:
        'sourceReference' in input
          ? this.nullableText(input.sourceReference, 'sourceReference', 255)
          : current.sourceReference,
    });
    await this.publish('person.relationship.updated', trusted, updated);
    return updated;
  }

  async end(
    context: PersonRelationshipRequestContext,
    relationshipId: string,
    input: EndPersonRelationshipInput,
  ): Promise<PersonRelationshipRecord> {
    const trusted = this.requireContext(context, PEOPLE_PERMISSIONS.relationshipsManage);
    const current = await this.requireScopedRelationship(
      trusted,
      this.inputUuid(relationshipId, 'relationshipId'),
    );
    this.requireActiveRelationship(current);
    const validUntil =
      'validUntil' in input ? this.optionalDate(input.validUntil, 'validUntil') : this.today();
    if (validUntil === null) {
      this.invalid('validUntil', 'validUntil is required when ending a relationship.');
    }
    this.dateRange(current.validFrom, validUntil);
    const updated = await this.save({
      ...this.copy(current),
      tenantId: trusted.tenantId,
      relationshipId: current.id,
      expectedVersion: this.version(input.expectedVersion),
      status: 'ended',
      validUntil,
    });
    await this.publish('person.relationship.ended', trusted, updated);
    return updated;
  }

  async verify(
    context: PersonRelationshipRequestContext,
    relationshipId: string,
    input: VerifyPersonRelationshipInput,
  ): Promise<PersonRelationshipRecord> {
    const trusted = this.requireContext(context, PEOPLE_PERMISSIONS.relationshipsVerify);
    const current = await this.requireScopedRelationship(
      trusted,
      this.inputUuid(relationshipId, 'relationshipId'),
    );
    this.requireActiveRelationship(current);
    if (current.isVerified) {
      throw new PeopleModuleError(
        'PERSON_RELATIONSHIP_STATE_CONFLICT',
        'The relationship is already verified.',
      );
    }
    const updated = await this.save({
      ...this.copy(current),
      tenantId: trusted.tenantId,
      relationshipId: current.id,
      expectedVersion: this.version(input.expectedVersion),
      isVerified: true,
      verifiedAt: new Date(),
      verifiedByUserId: trusted.actorUserId,
      verificationSource: this.text(input.verificationSource, 'verificationSource', 128),
      verificationRevokedAt: null,
      verificationRevokedByUserId: null,
      verificationRevocationReason: null,
      sourceReference:
        'sourceReference' in input
          ? this.nullableText(input.sourceReference, 'sourceReference', 255)
          : current.sourceReference,
    });
    await this.publish('person.relationship.verified', trusted, updated);
    return updated;
  }

  async revokeVerification(
    context: PersonRelationshipRequestContext,
    relationshipId: string,
    input: RevokePersonRelationshipVerificationInput,
  ): Promise<PersonRelationshipRecord> {
    const trusted = this.requireContext(context, PEOPLE_PERMISSIONS.relationshipsVerify);
    const current = await this.requireScopedRelationship(
      trusted,
      this.inputUuid(relationshipId, 'relationshipId'),
    );
    if (!current.isVerified) {
      throw new PeopleModuleError(
        'PERSON_RELATIONSHIP_STATE_CONFLICT',
        'The relationship is not currently verified.',
      );
    }
    const updated = await this.save({
      ...this.copy(current),
      tenantId: trusted.tenantId,
      relationshipId: current.id,
      expectedVersion: this.version(input.expectedVersion),
      isVerified: false,
      verifiedAt: null,
      verifiedByUserId: null,
      verificationSource: null,
      verificationRevokedAt: new Date(),
      verificationRevokedByUserId: trusted.actorUserId,
      verificationRevocationReason: this.text(input.reason, 'reason', 1000),
    });
    await this.publish('person.relationship.verification_revoked', trusted, updated);
    return updated;
  }

  async familyTree(
    context: PersonRelationshipRequestContext,
    rootPersonId: string,
    query: FamilyTreeQuery = {},
  ): Promise<FamilyTreeGraph> {
    const trusted = this.requireContext(context, PEOPLE_PERMISSIONS.relationshipsView);
    const rootId = this.inputUuid(rootPersonId, 'rootPersonId');
    const includeSensitive = query.includeSensitive ?? false;
    this.requireSensitivePermission(trusted, includeSensitive);
    const depth = query.depth ?? 2;
    if (!Number.isInteger(depth) || depth < 1 || depth > MAX_GRAPH_DEPTH) {
      this.invalid('depth', `depth must be an integer between 1 and ${String(MAX_GRAPH_DEPTH)}.`);
    }
    await this.requireActivePerson(rootId);
    const rootReachable = await this.repository.hasActiveOrganizationMembership(
      trusted.tenantId,
      trusted.organizationId,
      rootId,
      new Date(),
    );
    if (!rootReachable) {
      throw new PeopleModuleError(
        'PERSON_RELATIONSHIP_NOT_FOUND',
        'The requested family record is unavailable in this Organization.',
      );
    }

    const visited = new Set<string>([rootId]);
    let frontier = [rootId];
    const relationships = new Map<string, PersonRelationshipRecord>();
    let truncated = false;
    const now = new Date();
    for (let level = 0; level < depth && frontier.length > 0; level += 1) {
      const connected = await this.repository.listConnectedRelationships(
        trusted.tenantId,
        frontier,
        now,
      );
      const next = new Set<string>();
      for (const relationship of connected) {
        relationships.set(relationship.id, relationship);
        for (const personId of [relationship.sourcePersonId, relationship.targetPersonId]) {
          if (!visited.has(personId)) {
            if (visited.size >= MAX_GRAPH_NODES) {
              truncated = true;
              continue;
            }
            visited.add(personId);
            next.add(personId);
          }
        }
      }
      frontier = [...next];
    }

    const records = await this.repository.listPeopleWithIdentifiers([...visited]);
    const nodes = records.map((record) =>
      this.node(record.person, record.identifiers, includeSensitive),
    );
    const projectedRelationships = [...relationships.values()].map((relationship) =>
      this.relationship(relationship, includeSensitive),
    );
    return {
      rootPersonId: rootId,
      depth,
      sensitiveFieldsIncluded: includeSensitive,
      truncated,
      nodes,
      relationships: projectedRelationships,
    };
  }

  private copy(current: PersonRelationshipRecord): UpdatePersonRelationshipRecordInput {
    return {
      tenantId: current.tenantId,
      relationshipId: current.id,
      expectedVersion: current.version,
      relationshipRole: current.relationshipRole,
      relationshipBasis: current.relationshipBasis,
      status: current.status,
      validFrom: current.validFrom,
      validUntil: current.validUntil,
      isVerified: current.isVerified,
      verifiedAt: current.verifiedAt,
      verifiedByUserId: current.verifiedByUserId,
      verificationSource: current.verificationSource,
      verificationRevokedAt: current.verificationRevokedAt,
      verificationRevokedByUserId: current.verificationRevokedByUserId,
      verificationRevocationReason: current.verificationRevocationReason,
      sourceReference: current.sourceReference,
    };
  }

  private async save(
    input: UpdatePersonRelationshipRecordInput,
  ): Promise<PersonRelationshipRecord> {
    const result = await this.repository.updateRelationship(input);
    if (result.status === 'not_found') {
      throw new PeopleModuleError(
        'PERSON_RELATIONSHIP_NOT_FOUND',
        'The relationship does not exist.',
      );
    }
    if (result.status === 'conflict') {
      throw new PeopleModuleError(
        'PERSON_RELATIONSHIP_STATE_CONFLICT',
        'The relationship changed or the requested transition conflicts with its current state.',
      );
    }
    return result.relationship;
  }

  private async requireScopedRelationship(
    context: RequiredContext,
    relationshipId: string,
  ): Promise<PersonRelationshipRecord> {
    const relationship = await this.repository.findRelationshipById(
      context.tenantId,
      relationshipId,
    );
    if (relationship === null) {
      throw new PeopleModuleError(
        'PERSON_RELATIONSHIP_NOT_FOUND',
        'The relationship does not exist.',
      );
    }
    await this.requireRelationshipScope(
      context,
      relationship.sourcePersonId,
      relationship.targetPersonId,
    );
    return relationship;
  }

  private async requireRelationshipScope(
    context: RequiredContext,
    sourcePersonId: string,
    targetPersonId: string,
  ): Promise<void> {
    const now = new Date();
    const [sourceReachable, targetReachable] = await Promise.all([
      this.repository.hasActiveOrganizationMembership(
        context.tenantId,
        context.organizationId,
        sourcePersonId,
        now,
      ),
      this.repository.hasActiveOrganizationMembership(
        context.tenantId,
        context.organizationId,
        targetPersonId,
        now,
      ),
    ]);
    if (!sourceReachable && !targetReachable) {
      throw new PeopleModuleError(
        'PERSON_RELATIONSHIP_FORBIDDEN',
        'The relationship is outside the current Organization family boundary.',
      );
    }
  }

  private async requireActivePerson(personId: string): Promise<void> {
    const person = await this.repository.findPersonById(personId);
    if (person === null || person.deletedAt !== null || person.status !== 'active') {
      throw new PeopleModuleError('PERSON_NOT_FOUND', 'The person does not exist.', {
        personId,
      });
    }
  }

  private node(
    person: PersonRecord,
    identifiers: readonly PersonIdentifierRecord[],
    sensitive: boolean,
  ): FamilyPersonNode {
    return {
      id: person.id,
      firstName: person.firstName,
      middleName: person.middleName,
      lastName: person.lastName,
      preferredName: person.preferredName,
      status: person.status,
      dateOfBirth: sensitive ? person.dateOfBirth : null,
      gender: sensitive ? person.gender : null,
      identifiers: identifiers.map((identifier) => this.identifier(identifier, sensitive)),
    };
  }

  private identifier(
    identifier: PersonIdentifierRecord,
    sensitive: boolean,
  ): FamilyPersonIdentifierProjection {
    return {
      id: identifier.id,
      identifierType: identifier.identifierType,
      identifierValue: sensitive ? identifier.identifierValue : null,
      maskedValue: this.mask(identifier.identifierValue),
      issuingAuthority: sensitive ? identifier.issuingAuthority : null,
      issuingCountryCode: identifier.issuingCountryCode,
      isVerified: identifier.isVerified,
    };
  }

  private relationship(
    relationship: PersonRelationshipRecord,
    sensitive: boolean,
  ): FamilyTreeRelationship {
    return {
      id: relationship.id,
      sourcePersonId: relationship.sourcePersonId,
      targetPersonId: relationship.targetPersonId,
      relationshipType: relationship.relationshipType,
      relationshipRole: relationship.relationshipRole,
      relationshipBasis: relationship.relationshipBasis,
      status: relationship.status,
      validFrom: relationship.validFrom,
      validUntil: relationship.validUntil,
      isVerified: relationship.isVerified,
      verificationSource: relationship.verificationSource,
      sourceReference: sensitive ? relationship.sourceReference : null,
      version: relationship.version,
      updatedAt: relationship.updatedAt,
    };
  }

  private mask(value: string): string {
    const visible = value.slice(-4);
    return `${'*'.repeat(Math.max(0, value.length - visible.length))}${visible}`;
  }

  private requireContext(
    context: PersonRelationshipRequestContext,
    permission: PeoplePermission,
  ): RequiredContext {
    const trusted = {
      actorUserId: this.trustedUuid(context.actorUserId, 'context.actorUserId'),
      tenantId: this.trustedUuid(context.tenantId, 'context.tenantId'),
      organizationId: this.trustedUuid(context.organizationId, 'context.organizationId'),
      permissionCodes: context.permissionCodes,
    };
    if (!trusted.permissionCodes.has(permission)) {
      throw new PeopleModuleError(
        'PERSON_RELATIONSHIP_FORBIDDEN',
        `The operation requires the ${permission} permission.`,
        { permission },
      );
    }
    return trusted;
  }

  private requireSensitivePermission(context: RequiredContext, requested: boolean): void {
    if (requested && !context.permissionCodes.has(PEOPLE_PERMISSIONS.familySensitiveView)) {
      throw new PeopleModuleError(
        'PERSON_RELATIONSHIP_FORBIDDEN',
        `The operation requires the ${PEOPLE_PERMISSIONS.familySensitiveView} permission.`,
        { permission: PEOPLE_PERMISSIONS.familySensitiveView },
      );
    }
  }

  private requireActiveRelationship(relationship: PersonRelationshipRecord): void {
    if (relationship.status !== 'active') {
      throw new PeopleModuleError(
        'PERSON_RELATIONSHIP_STATE_CONFLICT',
        'Only active relationships may be changed by this operation.',
      );
    }
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

  private trustedUuid(value: unknown, field: string): string {
    if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
      throw new PeopleModuleError(
        'PERSON_RELATIONSHIP_INTEGRITY_FAILURE',
        `${field} must be a UUID.`,
      );
    }
    return value.toLowerCase();
  }

  private code(value: string, field: string, maximum: number): string {
    const normalized = this.text(value, field, maximum).toLowerCase();
    if (!CODE_PATTERN.test(normalized)) {
      this.invalid(field, `${field} must be a machine-readable code.`);
    }
    return normalized;
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

  private optionalDate(value: Date | null | undefined, field: string): Date | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      this.invalid(field, `${field} must be a valid date.`);
    }
    return new Date(value.getTime());
  }

  private dateRange(validFrom: Date | null, validUntil: Date | null): void {
    if (validFrom !== null && validUntil !== null && validUntil < validFrom) {
      this.invalid('validUntil', 'validUntil cannot be earlier than validFrom.');
    }
  }

  private today(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  private async publish(
    name: PersonRelationshipEventName,
    context: RequiredContext,
    relationship: PersonRelationshipRecord,
  ): Promise<void> {
    await this.events.publish({
      name,
      actorUserId: context.actorUserId,
      tenantId: context.tenantId,
      relationshipId: relationship.id,
      sourcePersonId: relationship.sourcePersonId,
      targetPersonId: relationship.targetPersonId,
      version: relationship.version,
      occurredAt: new Date(),
    });
  }

  private invalid(field: string, message: string): never {
    throw new PeopleModuleError('PERSON_RELATIONSHIP_INVALID_INPUT', message, { field });
  }
}

interface RequiredContext {
  readonly actorUserId: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly permissionCodes: ReadonlySet<string>;
}
