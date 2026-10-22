import { Module } from '@nestjs/common';
import { TenantsService } from '@newax/tenants';

import { DatabaseModule } from '../database/database.module';
import { LoggingTenantEventPublisher } from './logging-tenant-event.publisher';
import { PrismaTenantRepository } from './prisma-tenant.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    PrismaTenantRepository,
    LoggingTenantEventPublisher,
    {
      provide: TenantsService,
      inject: [PrismaTenantRepository, LoggingTenantEventPublisher],
      useFactory: (
        repository: PrismaTenantRepository,
        publisher: LoggingTenantEventPublisher,
      ): TenantsService => new TenantsService(repository, publisher),
    },
  ],
  exports: [TenantsService],
})
export class TenantsModule {}
