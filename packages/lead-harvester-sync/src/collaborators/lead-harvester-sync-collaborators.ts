import type { AddressesService } from '@newax/addresses';
import type { ContactsService } from '@newax/contacts';
import type { ExternalReferencesService } from '@newax/external-references';
import type { MembershipsService } from '@newax/memberships';
import type { OrganizationsService } from '@newax/organizations';
import type { PeopleService } from '@newax/people';

/**
 * Narrow collaborator ports, one per already-built package this orchestrator
 * composes. Each is extracted directly from the real service class's public
 * method types (via indexed access), not hand-duplicated, so a signature
 * change on the real service is a compile error here rather than a silent
 * drift. A real service instance is always assignable to its narrower port
 * (structural typing, and `this`-binding is unaffected since JS method
 * dispatch resolves the receiver at the call site) -- these ports exist
 * purely so unit tests can substitute plain fake objects instead of standing
 * up a real service backed by a fake repository for all six packages.
 */

export interface OrganizationsCollaborator {
  readonly create: OrganizationsService['create'];
  readonly update: OrganizationsService['update'];
}

export interface AddressesCollaborator {
  readonly addCurrentOrganizationAddress: AddressesService['addCurrentOrganizationAddress'];
  readonly updateCurrentOrganizationAddress: AddressesService['updateCurrentOrganizationAddress'];
}

export interface ContactsCollaborator {
  readonly addCurrentOrganizationContact: ContactsService['addCurrentOrganizationContact'];
  readonly updateCurrentOrganizationContact: ContactsService['updateCurrentOrganizationContact'];
  readonly addCurrentPersonContact: ContactsService['addCurrentPersonContact'];
  readonly updateCurrentPersonContact: ContactsService['updateCurrentPersonContact'];
}

export interface PeopleCollaborator {
  readonly create: PeopleService['create'];
  readonly update: PeopleService['update'];
}

export interface MembershipsCollaborator {
  readonly create: MembershipsService['create'];
  readonly update: MembershipsService['update'];
}

export interface ExternalReferencesCollaborator {
  readonly findTenantExternalReferenceByKey: ExternalReferencesService['findTenantExternalReferenceByKey'];
  readonly findCurrentOrganizationExternalReferenceByKey: ExternalReferencesService['findCurrentOrganizationExternalReferenceByKey'];
  readonly registerCurrentOrganizationExternalReference: ExternalReferencesService['registerCurrentOrganizationExternalReference'];
  readonly updateCurrentOrganizationExternalReferenceEntity: ExternalReferencesService['updateCurrentOrganizationExternalReferenceEntity'];
}
