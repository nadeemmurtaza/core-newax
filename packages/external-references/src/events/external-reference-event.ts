export interface ExternalReferenceRegisteredEvent {
  readonly name: 'external_reference.registered';
  readonly actorUserId: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly externalReferenceId: string;
  readonly occurredAt: Date;
}

export type ExternalReferenceEvent = ExternalReferenceRegisteredEvent;

export interface ExternalReferenceEventPublisher {
  publish(event: ExternalReferenceEvent): Promise<void>;
}
