import { Body, Controller, Get, Header, HttpCode, Inject, Post, Query, Req } from '@nestjs/common';
import { CONTACT_PERMISSIONS, ContactsService, type OrganizationContact } from '@newax/contacts';
import { HttpSecurityError } from '@newax/http-security';
import { ContextAuthorizer, type TrustedOrganizationRequestContext } from '@newax/request-context';

import {
  OrganizationContextEndpoint,
  RequirePermissions,
} from '../http-security/http-security.decorators';
import type { HttpSecurityRequestAdapter } from '../http-security/http-security-request';
import {
  parseCurrentOrganizationContactBody,
  parseCurrentOrganizationContactCreateQuery,
  parseCurrentOrganizationContactsQuery,
} from './current-organization-contacts.input';

interface OrganizationContactResource {
  readonly id: string;
  readonly type: 'email' | 'phone';
  readonly value: string;
  readonly label: string | null;
  readonly is_primary: boolean;
  readonly is_verified: boolean;
  readonly verified_at: string | null;
  readonly status: 'active';
  readonly valid_from: string | null;
  readonly valid_until: string | null;
  readonly created_at: string;
}

interface CreateCurrentOrganizationContactResponse {
  readonly success: true;
  readonly data: OrganizationContactResource;
}

interface ListCurrentOrganizationContactsResponse {
  readonly success: true;
  readonly data: {
    readonly items: readonly OrganizationContactResource[];
    readonly next_cursor: string | null;
  };
}

@Controller('core/organizations/current/contacts')
export class CurrentOrganizationContactsController {
  constructor(
    @Inject(ContactsService)
    private readonly contacts: ContactsService,
    @Inject(ContextAuthorizer)
    private readonly authorizer: ContextAuthorizer,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @OrganizationContextEndpoint()
  @RequirePermissions(CONTACT_PERMISSIONS.view)
  async list(
    @Req() request: HttpSecurityRequestAdapter,
    @Query() query: unknown,
  ): Promise<ListCurrentOrganizationContactsResponse> {
    const context = this.requireOrganizationContext(request);
    const page = await this.contacts.listCurrentOrganizationContacts(
      this.authorizer.toModuleContext(context),
      parseCurrentOrganizationContactsQuery(query),
    );

    return {
      success: true,
      data: {
        items: page.items.map((contact) => this.toResource(contact)),
        next_cursor: page.nextCursor,
      },
    };
  }

  @Post()
  @HttpCode(201)
  @Header('Cache-Control', 'no-store')
  @OrganizationContextEndpoint()
  @RequirePermissions(CONTACT_PERMISSIONS.create)
  async create(
    @Req() request: HttpSecurityRequestAdapter,
    @Query() query: unknown,
    @Body() body: unknown,
  ): Promise<CreateCurrentOrganizationContactResponse> {
    parseCurrentOrganizationContactCreateQuery(query);
    const context = this.requireOrganizationContext(request);
    const contact = await this.contacts.addCurrentOrganizationContact(
      this.authorizer.toModuleContext(context),
      parseCurrentOrganizationContactBody(body),
    );

    return {
      success: true,
      data: this.toResource(contact),
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

  private toResource(contact: OrganizationContact): OrganizationContactResource {
    return {
      id: contact.id,
      type: contact.contactType,
      value: contact.contactValue,
      label: contact.label,
      is_primary: contact.isPrimary,
      is_verified: contact.isVerified,
      verified_at: contact.verifiedAt?.toISOString() ?? null,
      status: contact.status,
      valid_from: this.toDateOnly(contact.validFrom),
      valid_until: this.toDateOnly(contact.validUntil),
      created_at: contact.createdAt.toISOString(),
    };
  }

  private toDateOnly(value: Date | null): string | null {
    return value === null ? null : value.toISOString().slice(0, 10);
  }
}
