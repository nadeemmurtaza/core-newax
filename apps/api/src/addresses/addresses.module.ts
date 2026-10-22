import { Module } from '@nestjs/common';
import { AddressesService } from '@newax/addresses';

import { DatabaseModule } from '../database/database.module';
import { RequestContextModule } from '../request-context/request-context.module';
import { CurrentOrganizationAddressesController } from './current-organization-addresses.controller';
import { LoggingAddressEventPublisher } from './logging-address-event.publisher';
import { PrismaAddressesRepository } from './prisma-addresses.repository';

@Module({
  imports: [DatabaseModule, RequestContextModule],
  controllers: [CurrentOrganizationAddressesController],
  providers: [
    PrismaAddressesRepository,
    LoggingAddressEventPublisher,
    {
      provide: AddressesService,
      inject: [PrismaAddressesRepository, LoggingAddressEventPublisher],
      useFactory: (
        repository: PrismaAddressesRepository,
        eventPublisher: LoggingAddressEventPublisher,
      ): AddressesService => new AddressesService(repository, eventPublisher),
    },
  ],
  exports: [AddressesService],
})
export class AddressesModule {}
