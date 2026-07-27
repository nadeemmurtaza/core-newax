import { Body, Controller, Get, Header, HttpCode, Inject, Post, Query, Req } from '@nestjs/common';
import { OBJECT_PERMISSIONS, ObjectsService, type ObjectRecord } from '@newax/objects';
import { HttpSecurityError } from '@newax/http-security';
import { ContextAuthorizer, type TrustedOrganizationRequestContext } from '@newax/request-context';

import {
  OrganizationContextEndpoint,
  RequirePermissions,
} from '../http-security/http-security.decorators';
import type { HttpSecurityRequestAdapter } from '../http-security/http-security-request';
import {
  parseCurrentOrganizationObjectBody,
  parseCurrentOrganizationObjectCreateQuery,
  parseCurrentOrganizationObjectsQuery,
} from './current-organization-objects.input';

interface OrganizationObjectResource {
  readonly id: string;
  readonly object_type_code: string;
  readonly parent_object_id: string | null;
  readonly name: string;
  readonly reference_code: string | null;
  readonly serial_number: string | null;
  readonly description: string | null;
  readonly created_at: string;
}

interface CreateCurrentOrganizationObjectResponse {
  readonly success: true;
  readonly data: OrganizationObjectResource;
}

interface ListCurrentOrganizationObjectsResponse {
  readonly success: true;
  readonly data: {
    readonly items: readonly OrganizationObjectResource[];
    readonly next_cursor: string | null;
  };
}

@Controller('core/organizations/current/objects')
export class CurrentOrganizationObjectsController {
  constructor(
    @Inject(ObjectsService)
    private readonly objects: ObjectsService,
    @Inject(ContextAuthorizer)
    private readonly authorizer: ContextAuthorizer,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @OrganizationContextEndpoint()
  @RequirePermissions(OBJECT_PERMISSIONS.view)
  async list(
    @Req() request: HttpSecurityRequestAdapter,
    @Query() query: unknown,
  ): Promise<ListCurrentOrganizationObjectsResponse> {
    const context = this.requireOrganizationContext(request);
    const page = await this.objects.listCurrentOrganizationObjects(
      this.authorizer.toModuleContext(context),
      parseCurrentOrganizationObjectsQuery(query),
    );

    return {
      success: true,
      data: {
        items: page.items.map((object) => this.toResource(object)),
        next_cursor: page.nextCursor,
      },
    };
  }

  @Post()
  @HttpCode(201)
  @Header('Cache-Control', 'no-store')
  @OrganizationContextEndpoint()
  @RequirePermissions(OBJECT_PERMISSIONS.create)
  async create(
    @Req() request: HttpSecurityRequestAdapter,
    @Query() query: unknown,
    @Body() body: unknown,
  ): Promise<CreateCurrentOrganizationObjectResponse> {
    parseCurrentOrganizationObjectCreateQuery(query);
    const context = this.requireOrganizationContext(request);
    const object = await this.objects.addCurrentOrganizationObject(
      this.authorizer.toModuleContext(context),
      parseCurrentOrganizationObjectBody(body),
    );

    return {
      success: true,
      data: this.toResource(object),
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

  private toResource(object: ObjectRecord): OrganizationObjectResource {
    return {
      id: object.id,
      object_type_code: object.objectTypeCode,
      parent_object_id: object.parentObjectId,
      name: object.name,
      reference_code: object.referenceCode,
      serial_number: object.serialNumber,
      description: object.description,
      created_at: object.createdAt.toISOString(),
    };
  }
}
