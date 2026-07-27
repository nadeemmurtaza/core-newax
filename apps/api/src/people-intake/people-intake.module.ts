import { Module } from '@nestjs/common';
import { PeopleIntakeService } from '@newax/people-intake';

import { DatabaseModule } from '../database/database.module';
import { RequestContextModule } from '../request-context/request-context.module';
import { CurrentOrganizationPeopleIntakesController } from './current-organization-people-intakes.controller';
import { PrismaPeopleIntakeRepository } from './prisma-people-intake.repository';

@Module({
  imports: [DatabaseModule, RequestContextModule],
  controllers: [CurrentOrganizationPeopleIntakesController],
  providers: [
    PrismaPeopleIntakeRepository,
    {
      provide: PeopleIntakeService,
      inject: [PrismaPeopleIntakeRepository],
      useFactory: (repository: PrismaPeopleIntakeRepository): PeopleIntakeService =>
        new PeopleIntakeService(repository),
    },
  ],
  exports: [PeopleIntakeService],
})
export class PeopleIntakeModule {}
