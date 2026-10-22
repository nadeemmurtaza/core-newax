import { Injectable, Logger } from '@nestjs/common';
import type { AddressEvent, AddressEventPublisher } from '@newax/addresses';

@Injectable()
export class LoggingAddressEventPublisher implements AddressEventPublisher {
  private readonly logger = new Logger(LoggingAddressEventPublisher.name);

  async publish(event: AddressEvent): Promise<void> {
    this.logger.log({
      event: event.name,
      actorUserId: event.actorUserId,
      tenantId: event.tenantId,
      organizationId: event.organizationId,
      organizationAddressId: event.organizationAddressId,
      addressId: event.addressId,
      addressType: event.addressType,
      isPrimary: event.isPrimary,
      occurredAt: event.occurredAt.toISOString(),
    });
  }
}
