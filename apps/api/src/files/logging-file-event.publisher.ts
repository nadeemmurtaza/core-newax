import { Injectable, Logger } from '@nestjs/common';
import type { FileEvent, FileEventPublisher } from '@newax/files';

@Injectable()
export class LoggingFileEventPublisher implements FileEventPublisher {
  private readonly logger = new Logger(LoggingFileEventPublisher.name);

  async publish(event: FileEvent): Promise<void> {
    this.logger.log({
      event: event.name,
      actorUserId: event.actorUserId,
      tenantId: event.tenantId,
      organizationId: event.organizationId,
      fileId: event.fileId,
      occurredAt: event.occurredAt.toISOString(),
    });
  }
}
