import { Injectable, Logger } from '@nestjs/common';
import type { TenantEvent, TenantEventPublisher } from '@newax/tenants';

@Injectable()
export class LoggingTenantEventPublisher implements TenantEventPublisher {
  private readonly logger = new Logger(LoggingTenantEventPublisher.name);

  async publish(event: TenantEvent): Promise<void> {
    this.logger.log({
      event: event.name,
      actorUserId: event.actorUserId,
      tenantId: event.tenantId,
      occurredAt: event.occurredAt.toISOString(),
    });
  }
}
