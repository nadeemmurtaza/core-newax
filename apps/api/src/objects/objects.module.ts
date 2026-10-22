import { Module } from '@nestjs/common';
import { ObjectsService } from '@newax/objects';

import { DatabaseModule } from '../database/database.module';
import { RequestContextModule } from '../request-context/request-context.module';
import { CurrentOrganizationObjectsController } from './current-organization-objects.controller';
import { LoggingObjectEventPublisher } from './logging-object-event.publisher';
import { PrismaObjectsRepository } from './prisma-objects.repository';

@Module({
  imports: [DatabaseModule, RequestContextModule],
  controllers: [CurrentOrganizationObjectsController],
  providers: [
    PrismaObjectsRepository,
    LoggingObjectEventPublisher,
    {
      provide: ObjectsService,
      inject: [PrismaObjectsRepository, LoggingObjectEventPublisher],
      useFactory: (
        repository: PrismaObjectsRepository,
        eventPublisher: LoggingObjectEventPublisher,
      ): ObjectsService => new ObjectsService(repository, eventPublisher),
    },
  ],
  exports: [ObjectsService],
})
export class ObjectsModule {}
