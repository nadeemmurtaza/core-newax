import { Module } from '@nestjs/common';
import { ExternalReferencesService } from '@newax/external-references';

import { DatabaseModule } from '../database/database.module';
import { LoggingExternalReferenceEventPublisher } from './logging-external-reference-event.publisher';
import { PrismaExternalReferencesRepository } from './prisma-external-references.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    PrismaExternalReferencesRepository,
    LoggingExternalReferenceEventPublisher,
    {
      provide: ExternalReferencesService,
      inject: [PrismaExternalReferencesRepository, LoggingExternalReferenceEventPublisher],
      useFactory: (
        repository: PrismaExternalReferencesRepository,
        eventPublisher: LoggingExternalReferenceEventPublisher,
      ): ExternalReferencesService => new ExternalReferencesService(repository, eventPublisher),
    },
  ],
  exports: [ExternalReferencesService],
})
export class ExternalReferencesModule {}
