import { Injectable, Logger } from '@nestjs/common';
import type { PersonRelationshipEvent, PersonRelationshipEventPublisher } from '@newax/people';

@Injectable()
export class LoggingPersonRelationshipEventPublisher implements PersonRelationshipEventPublisher {
  private readonly logger = new Logger(LoggingPersonRelationshipEventPublisher.name);

  async publish(event: PersonRelationshipEvent): Promise<void> {
    this.logger.log({
      event: event.name,
      actorUserId: event.actorUserId,
      tenantId: event.tenantId,
      relationshipId: event.relationshipId,
      sourcePersonId: event.sourcePersonId,
      targetPersonId: event.targetPersonId,
      version: event.version,
      occurredAt: event.occurredAt.toISOString(),
    });
  }
}
