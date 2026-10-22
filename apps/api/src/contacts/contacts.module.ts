import { Module } from '@nestjs/common';
import { ContactsService } from '@newax/contacts';

import { DatabaseModule } from '../database/database.module';
import { RequestContextModule } from '../request-context/request-context.module';
import { CurrentOrganizationContactsController } from './current-organization-contacts.controller';
import { LoggingContactEventPublisher } from './logging-contact-event.publisher';
import { PrismaContactsRepository } from './prisma-contacts.repository';

@Module({
  imports: [DatabaseModule, RequestContextModule],
  controllers: [CurrentOrganizationContactsController],
  providers: [
    PrismaContactsRepository,
    LoggingContactEventPublisher,
    {
      provide: ContactsService,
      inject: [PrismaContactsRepository, LoggingContactEventPublisher],
      useFactory: (
        repository: PrismaContactsRepository,
        eventPublisher: LoggingContactEventPublisher,
      ): ContactsService => new ContactsService(repository, eventPublisher),
    },
  ],
  exports: [ContactsService],
})
export class ContactsModule {}
