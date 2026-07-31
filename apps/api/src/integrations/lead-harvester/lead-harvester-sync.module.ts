import { Module } from '@nestjs/common';
import { AddressesService } from '@newax/addresses';
import { ContactsService } from '@newax/contacts';
import { ExternalReferencesService } from '@newax/external-references';
import { LeadHarvesterSyncService } from '@newax/lead-harvester-sync';
import { MembershipsService } from '@newax/memberships';
import { OrganizationsService } from '@newax/organizations';
import { PeopleService } from '@newax/people';

import { AccessControlModule } from '../../access-control/access-control.module';
import { AddressesModule } from '../../addresses/addresses.module';
import { ContactsModule } from '../../contacts/contacts.module';
import { ExternalReferencesModule } from '../../external-references/external-references.module';
import { MembershipsModule } from '../../memberships/memberships.module';
import { OrganizationsModule } from '../../organizations/organizations.module';
import { PeopleModule } from '../../people/people.module';
import { LeadHarvesterServiceAccountContextFactory } from './lead-harvester-service-account-context.factory';
import { LeadHarvesterWebhookController } from './lead-harvester-webhook.controller';
import { LeadHarvesterWebhookGuard } from './lead-harvester-webhook.guard';
import { LoggingLeadHarvesterSyncEventPublisher } from './logging-lead-harvester-sync-event.publisher';

@Module({
  imports: [
    AccessControlModule,
    OrganizationsModule,
    AddressesModule,
    ContactsModule,
    PeopleModule,
    MembershipsModule,
    ExternalReferencesModule,
  ],
  controllers: [LeadHarvesterWebhookController],
  providers: [
    LeadHarvesterWebhookGuard,
    LeadHarvesterServiceAccountContextFactory,
    LoggingLeadHarvesterSyncEventPublisher,
    {
      provide: LeadHarvesterSyncService,
      inject: [
        ExternalReferencesService,
        OrganizationsService,
        AddressesService,
        ContactsService,
        PeopleService,
        MembershipsService,
        LoggingLeadHarvesterSyncEventPublisher,
      ],
      useFactory: (
        externalReferences: ExternalReferencesService,
        organizations: OrganizationsService,
        addresses: AddressesService,
        contacts: ContactsService,
        people: PeopleService,
        memberships: MembershipsService,
        eventPublisher: LoggingLeadHarvesterSyncEventPublisher,
      ): LeadHarvesterSyncService =>
        new LeadHarvesterSyncService(
          externalReferences,
          organizations,
          addresses,
          contacts,
          people,
          memberships,
          eventPublisher,
        ),
    },
  ],
})
export class LeadHarvesterSyncModule {}
