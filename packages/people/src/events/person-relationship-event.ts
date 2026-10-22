export type PersonRelationshipEventName =
  | 'person.relationship.created'
  | 'person.relationship.ended'
  | 'person.relationship.updated'
  | 'person.relationship.verification_revoked'
  | 'person.relationship.verified';

export interface PersonRelationshipEvent {
  readonly name: PersonRelationshipEventName;
  readonly actorUserId: string;
  readonly tenantId: string;
  readonly relationshipId: string;
  readonly sourcePersonId: string;
  readonly targetPersonId: string;
  readonly version: number;
  readonly occurredAt: Date;
}

export interface PersonRelationshipEventPublisher {
  publish(event: PersonRelationshipEvent): Promise<void>;
}
