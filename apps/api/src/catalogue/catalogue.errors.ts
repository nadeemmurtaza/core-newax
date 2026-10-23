import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

/**
 * Plain Nest HttpExceptions rather than a custom error class mapped by a
 * filter: @newax/organizations' OrganizationModuleError pattern exists but
 * nothing in apps/api currently catches or maps it to an HTTP status (grep
 * confirms no handler), so following that pattern here would silently
 * produce 500s. Using Nest's built-ins directly actually works.
 */
export class CatalogueModuleError {
  static notFound(message: string): NotFoundException {
    return new NotFoundException({ code: 'CATALOGUE_NOT_FOUND', message });
  }

  static forbidden(message: string): ForbiddenException {
    return new ForbiddenException({ code: 'CATALOGUE_FORBIDDEN', message });
  }

  static invalidInput(message: string): BadRequestException {
    return new BadRequestException({ code: 'CATALOGUE_INVALID_INPUT', message });
  }
}
