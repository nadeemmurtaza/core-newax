import { Module } from '@nestjs/common';
import { FilesService } from '@newax/files';

import { DatabaseModule } from '../database/database.module';
import { LoggingFileEventPublisher } from './logging-file-event.publisher';
import { PrismaFilesRepository } from './prisma-files.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    PrismaFilesRepository,
    LoggingFileEventPublisher,
    {
      provide: FilesService,
      inject: [PrismaFilesRepository, LoggingFileEventPublisher],
      useFactory: (
        repository: PrismaFilesRepository,
        eventPublisher: LoggingFileEventPublisher,
      ): FilesService => new FilesService(repository, eventPublisher),
    },
  ],
  exports: [FilesService],
})
export class FilesModule {}
