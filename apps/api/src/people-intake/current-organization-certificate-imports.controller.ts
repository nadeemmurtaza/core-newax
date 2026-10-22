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
  Req,
} from '@nestjs/common';
import {
  CertificateImportService,
  PEOPLE_INTAKE_PERMISSIONS,
  type CertificateImportRecord,
  type EvidenceFileSummary,
} from '@newax/people-intake';
import { HttpSecurityError } from '@newax/http-security';
import { ContextAuthorizer, type TrustedOrganizationRequestContext } from '@newax/request-context';

import {
  OrganizationContextEndpoint,
  RequirePermissions,
} from '../http-security/http-security.decorators';
import type { HttpSecurityRequestAdapter } from '../http-security/http-security-request';
import {
  parseApplyImportBody,
  parseAttachEvidenceBody,
  parseExtractionBody,
  parseImportReviewBody,
} from './current-organization-certificate-imports.input';

@Controller('core/organizations/current/people-intakes')
export class CurrentOrganizationCertificateImportsController {
  constructor(
    @Inject(CertificateImportService) private readonly service: CertificateImportService,
    @Inject(ContextAuthorizer) private readonly authorizer: ContextAuthorizer,
  ) {}

  @Get(':intakeId/evidence')
  @Header('Cache-Control', 'no-store')
  @OrganizationContextEndpoint()
  @RequirePermissions(PEOPLE_INTAKE_PERMISSIONS.evidenceView)
  async listEvidence(
    @Req() request: HttpSecurityRequestAdapter,
    @Param('intakeId') intakeId: string,
  ) {
    return {
      success: true as const,
      data: (await this.service.listEvidence(this.context(request), intakeId)).map(this.evidence),
    };
  }

  @Post(':intakeId/evidence')
  @HttpCode(201)
  @Header('Cache-Control', 'no-store')
  @OrganizationContextEndpoint()
  @RequirePermissions(PEOPLE_INTAKE_PERMISSIONS.evidenceAttach)
  async attachEvidence(
    @Req() request: HttpSecurityRequestAdapter,
    @Param('intakeId') intakeId: string,
    @Body() body: unknown,
  ) {
    return {
      success: true as const,
      data: this.evidence(
        await this.service.attachEvidence(
          this.context(request),
          intakeId,
          parseAttachEvidenceBody(body),
        ),
      ),
    };
  }

  @Post(':intakeId/evidence/:evidenceId/certificate-imports')
  @HttpCode(201)
  @Header('Cache-Control', 'no-store')
  @OrganizationContextEndpoint()
  @RequirePermissions(PEOPLE_INTAKE_PERMISSIONS.certificateExtract)
  async createImport(
    @Req() request: HttpSecurityRequestAdapter,
    @Param('intakeId') intakeId: string,
    @Param('evidenceId') evidenceId: string,
  ) {
    return {
      success: true as const,
      data: this.importRecord(
        await this.service.createImport(this.context(request), intakeId, evidenceId),
      ),
    };
  }

  @Get('certificate-imports/:importId')
  @Header('Cache-Control', 'no-store')
  @OrganizationContextEndpoint()
  @RequirePermissions(PEOPLE_INTAKE_PERMISSIONS.evidenceView)
  async getImport(@Req() request: HttpSecurityRequestAdapter, @Param('importId') importId: string) {
    return {
      success: true as const,
      data: this.importRecord(await this.service.getImport(this.context(request), importId)),
    };
  }

  @Put('certificate-imports/:importId/extraction')
  @Header('Cache-Control', 'no-store')
  @OrganizationContextEndpoint()
  @RequirePermissions(PEOPLE_INTAKE_PERMISSIONS.certificateExtract)
  async extract(
    @Req() request: HttpSecurityRequestAdapter,
    @Param('importId') importId: string,
    @Body() body: unknown,
  ) {
    return {
      success: true as const,
      data: this.importRecord(
        await this.service.recordExtraction(
          this.context(request),
          importId,
          parseExtractionBody(body),
        ),
      ),
    };
  }

  @Post('certificate-imports/:importId/review')
  @Header('Cache-Control', 'no-store')
  @OrganizationContextEndpoint()
  @RequirePermissions(PEOPLE_INTAKE_PERMISSIONS.certificateReview)
  async review(
    @Req() request: HttpSecurityRequestAdapter,
    @Param('importId') importId: string,
    @Body() body: unknown,
  ) {
    return {
      success: true as const,
      data: this.importRecord(
        await this.service.reviewImport(
          this.context(request),
          importId,
          parseImportReviewBody(body),
        ),
      ),
    };
  }

  @Post('certificate-imports/:importId/apply')
  @Header('Cache-Control', 'no-store')
  @OrganizationContextEndpoint()
  @RequirePermissions(PEOPLE_INTAKE_PERMISSIONS.certificateApply)
  async apply(
    @Req() request: HttpSecurityRequestAdapter,
    @Param('importId') importId: string,
    @Body() body: unknown,
  ) {
    return {
      success: true as const,
      data: this.importRecord(
        await this.service.applyImport(this.context(request), importId, parseApplyImportBody(body)),
      ),
    };
  }

  private context(request: HttpSecurityRequestAdapter) {
    const context = request.trustedContext;
    if (context === undefined || context.scope !== 'organization') {
      throw new HttpSecurityError(
        'HTTP_SECURITY_INVALID_INPUT',
        'Trusted organization context was not established.',
        500,
      );
    }
    return this.authorizer.toModuleContext(context as TrustedOrganizationRequestContext);
  }

  private evidence(item: EvidenceFileSummary) {
    return {
      id: item.id,
      intake_id: item.intakeId,
      file_id: item.fileId,
      document_type: item.documentType,
      evidence_role: item.evidenceRole,
      file_name: item.fileName,
      mime_type: item.mimeType,
      file_size: item.fileSize.toString(),
      certificate_import_id: item.certificateImportId,
      certificate_import_status: item.certificateImportStatus,
      created_at: item.createdAt.toISOString(),
    };
  }

  private importRecord(item: CertificateImportRecord) {
    return {
      id: item.id,
      evidence_id: item.evidenceId,
      intake_id: item.intakeId,
      status: item.status,
      extraction_payload: item.extractionPayload,
      extractor_code: item.extractorCode,
      extraction_version: item.extractionVersion,
      confidence_bps: item.confidenceBps,
      extracted_by_user_id: item.extractedByUserId,
      extracted_at: item.extractedAt?.toISOString() ?? null,
      reviewed_by_user_id: item.reviewedByUserId,
      reviewed_at: item.reviewedAt?.toISOString() ?? null,
      review_decision: item.reviewDecision,
      review_notes: item.reviewNotes,
      applied_by_user_id: item.appliedByUserId,
      applied_at: item.appliedAt?.toISOString() ?? null,
      version: item.version,
      intake_version: item.intakeVersion,
      intake_status: item.intakeStatus,
      created_at: item.createdAt.toISOString(),
      updated_at: item.updatedAt.toISOString(),
    };
  }
}
