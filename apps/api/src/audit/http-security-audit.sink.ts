import { Inject, Injectable } from '@nestjs/common';
import { AuditService } from '@newax/audit';
import type { HttpAuditRecord, HttpSecurityAuditSink } from '@newax/http-security';

@Injectable()
export class AuditHttpSecuritySink implements HttpSecurityAuditSink {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  async record(record: HttpAuditRecord): Promise<void> {
    await this.audit.recordTrustedEntry({
      organizationId: record.organizationId,
      actorUserId: record.actorUserId,
      moduleCode: 'http-security',
      action: record.action,
      entityType: 'http_route',
      entityId: record.routeKey,
      outcome: record.outcome,
      sensitivity: 'security',
      metadata: {
        ...record.metadata,
        method: record.method,
        statusCode: record.statusCode,
      },
      requestId: record.requestId,
      ipAddress: record.ipAddress,
      userAgent: record.userAgent,
      occurredAt: record.occurredAt,
    });
  }
}
