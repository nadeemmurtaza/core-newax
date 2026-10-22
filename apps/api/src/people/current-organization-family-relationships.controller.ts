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
  PEOPLE_PERMISSIONS,
  PersonRelationshipService,
  type FamilyTreeGraph,
  type PersonRelationshipRecord,
} from '@newax/people';
import { HttpSecurityError } from '@newax/http-security';
import { ContextAuthorizer, type TrustedOrganizationRequestContext } from '@newax/request-context';

import {
  OrganizationContextEndpoint,
  RequirePermissions,
} from '../http-security/http-security.decorators';
import type { HttpSecurityRequestAdapter } from '../http-security/http-security-request';
import {
  parseCreateRelationshipBody,
  parseEndRelationshipBody,
  parseFamilyTreeQuery,
  parseRelationshipViewQuery,
  parseRevokeVerificationBody,
  parseUpdateRelationshipBody,
  parseVerifyRelationshipBody,
} from './current-organization-family-relationships.input';

@Controller('core/organizations/current')
export class CurrentOrganizationFamilyRelationshipsController {
  constructor(
    @Inject(PersonRelationshipService)
    private readonly relationships: PersonRelationshipService,
    @Inject(ContextAuthorizer) private readonly authorizer: ContextAuthorizer,
  ) {}

  @Get('family-tree/:personId')
  @Header('Cache-Control', 'no-store')
  @OrganizationContextEndpoint()
  @RequirePermissions(PEOPLE_PERMISSIONS.relationshipsView)
  async familyTree(
    @Req() request: HttpSecurityRequestAdapter,
    @Param('personId') personId: string,
    @Query() query: unknown,
  ) {
    return {
      success: true as const,
      data: this.graph(
        await this.relationships.familyTree(
          this.context(request),
          personId,
          parseFamilyTreeQuery(query),
        ),
      ),
    };
  }

  @Get('person-relationships/:relationshipId')
  @Header('Cache-Control', 'no-store')
  @OrganizationContextEndpoint()
  @RequirePermissions(PEOPLE_PERMISSIONS.relationshipsView)
  async get(
    @Req() request: HttpSecurityRequestAdapter,
    @Param('relationshipId') relationshipId: string,
    @Query() query: unknown,
  ) {
    return {
      success: true as const,
      data: this.relationship(
        await this.relationships.get(
          this.context(request),
          relationshipId,
          parseRelationshipViewQuery(query),
        ),
      ),
    };
  }

  @Post('person-relationships')
  @HttpCode(201)
  @Header('Cache-Control', 'no-store')
  @OrganizationContextEndpoint()
  @RequirePermissions(PEOPLE_PERMISSIONS.relationshipsManage)
  async create(@Req() request: HttpSecurityRequestAdapter, @Body() body: unknown) {
    return {
      success: true as const,
      data: this.relationship(
        await this.relationships.create(this.context(request), parseCreateRelationshipBody(body)),
      ),
    };
  }

  @Put('person-relationships/:relationshipId')
  @Header('Cache-Control', 'no-store')
  @OrganizationContextEndpoint()
  @RequirePermissions(PEOPLE_PERMISSIONS.relationshipsManage)
  async update(
    @Req() request: HttpSecurityRequestAdapter,
    @Param('relationshipId') relationshipId: string,
    @Body() body: unknown,
  ) {
    return {
      success: true as const,
      data: this.relationship(
        await this.relationships.update(
          this.context(request),
          relationshipId,
          parseUpdateRelationshipBody(body),
        ),
      ),
    };
  }

  @Post('person-relationships/:relationshipId/end')
  @Header('Cache-Control', 'no-store')
  @OrganizationContextEndpoint()
  @RequirePermissions(PEOPLE_PERMISSIONS.relationshipsManage)
  async end(
    @Req() request: HttpSecurityRequestAdapter,
    @Param('relationshipId') relationshipId: string,
    @Body() body: unknown,
  ) {
    return {
      success: true as const,
      data: this.relationship(
        await this.relationships.end(
          this.context(request),
          relationshipId,
          parseEndRelationshipBody(body),
        ),
      ),
    };
  }

