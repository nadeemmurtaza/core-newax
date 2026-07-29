import type {
  AddressesCollaborator,
  ContactsCollaborator,
  ExternalReferencesCollaborator,
  MembershipsCollaborator,
  OrganizationsCollaborator,
  PeopleCollaborator,
} from '../collaborators/lead-harvester-sync-collaborators';
import { LeadHarvesterSyncModuleError } from '../errors/lead-harvester-sync-module-error';
import type { LeadHarvesterSyncEventPublisher } from '../events/lead-harvester-sync-event';
import {
  LEAD_HARVESTER_SYNC_PERMISSIONS,
  type LeadHarvesterSyncPermission,
} from '../permissions/lead-harvester-sync-permissions';
import type {
  LeadHarvesterInstitutionUpsertedPayload,
  LeadHarvesterSyncRequestContext,
  LeadHarvesterSyncResult,
  LeadHarvesterSyncSkippedItem,
} from '../types/lead-harvester-sync';
import { mapHarvesterContactType } from './contact-type-mapper';
import { splitPersonName } from './person-name';

const EXTERNAL_SYSTEM = 'lead_harvester';
const DOMAIN_CODE = 'marketing_leads';

interface OrganizationContext {
  readonly actorUserId: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly permissionCodes: ReadonlySet<string>;
}

interface PersonContactLinkMetadata {
  readonly membershipId: string;
  readonly personContactId: string;
}

export class LeadHarvesterSyncService {
  constructor(
    private readonly externalReferences: ExternalReferencesCollaborator,
    private readonly organizations: OrganizationsCollaborator,
    private readonly addresses: AddressesCollaborator,
    private readonly contacts: ContactsCollaborator,
    private readonly people: PeopleCollaborator,
    private readonly memberships: MembershipsCollaborator,
    private readonly eventPublisher: LeadHarvesterSyncEventPublisher,
  ) {}

  async syncInstitutionUpserted(
    context: LeadHarvesterSyncRequestContext,
    payload: LeadHarvesterInstitutionUpsertedPayload,
  ): Promise<LeadHarvesterSyncResult> {
    this.requirePermission(context, LEAD_HARVESTER_SYNC_PERMISSIONS.ingest);
    const occurredAt = this.requireOccurredAt(payload);
    this.requirePayloadShape(payload);

    const tenantId = context.tenantId;
    const actorUserId = context.actorUserId;
    const permissionCodes = context.permissionCodes;
    const institutionKey = this.entityKey('institution', payload.institution.id);

    const existingInstitution = await this.externalReferences.findTenantExternalReferenceByKey(
      { actorUserId, tenantId, permissionCodes },
      { externalSystem: EXTERNAL_SYSTEM, externalKey: institutionKey },
    );

    if (existingInstitution !== null) {
      const lastSyncedOccurredAt = this.readLastSyncedOccurredAt(existingInstitution.metadata);
      if (lastSyncedOccurredAt !== null && occurredAt.getTime() <= lastSyncedOccurredAt.getTime()) {
        return { status: 'stale', organizationId: existingInstitution.organizationId };
      }
    }

    let organizationId: string;
    if (existingInstitution === null) {
      const organization = await this.organizations.create(
        { actorUserId, tenantId, permissionCodes },
        {
          legalName: payload.institution.canonicalName,
          displayName: payload.institution.canonicalName,
          organizationType: payload.institution.institutionType,
        },
      );
      organizationId = organization.id;
      const orgContext: OrganizationContext = {
        actorUserId,
        tenantId,
        organizationId,
        permissionCodes,
      };
      await this.externalReferences.registerCurrentOrganizationExternalReference(orgContext, {
        domainCode: DOMAIN_CODE,
        entityType: 'organization',
        entityId: organizationId,
        externalSystem: EXTERNAL_SYSTEM,
        externalKey: institutionKey,
        metadata: this.institutionMetadata(payload, occurredAt),
      });
    } else {
      organizationId = existingInstitution.organizationId;
      await this.organizations.update({ actorUserId, tenantId, permissionCodes }, organizationId, {
        legalName: payload.institution.canonicalName,
        displayName: payload.institution.canonicalName,
        organizationType: payload.institution.institutionType,
      });
      await this.externalReferences.updateCurrentOrganizationExternalReferenceEntity(
        { actorUserId, tenantId, organizationId, permissionCodes },
        {
          externalSystem: EXTERNAL_SYSTEM,
          externalKey: institutionKey,
          entityId: organizationId,
          metadata: this.institutionMetadata(payload, occurredAt),
        },
      );
    }

    const orgContext: OrganizationContext = {
      actorUserId,
      tenantId,
      organizationId,
      permissionCodes,
    };

    for (const [index, branch] of payload.branches.entries()) {
      await this.syncBranch(orgContext, branch, index === 0);
    }

    const skipped: LeadHarvesterSyncSkippedItem[] = [];
    for (const contactPoint of payload.contactPoints) {
      const mappedType = mapHarvesterContactType(contactPoint.contactType);
      if (mappedType === null) {
        skipped.push({
          kind: 'contact_point',
          id: contactPoint.id,
          reason: 'unsupported_contact_type',
        });
        continue;
      }
      await this.syncContactPoint(orgContext, contactPoint, mappedType);
    }

    await this.eventPublisher.publish({
      name: 'lead_harvester_sync.institution_synced',
      actorUserId,
      tenantId,
      organizationId,
      sourceEventId: payload.eventId,
      skippedCount: skipped.length,
      occurredAt: new Date(),
    });

    return { status: 'applied', organizationId, skipped: Object.freeze(skipped) };
  }

