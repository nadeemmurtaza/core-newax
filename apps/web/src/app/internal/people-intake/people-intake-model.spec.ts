import { describe, expect, it } from 'vitest';

import {
  emptyIdentifier,
  emptyPerson,
  emptyRelationship,
  initialFamilyIntakeDraft,
  maskIdentifier,
  validateFamilyIntakeDraft,
} from './people-intake-model';

describe('People Intake dashboard model', () => {
  it('reports incomplete draft fields without storing anything', () => {
    const issues = validateFamilyIntakeDraft(initialFamilyIntakeDraft());
    expect(issues.map((item) => item.field)).toContain('title');
    expect(issues.map((item) => item.field)).toContain('people.1.firstName');
  });

  it('accepts a simple parent and child draft', () => {
    const parent = {
      ...emptyPerson('parent-id', 'parent'),
      firstName: 'Amina',
      lastName: 'Khan',
      identifiers: [{ ...emptyIdentifier('identifier-id'), identifierValue: '12345-1234567-1' }],
    };
    const child = {
      ...emptyPerson('child-id', 'child'),
      firstName: 'Sara',
      lastName: 'Khan',
      dateOfBirth: '2015-01-10',
    };
    const draft = {
      ...initialFamilyIntakeDraft(),
      title: 'Family verification',
      people: [parent, child],
      relationships: [emptyRelationship('relationship-id', 'parent', 'child')],
    };
    expect(validateFamilyIntakeDraft(draft)).toEqual([]);
  });

  it('detects a parentage cycle', () => {
    const first = { ...emptyPerson('first-id', 'first'), firstName: 'First', lastName: 'Person' };
    const second = {
      ...emptyPerson('second-id', 'second'),
      firstName: 'Second',
      lastName: 'Person',
    };
    const draft = {
      ...initialFamilyIntakeDraft(),
      title: 'Cycle',
      people: [first, second],
      relationships: [
        emptyRelationship('one', 'first', 'second'),
        emptyRelationship('two', 'second', 'first'),
      ],
    };
    expect(validateFamilyIntakeDraft(draft).some((item) => item.message.includes('cycle'))).toBe(
      true,
    );
  });

  it('masks identifiers while preserving a short verification suffix', () => {
    expect(maskIdentifier('12345-1234567-1')).toBe('••••••••67-1');
  });
});
