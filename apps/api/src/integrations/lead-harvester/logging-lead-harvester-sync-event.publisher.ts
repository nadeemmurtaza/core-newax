import { Injectable, Logger } from '@nestjs/common';
import type {
  LeadHarvesterSyncEvent,
  LeadHarvesterSyncEventPublisher,
} from '@newax/lead-harvester-sync';

@Injectable()
export class LoggingLeadHarvesterSyncEventPublisher implements LeadHarvesterSyncEventPublisher {
  private readonly logger = new Logger(LoggingLeadHarvesterSyncEventPublisher.name);

  async publish(event: LeadHarvesterSyncEvent): Promise<void> {
    this.logger.log({
      event: event.name,
      actorUserId: event.actorUserId,
      tenantId: event.tenantId,
      organizationId: event.organizationId,
      sourceEventId: event.sourceEventId,
      skippedCount: event.skippedCount,
      occurredAt: event.occurredAt.toISOString(),
    });
  }
}
