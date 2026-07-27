import { Module } from '@nestjs/common';
import { PeopleService, PersonRelationshipService } from '@newax/people';

import { DatabaseModule } from '../database/database.module';
import { RequestContextModule } from '../request-context/request-context.module';
import { CurrentOrganizationFamilyRelationshipsController } from './current-organization-family-relationships.controller';
import { CurrentPersonController } from './current-person.controller';
import { LoggingPersonEventPublisher } from './logging-person-event.publisher';
import { LoggingPersonRelationshipEventPublisher } from './logging-person-relationship-event.publisher';
import { PrismaPeopleRepository } from './prisma-people.repository';
import { PrismaPersonRelationshipRepository } from './prisma-person-relationship.repository';

@Module({
  imports: [DatabaseModule, RequestContextModule],
  controllers: [CurrentPersonController, CurrentOrganizationFamilyRelationshipsController],
  providers: [
    PrismaPeopleRepository,
    LoggingPersonEventPublisher,
    PrismaPersonRelationshipRepository,
    LoggingPersonRelationshipEventPublisher,
    {
      provide: PersonRelationshipService,
      inject: [PrismaPersonRelationshipRepository, LoggingPersonRelationshipEventPublisher],
      useFactory: (
        repository: PrismaPersonRelationshipRepository,
        eventPublisher: LoggingPersonRelationshipEventPublisher,
      ): PersonRelationshipService => new PersonRelationshipService(repository, eventPublisher),
    },
    {
      provide: PeopleService,
      inject: [PrismaPeopleRepository, LoggingPersonEventPublisher],
      useFactory: (
        repository: PrismaPeopleRepository,
        eventPublisher: LoggingPersonEventPublisher,
      ): PeopleService => new PeopleService(repository, eventPublisher),
    },
  ],
  exports: [PeopleService, PersonRelationshipService],
})
export class PeopleModule {}
