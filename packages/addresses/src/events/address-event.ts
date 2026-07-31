import type { OrganizationAddressType } from '../types/address';

export interface OrganizationAddressCreatedEvent {
  readonly name: 'address.created';
  readonly actorUserId: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly organizationAddressId: string;
  readonly addressId: string;
  readonly addressType: OrganizationAddressType;
  readonly isPrimary: boolean;
  readonly occurredAt: Date;
}

export interface OrganizationAddressUpdatedEvent {
  readonly name: 'address.updated';
  readonly actorUserId: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly organizationAddressId: string;
  readonly addressId: string;
  readonly addressType: OrganizationAddressType;
  readonly isPrimary: boolean;
  readonly relinked: boolean;
  readonly occurredAt: Date;
}

export type AddressEvent = OrganizationAddressCreatedEvent | OrganizationAddressUpdatedEvent;

export interface AddressEventPublisher {
  publish(event: AddressEvent): Promise<void>;
}
