import { Injectable, Logger } from '@nestjs/common';
import type {
  ExternalReferenceEvent,
  ExternalReferenceEventPublisher,
} from '@newax/external-references';

@Injectable()
export class LoggingExternalReferenceEventPublisher implements ExternalReferenceEventPublisher {
  private readonly logger = new Logger(LoggingExternalReferenceEventPublisher.name);

  async publish(event: ExternalReferenceEvent): Promise<void> {
    this.logger.log({
      event: event.name,
      actorUserId: event.actorUserId,
      tenantId: event.tenantId,
      organizationId: event.organizationId,
      externalReferenceId: event.externalReferenceId,
      occurredAt: event.occurredAt.toISOString(),
    });
  }
}
