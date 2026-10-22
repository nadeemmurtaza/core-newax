import { PeopleIntakeModuleError } from '../errors/people-intake-module-error';
import type {
  PeopleIntakePayload,
  PeopleIntakePayloadInput,
  ProposedPerson,
  ProposedPersonIdentifier,
  ProposedPersonInput,
  ProposedPersonRelationship,
  ProposedPersonRelationshipInput,
} from '../types/people-intake';

const MAX_PEOPLE = 50;
const MAX_RELATIONSHIPS = 100;
const MAX_IDENTIFIERS_PER_PERSON = 8;
const CLIENT_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/u;
const CODE_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export class PeopleIntakeValidator {
  normalizePayload(input: PeopleIntakePayloadInput): PeopleIntakePayload {
    if (input.schemaVersion !== 1) {
      this.invalid('payload.schemaVersion', 'schemaVersion must be 1.');
    }
    if (
      !Array.isArray(input.people) ||
      input.people.length < 1 ||
      input.people.length > MAX_PEOPLE
    ) {
      this.invalid(
        'payload.people',
        `people must contain between 1 and ${String(MAX_PEOPLE)} records.`,
      );
    }
    if (!Array.isArray(input.relationships) || input.relationships.length > MAX_RELATIONSHIPS) {
      this.invalid(
        'payload.relationships',
        `relationships must contain no more than ${String(MAX_RELATIONSHIPS)} records.`,
      );
    }

    const keys = new Set<string>();
    const identifierKeys = new Set<string>();
    const people = input.people.map((person, index) => {
      const normalized = this.normalizePerson(person, index, identifierKeys);
      if (keys.has(normalized.clientKey)) {
        this.invalid(
          `payload.people[${String(index)}].clientKey`,
          'clientKey must be unique within the intake.',
        );
      }
      keys.add(normalized.clientKey);
      return normalized;
    });

    const relationshipKeys = new Set<string>();
    const relationships = input.relationships.map((relationship, index) => {
      const normalized = this.normalizeRelationship(relationship, index, keys);
      const key = [
        normalized.sourcePersonKey,
        normalized.targetPersonKey,
        normalized.relationshipType,
        normalized.relationshipRole,
        normalized.relationshipBasis,
      ].join('|');
      if (relationshipKeys.has(key)) {
        this.invalid(
          `payload.relationships[${String(index)}]`,
          'The same proposed relationship cannot be repeated.',
        );
      }
      relationshipKeys.add(key);
      return normalized;
    });

    this.assertNoParentCycle(relationships);
    return { schemaVersion: 1, people, relationships };
  }

  private normalizePerson(
    input: ProposedPersonInput,
    index: number,
    identifierKeys: Set<string>,
  ): ProposedPerson {
    const field = `payload.people[${String(index)}]`;
    const clientKey = this.code(input.clientKey, `${field}.clientKey`, 64, CLIENT_KEY_PATTERN);
    const identifiersInput = input.identifiers ?? [];
    if (!Array.isArray(identifiersInput) || identifiersInput.length > MAX_IDENTIFIERS_PER_PERSON) {
      this.invalid(
        `${field}.identifiers`,
        `identifiers must contain no more than ${String(MAX_IDENTIFIERS_PER_PERSON)} records.`,
      );
    }
    const identifiers = identifiersInput.map((identifier, identifierIndex) => {
      const normalized = this.normalizeIdentifier(
        identifier,
        `${field}.identifiers[${String(identifierIndex)}]`,
      );
      const duplicateKey = [
        normalized.identifierType,
        normalized.issuingCountryCode ?? '',
        normalized.issuingAuthority?.toUpperCase() ?? '',
        normalized.identifierValue.toUpperCase().replace(/[\s-]/gu, ''),
      ].join('|');
      if (identifierKeys.has(duplicateKey)) {
        this.invalid(
          `${field}.identifiers[${String(identifierIndex)}].identifierValue`,
          'An official identifier cannot be repeated within the intake.',
        );
      }
      identifierKeys.add(duplicateKey);
      return normalized;
    });

    return {
      clientKey,
      firstName: this.text(input.firstName, `${field}.firstName`, 128),
      middleName: this.nullableText(input.middleName, `${field}.middleName`, 128),
      lastName: this.text(input.lastName, `${field}.lastName`, 128),
      preferredName: this.nullableText(input.preferredName, `${field}.preferredName`, 128),
      dateOfBirth: this.date(input.dateOfBirth, `${field}.dateOfBirth`),
      gender: this.nullableCode(input.gender, `${field}.gender`, 32),
      identifiers,
    };
  }

  private normalizeIdentifier(
    input: {
      readonly identifierType: string;
      readonly identifierValue: string;
      readonly issuingAuthority?: string | null;
      readonly issuingCountryCode?: string | null;
    },
    field: string,
  ): ProposedPersonIdentifier {
    return {
      identifierType: this.code(input.identifierType, `${field}.identifierType`, 64, CODE_PATTERN),
      identifierValue: this.text(input.identifierValue, `${field}.identifierValue`, 255),
      issuingAuthority: this.nullableText(input.issuingAuthority, `${field}.issuingAuthority`, 255),
      issuingCountryCode: this.country(input.issuingCountryCode, `${field}.issuingCountryCode`),
    };
  }

  private normalizeRelationship(
    input: ProposedPersonRelationshipInput,
    index: number,
    personKeys: ReadonlySet<string>,
  ): ProposedPersonRelationship {
    const field = `payload.relationships[${String(index)}]`;
    const sourcePersonKey = this.code(
      input.sourcePersonKey,
      `${field}.sourcePersonKey`,
      64,
      CLIENT_KEY_PATTERN,
    );
    const targetPersonKey = this.code(
      input.targetPersonKey,
      `${field}.targetPersonKey`,
      64,
      CLIENT_KEY_PATTERN,
    );
    if (!personKeys.has(sourcePersonKey) || !personKeys.has(targetPersonKey)) {
      this.invalid(field, 'Relationship endpoints must reference people in the same intake.');
    }
    if (sourcePersonKey === targetPersonKey) {
      this.invalid(field, 'A proposed relationship must connect two different people.');
    }
    return {
      sourcePersonKey,
      targetPersonKey,
      relationshipType: this.code(
        input.relationshipType,
        `${field}.relationshipType`,
        64,
        CODE_PATTERN,
      ),
      relationshipRole: this.code(
        input.relationshipRole,
        `${field}.relationshipRole`,
        64,
        CODE_PATTERN,
      ),
      relationshipBasis: this.code(
        input.relationshipBasis,
        `${field}.relationshipBasis`,
        64,
        CODE_PATTERN,
      ),
    };
  }

  private assertNoParentCycle(relationships: readonly ProposedPersonRelationship[]): void {
    const graph = new Map<string, string[]>();
    for (const relationship of relationships) {
      if (relationship.relationshipType !== 'parent_of') {
        continue;
      }
      const targets = graph.get(relationship.sourcePersonKey) ?? [];
      targets.push(relationship.targetPersonKey);
      graph.set(relationship.sourcePersonKey, targets);
    }
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (key: string): void => {
      if (visiting.has(key)) {
        this.invalid(
          'payload.relationships',
          'Proposed parent relationships cannot form an ancestry cycle.',
        );
      }
      if (visited.has(key)) {
        return;
      }
      visiting.add(key);
      for (const target of graph.get(key) ?? []) {
        visit(target);
      }
      visiting.delete(key);
      visited.add(key);
    };
    for (const key of graph.keys()) {
      visit(key);
    }
  }

  private text(value: string, field: string, maximum: number): string {
    if (typeof value !== 'string') {
      this.invalid(field, `${field} must be text.`);
    }
    const normalized = value.trim();
    if (normalized.length < 1 || normalized.length > maximum) {
      this.invalid(field, `${field} must contain between 1 and ${String(maximum)} characters.`);
    }
    return normalized;
  }

  private nullableText(
    value: string | null | undefined,
    field: string,
    maximum: number,
  ): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    return this.text(value, field, maximum);
  }

  private code(value: string, field: string, maximum: number, pattern: RegExp): string {
    const normalized = this.text(value, field, maximum).toLowerCase();
    if (!pattern.test(normalized)) {
      this.invalid(field, `${field} must use a stable lowercase machine-readable code.`);
    }
    return normalized;
  }

  private nullableCode(
    value: string | null | undefined,
    field: string,
    maximum: number,
  ): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    return this.code(value, field, maximum, CODE_PATTERN);
  }

  private country(value: string | null | undefined, field: string): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    const normalized = value.trim().toUpperCase();
    if (!/^[A-Z]{2}$/u.test(normalized)) {
      this.invalid(field, `${field} must contain a two-letter country code.`);
    }
    return normalized;
  }

  private date(value: string | null | undefined, field: string): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) {
      this.invalid(field, `${field} must use YYYY-MM-DD format.`);
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      this.invalid(field, `${field} must be a real calendar date.`);
    }
    const today = new Date().toISOString().slice(0, 10);
    if (value > today) {
      this.invalid(field, `${field} cannot be in the future.`);
    }
    return value;
  }

  private invalid(field: string, message: string): never {
    throw new PeopleIntakeModuleError('PEOPLE_INTAKE_INVALID_INPUT', message, { field });
  }
}
