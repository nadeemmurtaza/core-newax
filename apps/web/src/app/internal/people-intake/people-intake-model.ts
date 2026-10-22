export interface DraftIdentifier {
  readonly localId: string;
  readonly identifierType: string;
  readonly identifierValue: string;
  readonly issuingAuthority: string;
  readonly issuingCountryCode: string;
}

export interface DraftPerson {
  readonly localId: string;
  readonly clientKey: string;
  readonly firstName: string;
  readonly middleName: string;
  readonly lastName: string;
  readonly preferredName: string;
  readonly dateOfBirth: string;
  readonly gender: string;
  readonly identifiers: readonly DraftIdentifier[];
}

export interface DraftRelationship {
  readonly localId: string;
  readonly sourcePersonKey: string;
  readonly targetPersonKey: string;
  readonly relationshipType: string;
  readonly relationshipRole: string;
  readonly relationshipBasis: string;
}

export interface FamilyIntakeDraft {
  readonly intakeId: string | null;
  readonly version: number | null;
  readonly status: 'draft' | 'submitted' | 'approved' | 'rejected';
  readonly title: string;
  readonly sourceType: string;
  readonly sourceReference: string;
  readonly people: readonly DraftPerson[];
  readonly relationships: readonly DraftRelationship[];
}

export interface DraftIssue {
  readonly field: string;
  readonly message: string;
}

export function initialFamilyIntakeDraft(): FamilyIntakeDraft {
  return {
    intakeId: null,
    version: null,
    status: 'draft',
    title: '',
    sourceType: 'manual',
    sourceReference: '',
    people: [emptyPerson('person-1', 'person_1')],
    relationships: [],
  };
}

export function emptyPerson(localId: string, clientKey: string): DraftPerson {
  return {
    localId,
    clientKey,
    firstName: '',
    middleName: '',
    lastName: '',
    preferredName: '',
    dateOfBirth: '',
    gender: '',
    identifiers: [],
  };
}

export function emptyIdentifier(localId: string): DraftIdentifier {
  return {
    localId,
    identifierType: 'cnic',
    identifierValue: '',
    issuingAuthority: 'NADRA',
    issuingCountryCode: 'PK',
  };
}

export function emptyRelationship(
  localId: string,
  sourcePersonKey: string,
  targetPersonKey: string,
): DraftRelationship {
  return {
    localId,
    sourcePersonKey,
    targetPersonKey,
    relationshipType: 'parent_of',
    relationshipRole: 'parent',
    relationshipBasis: 'declared',
  };
}