  private async syncBranch(
    orgContext: OrganizationContext,
    branch: LeadHarvesterInstitutionUpsertedPayload['branches'][number],
    isPrimary: boolean,
  ): Promise<void> {
    const externalKey = this.entityKey('branch', branch.id);
    const existing = await this.externalReferences.findCurrentOrganizationExternalReferenceByKey(
      orgContext,
      { externalSystem: EXTERNAL_SYSTEM, externalKey },
    );
    const metadata = branch.branchName === null ? null : { branchName: branch.branchName };
    const addressInput = {
      addressType: 'office' as const,
      isPrimary,
      line1: branch.address,
      city: branch.city,
      stateRegion: branch.stateRegion ?? null,
      postalCode: branch.postalCode ?? null,
      countryCode: branch.countryCode,
    };

    if (existing === null) {
      const created = await this.addresses.addCurrentOrganizationAddress(orgContext, addressInput);
      await this.externalReferences.registerCurrentOrganizationExternalReference(orgContext, {
        domainCode: DOMAIN_CODE,
        entityType: 'organization_address',
        entityId: created.id,
        externalSystem: EXTERNAL_SYSTEM,
        externalKey,
        metadata,
      });
      return;
    }

    const updated = await this.addresses.updateCurrentOrganizationAddress(orgContext, {
      organizationAddressId: existing.entityId,
      ...addressInput,
    });
    if (updated.id !== existing.entityId) {
      await this.externalReferences.updateCurrentOrganizationExternalReferenceEntity(orgContext, {
        externalSystem: EXTERNAL_SYSTEM,
        externalKey,
        entityId: updated.id,
        metadata,
      });
    }
  }

  private async syncContactPoint(
    orgContext: OrganizationContext,
    contactPoint: LeadHarvesterInstitutionUpsertedPayload['contactPoints'][number],
    contactType: NonNullable<ReturnType<typeof mapHarvesterContactType>>,
  ): Promise<void> {
    const externalKey = this.entityKey('contact', contactPoint.id);
    const label = contactPoint.role ?? null;
    const contactInput = { contactType, contactValue: contactPoint.contactValue, label };

    const existing = await this.externalReferences.findCurrentOrganizationExternalReferenceByKey(
      orgContext,
      { externalSystem: EXTERNAL_SYSTEM, externalKey },
    );

    if (existing === null) {
      const created = await this.contacts.addCurrentOrganizationContact(orgContext, contactInput);
      await this.externalReferences.registerCurrentOrganizationExternalReference(orgContext, {
        domainCode: DOMAIN_CODE,
        entityType: 'organization_contact_method',
        entityId: created.id,
        externalSystem: EXTERNAL_SYSTEM,
        externalKey,
        metadata: null,
      });
    } else {
      const updated = await this.contacts.updateCurrentOrganizationContact(orgContext, {
        contactId: existing.entityId,
        ...contactInput,
      });
      if (updated.id !== existing.entityId) {
        await this.externalReferences.updateCurrentOrganizationExternalReferenceEntity(orgContext, {
          externalSystem: EXTERNAL_SYSTEM,
          externalKey,
          entityId: updated.id,
          metadata: null,
        });
      }
    }

    const personName = contactPoint.personName?.trim() ?? '';
    if (personName.length > 0) {
      await this.syncContactPerson(orgContext, contactPoint.id, personName, contactType, {
        contactValue: contactPoint.contactValue,
        label,
      });
    }
  }

