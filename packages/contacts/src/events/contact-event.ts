import type { ContactType } from '../types/contact';

export interface ContactCreatedEvent {
  readonly name: 'contact.created';
  readonly actorUserId: string;
  readonly organizationId: string;
  readonly contactId: string;
  readonly contactMethodId: string;
  readonly contactType: ContactType;
  readonly occurredAt: Date;
}

export interface ContactUpdatedEvent {
  readonly name: 'contact.updated';
  readonly actorUserId: string;
  readonly organizationId: string;
  readonly contactId: string;
  readonly contactMethodId: string;
  readonly contactType: ContactType;
  readonly relinked: boolean;
  readonly occurredAt: Date;
}

export interface PersonContactCreatedEvent {
  readonly name: 'person_contact.created';
  readonly actorUserId: string;
  readonly personId: string;
  readonly contactId: string;
  readonly contactMethodId: string;
  readonly contactType: ContactType;
  readonly occurredAt: Date;
}

export interface PersonContactUpdatedEvent {
  readonly name: 'person_contact.updated';
  readonly actorUserId: string;
  readonly personId: string;
  readonly contactId: string;
  readonly contactMethodId: string;
  readonly contactType: ContactType;
  readonly relinked: boolean;
  readonly occurredAt: Date;
}

export type ContactEvent =
  ContactCreatedEvent | ContactUpdatedEvent | PersonContactCreatedEvent | PersonContactUpdatedEvent;

export interface ContactEventPublisher {
  publish(event: ContactEvent): Promise<void>;
}
