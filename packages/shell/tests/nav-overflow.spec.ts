import { describe, expect, it } from 'vitest';
import { collapseNavItems } from '../src/nav-overflow';
import type { NavItem } from '../src/types';

function item(id: string): NavItem {
  return { id, label: id, href: `/${id}` };
}

describe('collapseNavItems', () => {
  it('does not collapse when items fit', () => {
    const items = ['a1', 'a2', 'a3'].map(item);
    expect(collapseNavItems(items, 5)).toEqual({ visible: items, collapsed: [] });
  });

  it('folds the tail past maxVisible', () => {
    const items = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map(item);
    const result = collapseNavItems(items, 5);
    expect(result.visible.map((i) => i.id)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5']);
    expect(result.collapsed.map((i) => i.id)).toEqual(['a6']);
  });
});