  private async syncContactPerson(
    orgContext: OrganizationContext,
    contactPointId: string,
    personName: string,
    contactType: NonNullable<ReturnType<typeof mapHarvesterContactType>>,
    contact: { readonly contactValue: string; readonly label: string | null },
  ): Promise<void> {
    const { firstName, lastName } = splitPersonName(personName);
    const externalKey = this.entityKey('contact-person', contactPointId);
    const existing = await this.externalReferences.findCurrentOrganizationExternalReferenceByKey(
      orgContext,
      { externalSystem: EXTERNAL_SYSTEM, externalKey },
    );

    const peopleContext = orgContext;
    const membershipContext = orgContext;

    if (existing === null) {
      const person = await this.people.create(peopleContext, { firstName, lastName });
      const personContact = await this.contacts.addCurrentPersonContact(orgContext, {
        personId: person.id,
        contactType,
        contactValue: contact.contactValue,
        label: contact.label,
      });
      const membership = await this.memberships.create(membershipContext, {
        personId: person.id,
        membershipType: 'contact',
        jobTitle: contact.label,
      });
      await this.externalReferences.registerCurrentOrganizationExternalReference(orgContext, {
        domainCode: DOMAIN_CODE,
        entityType: 'person',
        entityId: person.id,
        externalSystem: EXTERNAL_SYSTEM,
        externalKey,
        metadata: { membershipId: membership.id, personContactId: personContact.id },
      });
      return;
    }

    const personId = existing.entityId;
    const link = this.requirePersonContactLinkMetadata(existing.metadata);

    await this.people.update(peopleContext, personId, { firstName, lastName });
    const updatedPersonContact = await this.contacts.updateCurrentPersonContact(orgContext, {
      personId,
      contactId: link.personContactId,
      contactType,
      contactValue: contact.contactValue,
      label: contact.label,
    });
    await this.memberships.update(membershipContext, link.membershipId, {
      jobTitle: contact.label,
    });

    if (updatedPersonContact.id !== link.personContactId) {
      await this.externalReferences.updateCurrentOrganizationExternalReferenceEntity(orgContext, {
        externalSystem: EXTERNAL_SYSTEM,
        externalKey,
        entityId: personId,
        metadata: { membershipId: link.membershipId, personContactId: updatedPersonContact.id },
      });
    }
  }

  private requirePermission(
    context: LeadHarvesterSyncRequestContext,
    permission: LeadHarvesterSyncPermission,
  ): void {
    if (!context.permissionCodes.has(permission)) {
      throw new LeadHarvesterSyncModuleError(
        'LEAD_HARVESTER_SYNC_FORBIDDEN',
        `The operation requires ${permission}.`,
      );
    }
  }

  private requireOccurredAt(payload: LeadHarvesterInstitutionUpsertedPayload): Date {
    const occurredAt = new Date(payload.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      throw new LeadHarvesterSyncModuleError(
        'LEAD_HARVESTER_SYNC_INVALID_PAYLOAD',
        'occurredAt must be a valid ISO8601 timestamp.',
      );
    }
    return occurredAt;
  }

  private requirePayloadShape(payload: LeadHarvesterInstitutionUpsertedPayload): void {
    if (payload.schemaVersion !== 1) {
      throw new LeadHarvesterSyncModuleError(
        'LEAD_HARVESTER_SYNC_INVALID_PAYLOAD',
        `Unsupported schemaVersion: ${String(payload.schemaVersion)}.`,
      );
    }
    if (payload.eventType !== 'institution.upserted') {
      throw new LeadHarvesterSyncModuleError(
        'LEAD_HARVESTER_SYNC_INVALID_PAYLOAD',
        `Unsupported eventType: ${payload.eventType}.`,
      );
    }
    if (payload.institution.id.trim().length === 0) {
      throw new LeadHarvesterSyncModuleError(
        'LEAD_HARVESTER_SYNC_INVALID_PAYLOAD',
        'institution.id must not be blank.',
      );
    }
  }

  private entityKey(
    kind: 'institution' | 'branch' | 'contact' | 'contact-person',
    id: string,
  ): string {
    return `${kind}:${id}`;
  }

  private institutionMetadata(
    payload: LeadHarvesterInstitutionUpsertedPayload,
    occurredAt: Date,
  ): Record<string, unknown> {
    return {
      domain: payload.institution.domain,
      website: payload.institution.website,
      status: payload.institution.status,
      lastSyncedOccurredAt: occurredAt.toISOString(),
    };
  }

  private readLastSyncedOccurredAt(metadata: Record<string, unknown> | null): Date | null {
    const value = metadata?.['lastSyncedOccurredAt'];
    if (typeof value !== 'string') {
      return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private requirePersonContactLinkMetadata(
    metadata: Record<string, unknown> | null,
  ): PersonContactLinkMetadata {
    const membershipId = metadata?.['membershipId'];
    const personContactId = metadata?.['personContactId'];
    if (typeof membershipId !== 'string' || typeof personContactId !== 'string') {
      throw new LeadHarvesterSyncModuleError(
        'LEAD_HARVESTER_SYNC_INTEGRITY_FAILURE',
        'The contact-person external reference is missing its membership/contact link metadata.',
      );
    }
    return { membershipId, personContactId };
  }
}
