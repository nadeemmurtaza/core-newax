import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AccessControlModule } from './access-control/access-control.module';
import { AccountAccessModule } from './account-access/account-access.module';
import { AddressesModule } from './addresses/addresses.module';
import { AuditModule } from './audit/audit.module';
import { AuthenticationHttpController } from './authentication-http/authentication-http.controller';
import { AuthenticationModule } from './authentication/authentication.module';
import { validateEnvironment } from './config/environment';
import { ContactsModule } from './contacts/contacts.module';
import { DatabaseModule } from './database/database.module';
import { ExternalReferencesModule } from './external-references/external-references.module';
import { FilesModule } from './files/files.module';
import { HealthController } from './health/health.controller';
import { HttpSecurityModule } from './http-security/http-security.module';
import { MembershipsModule } from './memberships/memberships.module';
import { ObjectsModule } from './objects/objects.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PeopleIntakeModule } from './people-intake/people-intake.module';
import { PeopleModule } from './people/people.module';
import { RequestContextModule } from './request-context/request-context.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnvironment,
    }),
    DatabaseModule,
    TenantsModule,
    OrganizationsModule,
    PeopleModule,
    PeopleIntakeModule,
    ContactsModule,
    AddressesModule,
    AuditModule,
    ObjectsModule,
    FilesModule,
    ExternalReferencesModule,
    MembershipsModule,
    AccessControlModule,
    UsersModule,
    AuthenticationModule,
    RequestContextModule,
    HttpSecurityModule,
    AccountAccessModule,
  ],
  controllers: [HealthController, AuthenticationHttpController],
  providers: [],
})
export class AppModule {}
