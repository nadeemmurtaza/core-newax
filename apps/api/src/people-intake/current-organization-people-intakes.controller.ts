import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  PEOPLE_INTAKE_PERMISSIONS,
  PeopleIntakeService,
  type PeopleIntakeRecord,
  type PeopleIntakeSummary,
} from '@newax/people-intake';
import { HttpSecurityError } from '@newax/http-security';
import { ContextAuthorizer, type TrustedOrganizationRequestContext } from '@newax/request-context';

import {
  OrganizationContextEndpoint,
  RequirePermissions,
} from '../http-security/http-security.decorators';
import type { HttpSecurityRequestAdapter } from '../http-security/http-security-request';
import {
  assertEmptyPeopleIntakeQuery,
  parseCreatePeopleIntakeBody,
  parsePeopleIntakeListQuery,
  parseReviewPeopleIntakeBody,
  parseSubmitPeopleIntakeBody,
  parseUpdatePeopleIntakeBody,
} from './current-organization-people-intakes.input';

@Controller('core/organizations/current/people-intakes')
export class CurrentOrganizationPeopleIntakesController {
  constructor(
    @Inject(PeopleIntakeService) private readonly intakes: PeopleIntakeService,
    @Inject(ContextAuthorizer) private readonly authorizer: ContextAuthorizer,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @OrganizationContextEndpoint()
  @RequirePermissions(PEOPLE_INTAKE_PERMISSIONS.view)
  async list(@Req() request: HttpSecurityRequestAdapter, @Query() query: unknown) {
    const page = await this.intakes.list(this.context(request), parsePeopleIntakeListQuery(query));
    return {
      success: true as const,
      data: {
        items: page.items.map((item) => this.summary(item)),
        next_cursor: page.nextCursor,
      },
    };
  }

  @Post()
  @HttpCode(201)
  @Header('Cache-Control', 'no-store')
  @OrganizationContextEndpoint()
  @RequirePermissions(PEOPLE_INTAKE_PERMISSIONS.create)
  async create(
    @Req() request: HttpSecurityRequestAdapter,
    @Query() query: unknown,
    @Body() body: unknown,
  ) {
    assertEmptyPeopleIntakeQuery(query);
    return {
      success: true as const,
      data: this.record(
        await this.intakes.createDraft(this.context(request), parseCreatePeopleIntakeBody(body)),
      ),
    };
  }

  @Get(':intakeId')
  @Header('Cache-Control', 'no-store')
  @OrganizationContextEndpoint()
  @RequirePermissions(PEOPLE_INTAKE_PERMISSIONS.view)
  async get(
    @Req() request: HttpSecurityRequestAdapter,
    @Param('intakeId') intakeId: string,
    @Query() query: unknown,
  ) {
    assertEmptyPeopleIntakeQuery(query);
    return {
      success: true as const,
      data: this.record(await this.intakes.get(this.context(request), intakeId)),
    };
  }

  @Put(':intakeId')
  @Header('Cache-Control', 'no-store')
  @OrganizationContextEndpoint()
  @RequirePermissions(PEOPLE_INTAKE_PERMISSIONS.update)
  async update(
    @Req() request: HttpSecurityRequestAdapter,
    @Param('intakeId') intakeId: string,
    @Query() query: unknown,
    @Body() body: unknown,
  ) {
    assertEmptyPeopleIntakeQuery(query);
    return {
      success: true as const,
      data: this.record(
        await this.intakes.updateDraft(
          this.context(request),
          intakeId,
          parseUpdatePeopleIntakeBody(body),
        ),
      ),
    };
  }

  @Post(':intakeId/submit')
  @Header('Cache-Control', 'no-store')
  @OrganizationContextEndpoint()
  @RequirePermissions(PEOPLE_INTAKE_PERMISSIONS.submit)
  async submit(
    @Req() request: HttpSecurityRequestAdapter,
    @Param('intakeId') intakeId: string,
    @Query() query: unknown,
    @Body() body: unknown,
  ) {
    assertEmptyPeopleIntakeQuery(query);
    return {
      success: true as const,
      data: this.record(
        await this.intakes.submit(
          this.context(request),
          intakeId,
          parseSubmitPeopleIntakeBody(body),
        ),
      ),
    };
  }

  @Post(':intakeId/review')
  @Header('Cache-Control', 'no-store')
  @OrganizationContextEndpoint()
  @RequirePermissions(PEOPLE_INTAKE_PERMISSIONS.review)
  async review(
    @Req() request: HttpSecurityRequestAdapter,
    @Param('intakeId') intakeId: string,
    @Query() query: unknown,
    @Body() body: unknown,
  ) {
    assertEmptyPeopleIntakeQuery(query);
    return {
      success: true as const,
      data: this.record(
        await this.intakes.review(
          this.context(request),
          intakeId,
          parseReviewPeopleIntakeBody(body),
        ),
      ),
    };
  }

  private context(request: HttpSecurityRequestAdapter) {
    const context = this.organizationContext(request);
    return this.authorizer.toModuleContext(context);
  }

  private organizationContext(
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

  private summary(item: PeopleIntakeSummary) {
    return {
      id: item.id,
      title: item.title,
      source_type: item.sourceType,
      source_reference: item.sourceReference,
      status: item.status,
      person_count: item.personCount,
      relationship_count: item.relationshipCount,
      version: item.version,
      created_by_user_id: item.createdByUserId,
      submitted_at: item.submittedAt?.toISOString() ?? null,
      reviewed_at: item.reviewedAt?.toISOString() ?? null,
      reviewed_by_user_id: item.reviewedByUserId,
      review_decision: item.reviewDecision,
      review_notes: item.reviewNotes,
      created_at: item.createdAt.toISOString(),
      updated_at: item.updatedAt.toISOString(),
    };
  }

  private record(item: PeopleIntakeRecord) {
    return {
      ...this.summary(item),
      payload: {
        schema_version: 1 as const,
        people: item.payload.people.map((person) => ({
          client_key: person.clientKey,
          first_name: person.firstName,
          middle_name: person.middleName,
          last_name: person.lastName,
          preferred_name: person.preferredName,
          date_of_birth: person.dateOfBirth,
          gender: person.gender,
          identifiers: person.identifiers.map((identifier) => ({
            identifier_type: identifier.identifierType,
            identifier_value: identifier.identifierValue,
            issuing_authority: identifier.issuingAuthority,
            issuing_country_code: identifier.issuingCountryCode,
          })),
        })),
        relationships: item.payload.relationships.map((relationship) => ({
          source_person_key: relationship.sourcePersonKey,
          target_person_key: relationship.targetPersonKey,
          relationship_type: relationship.relationshipType,
          relationship_role: relationship.relationshipRole,
          relationship_basis: relationship.relationshipBasis,
        })),
      },
    };
  }
}
