import { Injectable, Logger } from '@nestjs/common';
import type { ContactEvent, ContactEventPublisher } from '@newax/contacts';

@Injectable()
export class LoggingContactEventPublisher implements ContactEventPublisher {
  private readonly logger = new Logger(LoggingContactEventPublisher.name);

  async publish(event: ContactEvent): Promise<void> {
    this.logger.log({
      event: event.name,
      actorUserId: event.actorUserId,
      organizationId: event.organizationId,
      contactId: event.contactId,
      contactMethodId: event.contactMethodId,
      contactType: event.contactType,
      occurredAt: event.occurredAt.toISOString(),
    });
  }
}
