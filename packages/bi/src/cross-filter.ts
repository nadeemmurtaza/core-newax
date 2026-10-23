import type { FilterValue } from './types';

/**
 * Sets (or clears, when `selected` is empty) one field's filter value.
 * A chart's `onDataPointClick` calls this to turn "the user clicked the
 * March bar" into cross-filter state every other chart on the dashboard
 * can read -- this package coordinates that; it never decides what each
 * chart does in response, that's the consuming dashboard's render logic.
 */
export function applyFilter(
  filters: readonly FilterValue[],
  next: FilterValue,
): readonly FilterValue[] {
  const withoutField = filters.filter((filter) => filter.field !== next.field);
  if (next.selected.length === 0) {
    return withoutField;
  }
  return [...withoutField, next];
}

export function clearFilter(
  filters: readonly FilterValue[],
  field: string,
): readonly FilterValue[] {
  return filters.filter((filter) => filter.field !== field);
}

export function clearAllFilters(): readonly FilterValue[] {
  return [];
}

/** Whether a data row passes every active filter (AND across fields, OR
 * within a field's selected values) -- the standard slicer semantics. */
export function matchesFilters(
  row: Readonly<Record<string, unknown>>,
  filters: readonly FilterValue[],
): boolean {
  return filters.every((filter) => {
    const value = row[filter.field];
    return filter.selected.includes(String(value));
  });
}