export function validateFamilyIntakeDraft(draft: FamilyIntakeDraft): readonly DraftIssue[] {
  const issues: DraftIssue[] = [];
  if (draft.title.trim().length === 0) {
    issues.push(issue('title', 'Add a clear intake title.'));
  }
  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u.test(draft.sourceType.trim().toLowerCase())) {
    issues.push(issue('sourceType', 'Use a stable source code such as manual or nadra_crc.'));
  }
  if (draft.people.length < 1) {
    issues.push(issue('people', 'Add at least one person.'));
  }
  if (draft.people.length > 50) {
    issues.push(issue('people', 'An intake can contain at most 50 people.'));
  }

  const keys = new Set<string>();
  const identifiers = new Set<string>();
  for (const [index, person] of draft.people.entries()) {
    const prefix = `people.${String(index + 1)}`;
    const key = person.clientKey.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/u.test(key)) {
      issues.push(
        issue(`${prefix}.clientKey`, 'Use a unique lowercase key such as mother or child_1.'),
      );
    } else if (keys.has(key)) {
      issues.push(issue(`${prefix}.clientKey`, 'Each person key must be unique.'));
    }
    keys.add(key);
    if (person.firstName.trim().length === 0) {
      issues.push(issue(`${prefix}.firstName`, 'First name is required.'));
    }
    if (person.lastName.trim().length === 0) {
      issues.push(issue(`${prefix}.lastName`, 'Last name is required.'));
    }
    if (person.dateOfBirth.length > 0) {
      const date = new Date(`${person.dateOfBirth}T00:00:00.000Z`);
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== person.dateOfBirth) {
        issues.push(issue(`${prefix}.dateOfBirth`, 'Date of birth must be a real date.'));
      } else if (person.dateOfBirth > new Date().toISOString().slice(0, 10)) {
        issues.push(issue(`${prefix}.dateOfBirth`, 'Date of birth cannot be in the future.'));
      }
    }
    for (const [identifierIndex, identifier] of person.identifiers.entries()) {
      const field = `${prefix}.identifiers.${String(identifierIndex + 1)}`;
      if (identifier.identifierValue.trim().length === 0) {
        issues.push(issue(field, 'Identifier value is required.'));
        continue;
      }
      const normalized = [
        identifier.identifierType.trim().toLowerCase(),
        identifier.issuingCountryCode.trim().toUpperCase(),
        identifier.issuingAuthority.trim().toUpperCase(),
        identifier.identifierValue.toUpperCase().replace(/[\s-]/gu, ''),
      ].join('|');
      if (identifiers.has(normalized)) {
        issues.push(issue(field, 'This identifier is repeated in the intake.'));
      }
      identifiers.add(normalized);
    }
  }

  const relationKeys = new Set<string>();
  const parentGraph = new Map<string, string[]>();
  for (const [index, relationship] of draft.relationships.entries()) {
    const field = `relationships.${String(index + 1)}`;
    const source = relationship.sourcePersonKey.trim().toLowerCase();
    const target = relationship.targetPersonKey.trim().toLowerCase();
    if (!keys.has(source) || !keys.has(target)) {
      issues.push(issue(field, 'Both relationship people must exist in this draft.'));
    }
    if (source === target) {
      issues.push(issue(field, 'A person cannot be related to themselves.'));
    }
    const relationKey = [
      source,
      target,
      relationship.relationshipType,
      relationship.relationshipRole,
      relationship.relationshipBasis,
    ]
      .map((value) => value.trim().toLowerCase())
      .join('|');
    if (relationKeys.has(relationKey)) {
      issues.push(issue(field, 'This relationship is duplicated.'));
    }
    relationKeys.add(relationKey);
    if (relationship.relationshipType.trim().toLowerCase() === 'parent_of') {
      const targets = parentGraph.get(source) ?? [];
      targets.push(target);
      parentGraph.set(source, targets);
    }
  }
  if (hasCycle(parentGraph)) {
    issues.push(issue('relationships', 'Parent relationships cannot form an ancestry cycle.'));
  }
  return issues;
}

export function maskIdentifier(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) {
    return '•'.repeat(trimmed.length);
  }
  return `${'•'.repeat(Math.min(8, trimmed.length - 4))}${trimmed.slice(-4)}`;
}

export function draftToApiBody(draft: FamilyIntakeDraft) {
  return {
    title: draft.title,
    source_type: draft.sourceType,
    source_reference: draft.sourceReference.trim().length === 0 ? null : draft.sourceReference,
    payload: {
      schema_version: 1,
      people: draft.people.map((person) => ({
        client_key: person.clientKey,
        first_name: person.firstName,
        middle_name: nullable(person.middleName),
        last_name: person.lastName,
        preferred_name: nullable(person.preferredName),
        date_of_birth: nullable(person.dateOfBirth),
        gender: nullable(person.gender),
        identifiers: person.identifiers.map((identifier) => ({
          identifier_type: identifier.identifierType,
          identifier_value: identifier.identifierValue,
          issuing_authority: nullable(identifier.issuingAuthority),
          issuing_country_code: nullable(identifier.issuingCountryCode),
        })),
      })),
      relationships: draft.relationships.map((relationship) => ({
        source_person_key: relationship.sourcePersonKey,
        target_person_key: relationship.targetPersonKey,
        relationship_type: relationship.relationshipType,
        relationship_role: relationship.relationshipRole,
        relationship_basis: relationship.relationshipBasis,
      })),
    },
  };
}

function nullable(value: string): string | null {
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function issue(field: string, message: string): DraftIssue {
  return { field, message };
}

function hasCycle(graph: ReadonlyMap<string, readonly string[]>): boolean {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (node: string): boolean => {
    if (visiting.has(node)) {
      return true;
    }
    if (visited.has(node)) {
      return false;
    }
    visiting.add(node);
    for (const target of graph.get(node) ?? []) {
      if (visit(target)) {
        return true;
      }
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  };
  for (const node of graph.keys()) {
    if (visit(node)) {
      return true;
    }
  }
  return false;
}