  @Post('person-relationships/:relationshipId/verify')
  @Header('Cache-Control', 'no-store')
  @OrganizationContextEndpoint()
  @RequirePermissions(PEOPLE_PERMISSIONS.relationshipsVerify)
  async verify(
    @Req() request: HttpSecurityRequestAdapter,
    @Param('relationshipId') relationshipId: string,
    @Body() body: unknown,
  ) {
    return {
      success: true as const,
      data: this.relationship(
        await this.relationships.verify(
          this.context(request),
          relationshipId,
          parseVerifyRelationshipBody(body),
        ),
      ),
    };
  }

  @Post('person-relationships/:relationshipId/verification/revoke')
  @Header('Cache-Control', 'no-store')
  @OrganizationContextEndpoint()
  @RequirePermissions(PEOPLE_PERMISSIONS.relationshipsVerify)
  async revokeVerification(
    @Req() request: HttpSecurityRequestAdapter,
    @Param('relationshipId') relationshipId: string,
    @Body() body: unknown,
  ) {
    return {
      success: true as const,
      data: this.relationship(
        await this.relationships.revokeVerification(
          this.context(request),
          relationshipId,
          parseRevokeVerificationBody(body),
        ),
      ),
    };
  }

  private context(request: HttpSecurityRequestAdapter) {
    const trusted = this.organizationContext(request);
    return this.authorizer.toModuleContext(trusted);
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

  private relationship(item: PersonRelationshipRecord) {
    return {
      id: item.id,
      tenant_id: item.tenantId,
      source_person_id: item.sourcePersonId,
      target_person_id: item.targetPersonId,
      relationship_type: item.relationshipType,
      relationship_role: item.relationshipRole,
      relationship_basis: item.relationshipBasis,
      status: item.status,
      valid_from: this.date(item.validFrom),
      valid_until: this.date(item.validUntil),
      is_verified: item.isVerified,
      verified_at: item.verifiedAt?.toISOString() ?? null,
      verified_by_user_id: item.verifiedByUserId,
      verification_source: item.verificationSource,
      verification_revoked_at: item.verificationRevokedAt?.toISOString() ?? null,
      verification_revoked_by_user_id: item.verificationRevokedByUserId,
      verification_revocation_reason: item.verificationRevocationReason,
      source_reference: item.sourceReference,
      version: item.version,
      created_at: item.createdAt.toISOString(),
      updated_at: item.updatedAt.toISOString(),
    };
  }

  private graph(item: FamilyTreeGraph) {
    return {
      root_person_id: item.rootPersonId,
      depth: item.depth,
      sensitive_fields_included: item.sensitiveFieldsIncluded,
      truncated: item.truncated,
      nodes: item.nodes.map((node) => ({
        id: node.id,
        first_name: node.firstName,
        middle_name: node.middleName,
        last_name: node.lastName,
        preferred_name: node.preferredName,
        status: node.status,
        date_of_birth: this.date(node.dateOfBirth),
        gender: node.gender,
        identifiers: node.identifiers.map((identifier) => ({
          id: identifier.id,
          identifier_type: identifier.identifierType,
          identifier_value: identifier.identifierValue,
          masked_value: identifier.maskedValue,
          issuing_authority: identifier.issuingAuthority,
          issuing_country_code: identifier.issuingCountryCode,
          is_verified: identifier.isVerified,
        })),
      })),
      relationships: item.relationships.map((relationship) => ({
        id: relationship.id,
        source_person_id: relationship.sourcePersonId,
        target_person_id: relationship.targetPersonId,
        relationship_type: relationship.relationshipType,
        relationship_role: relationship.relationshipRole,
        relationship_basis: relationship.relationshipBasis,
        status: relationship.status,
        valid_from: this.date(relationship.validFrom),
        valid_until: this.date(relationship.validUntil),
        is_verified: relationship.isVerified,
        verification_source: relationship.verificationSource,
        source_reference: relationship.sourceReference,
        version: relationship.version,
        updated_at: relationship.updatedAt.toISOString(),
      })),
    };
  }

  private date(value: Date | null): string | null {
    return value?.toISOString().slice(0, 10) ?? null;
  }
}
