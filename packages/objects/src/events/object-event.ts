export interface ObjectTypeRegisteredEvent {
  readonly name: 'object.type_registered';
  readonly actorUserId: string;
  readonly objectTypeId: string;
  readonly objectTypeCode: string;
  readonly occurredAt: Date;
}

export interface ObjectCreatedEvent {
  readonly name: 'object.created';
  readonly actorUserId: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly objectId: string;
  readonly objectTypeId: string;
  readonly objectTypeCode: string;
  readonly parentObjectId: string | null;
  readonly occurredAt: Date;
}

export type ObjectEvent = ObjectCreatedEvent | ObjectTypeRegisteredEvent;

export interface ObjectEventPublisher {
  publish(event: ObjectEvent): Promise<void>;
}
