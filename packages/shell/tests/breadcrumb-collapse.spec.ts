import { describe, expect, it } from 'vitest';
import { collapseBreadcrumbs } from '../src/breadcrumb-collapse';
import type { BreadcrumbItem } from '../src/types';

function crumb(id: string): BreadcrumbItem {
  return { id, label: id, href: `/${id}` };
}

describe('collapseBreadcrumbs', () => {
  it('does not collapse when items fit within maxVisible', () => {
    const items = ['a', 'b', 'c'].map(crumb);
    expect(collapseBreadcrumbs(items, 4)).toEqual({ leading: items, collapsed: [], trailing: [] });
  });

  it('does not collapse at exactly maxVisible', () => {
    const items = ['a', 'b', 'c', 'd'].map(crumb);
    expect(collapseBreadcrumbs(items, 4)).toEqual({ leading: items, collapsed: [], trailing: [] });
  });

  it('keeps the first item and the last (maxVisible - 1), folding the rest', () => {
    const items = ['org', 'repo', 'dir1', 'dir2', 'dir3', 'file'].map(crumb);
    const result = collapseBreadcrumbs(items, 4);

    expect(result.leading.map((i) => i.id)).toEqual(['org']);
    expect(result.collapsed.map((i) => i.id)).toEqual(['repo', 'dir1']);
    expect(result.trailing.map((i) => i.id)).toEqual(['dir2', 'dir3', 'file']);
  });

  it('handles an empty list', () => {
    expect(collapseBreadcrumbs([], 4)).toEqual({ leading: [], collapsed: [], trailing: [] });
  });
});
