import { Module } from '@nestjs/common';
import { CertificateImportService, PeopleIntakeService } from '@newax/people-intake';

import { DatabaseModule } from '../database/database.module';
import { RequestContextModule } from '../request-context/request-context.module';
import { CurrentOrganizationCertificateImportsController } from './current-organization-certificate-imports.controller';
import { CurrentOrganizationPeopleIntakesController } from './current-organization-people-intakes.controller';
import { PrismaCertificateImportRepository } from './prisma-certificate-import.repository';
import { PrismaPeopleIntakeRepository } from './prisma-people-intake.repository';

@Module({
  imports: [DatabaseModule, RequestContextModule],
  controllers: [
    CurrentOrganizationPeopleIntakesController,
    CurrentOrganizationCertificateImportsController,
  ],
  providers: [
    PrismaPeopleIntakeRepository,
    PrismaCertificateImportRepository,
    {
      provide: CertificateImportService,
      inject: [PrismaCertificateImportRepository],
      useFactory: (repository: PrismaCertificateImportRepository): CertificateImportService =>
        new CertificateImportService(repository),
    },
    {
      provide: PeopleIntakeService,
      inject: [PrismaPeopleIntakeRepository],
      useFactory: (repository: PrismaPeopleIntakeRepository): PeopleIntakeService =>
        new PeopleIntakeService(repository),
    },
  ],
  exports: [PeopleIntakeService, CertificateImportService],
})
export class PeopleIntakeModule {}
