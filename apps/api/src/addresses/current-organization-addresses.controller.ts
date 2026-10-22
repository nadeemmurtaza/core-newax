import { Body, Controller, Get, Header, HttpCode, Inject, Post, Query, Req } from '@nestjs/common';
import {
  ADDRESS_PERMISSIONS,
  AddressesService,
  type OrganizationAddressRecord,
} from '@newax/addresses';
import { HttpSecurityError } from '@newax/http-security';
import { ContextAuthorizer, type TrustedOrganizationRequestContext } from '@newax/request-context';

import {
  OrganizationContextEndpoint,
  RequirePermissions,
} from '../http-security/http-security.decorators';
import type { HttpSecurityRequestAdapter } from '../http-security/http-security-request';
import {
  parseCurrentOrganizationAddressBody,
  parseCurrentOrganizationAddressCreateQuery,
  parseCurrentOrganizationAddressesQuery,
} from './current-organization-addresses.input';

interface OrganizationAddressResource {
  readonly id: string;
  readonly address_type:
    'registered' | 'office' | 'billing' | 'shipping' | 'mailing' | 'campus' | 'facility' | 'other';
  readonly is_primary: boolean;
  readonly line_1: string;
  readonly line_2: string | null;
  readonly city: string;
  readonly state_region: string | null;
  readonly postal_code: string | null;
  readonly country_code: string;
  readonly created_at: string;
}

interface CreateCurrentOrganizationAddressResponse {
  readonly success: true;
  readonly data: OrganizationAddressResource;
}

interface ListCurrentOrganizationAddressesResponse {
  readonly success: true;
  readonly data: {
    readonly items: readonly OrganizationAddressResource[];
    readonly next_cursor: string | null;
  };
}

@Controller('core/organizations/current/addresses')
export class CurrentOrganizationAddressesController {
  constructor(
    @Inject(AddressesService)
    private readonly addresses: AddressesService,
    @Inject(ContextAuthorizer)
    private readonly authorizer: ContextAuthorizer,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @OrganizationContextEndpoint()
  @RequirePermissions(ADDRESS_PERMISSIONS.view)
  async list(
    @Req() request: HttpSecurityRequestAdapter,
    @Query() query: unknown,
  ): Promise<ListCurrentOrganizationAddressesResponse> {
    const context = this.requireOrganizationContext(request);
    const page = await this.addresses.listCurrentOrganizationAddresses(
      this.authorizer.toModuleContext(context),
      parseCurrentOrganizationAddressesQuery(query),
    );

    return {
      success: true,
      data: {
        items: page.items.map((address) => this.toResource(address)),
        next_cursor: page.nextCursor,
      },
    };
  }

  @Post()
  @HttpCode(201)
  @Header('Cache-Control', 'no-store')
  @OrganizationContextEndpoint()
  @RequirePermissions(ADDRESS_PERMISSIONS.create)
  async create(
    @Req() request: HttpSecurityRequestAdapter,
    @Query() query: unknown,
    @Body() body: unknown,
  ): Promise<CreateCurrentOrganizationAddressResponse> {
    parseCurrentOrganizationAddressCreateQuery(query);
    const context = this.requireOrganizationContext(request);
    const address = await this.addresses.addCurrentOrganizationAddress(
      this.authorizer.toModuleContext(context),
      parseCurrentOrganizationAddressBody(body),
    );

    return {
      success: true,
      data: this.toResource(address),
    };
  }

  private requireOrganizationContext(
    request: HttpSecurityRequestAdapter,
  ): TrustedOrganizationRequestContext {
    const context = request.trustedContext;
    if (context === undefined || context.scope !== 'organization') {
      throw new HttpSecurityError(
        'HTTP_SECURITY_INVALID_INPUT',
        'Trusted organization context was not established.',
        500,
      );
    }
    return context;
  }

  private toResource(address: OrganizationAddressRecord): OrganizationAddressResource {
    return {
      id: address.id,
      address_type: address.addressType,
      is_primary: address.isPrimary,
      line_1: address.line1,
      line_2: address.line2,
      city: address.city,
      state_region: address.stateRegion,
      postal_code: address.postalCode,
      country_code: address.countryCode,
      created_at: address.createdAt.toISOString(),
    };
  }
}
