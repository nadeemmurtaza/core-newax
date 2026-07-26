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

export type ContactEvent = ContactCreatedEvent;

export interface ContactEventPublisher {
  publish(event: ContactEvent): Promise<void>;
}
