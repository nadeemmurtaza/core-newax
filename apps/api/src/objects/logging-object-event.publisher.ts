import { Injectable, Logger } from '@nestjs/common';
import type { ObjectEvent, ObjectEventPublisher } from '@newax/objects';

@Injectable()
export class LoggingObjectEventPublisher implements ObjectEventPublisher {
  private readonly logger = new Logger(LoggingObjectEventPublisher.name);

  async publish(event: ObjectEvent): Promise<void> {
    if (event.name === 'object.type_registered') {
      this.logger.log({
        event: event.name,
        actorUserId: event.actorUserId,
        objectTypeId: event.objectTypeId,
        objectTypeCode: event.objectTypeCode,
        occurredAt: event.occurredAt.toISOString(),
      });
      return;
    }

    this.logger.log({
      event: event.name,
      actorUserId: event.actorUserId,
      tenantId: event.tenantId,
      organizationId: event.organizationId,
      objectId: event.objectId,
      objectTypeId: event.objectTypeId,
      objectTypeCode: event.objectTypeCode,
      parentObjectId: event.parentObjectId,
      occurredAt: event.occurredAt.toISOString(),
    });
  }
}
