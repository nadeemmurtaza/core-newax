import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { HttpSecurityModule } from '../http-security/http-security.module';
import { RequestContextModule } from '../request-context/request-context.module';
import { BrandCatalogueController } from './brand-catalogue.controller';
import { BrandsController } from './brands.controller';
import { CatalogueRepository } from './catalogue.repository';
import { CatalogueService } from './catalogue.service';

/**
 * NEWAX_CORE_SERVICE_CATALOGUE_AND_MODULE_PAGES_ADDENDUM_v1, P0 slice only:
 * CORE-SVC-01 (Brand Overview), -02 (Service Catalogue), -03 (Service
 * Category), -05/-09 (launch resolution + states, via
 * BrandCatalogueController's /launch endpoint -- real service/not-found/
 * setup-required/unavailable/blocked-by-missing-bridge outcomes, never a
 * fake launch). CORE-SVC-04, -06, -07, -08, -10 (P1/P2: service detail,
 * search/quick-launch, brand service configuration, role assignment,
 * catalogue administration) are deferred, per the doc's own priority
 * ordering and section 10's instruction not to implement every listed
 * screen at once.
 *
 * Deliberate simplification from this repo's usual per-domain workspace
 * package (packages/organizations, packages/addresses, ...): catalogue's
 * repository/service live directly in apps/api/src/catalogue instead of a
 * new packages/catalogue. Promote it to a package if/when CORE-SVC-07/-10
 * (write access) land and need the same layering the other domains have.
 */
@Module({
  imports: [DatabaseModule, HttpSecurityModule, RequestContextModule],
  controllers: [BrandsController, BrandCatalogueController],
  providers: [CatalogueRepository, CatalogueService],
})
export class CatalogueModule {}
