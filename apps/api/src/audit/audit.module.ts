import { Module } from '@nestjs/common';
import { AuditService } from '@newax/audit';

import { DatabaseModule } from '../database/database.module';
import { AuditHttpSecuritySink } from './http-security-audit.sink';
import { PrismaAuditRepository } from './prisma-audit.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    PrismaAuditRepository,
    {
      provide: AuditService,
      inject: [PrismaAuditRepository],
      useFactory: (repository: PrismaAuditRepository): AuditService => new AuditService(repository),
    },
    AuditHttpSecuritySink,
  ],
  exports: [AuditService, AuditHttpSecuritySink],
})
export class AuditModule {}
