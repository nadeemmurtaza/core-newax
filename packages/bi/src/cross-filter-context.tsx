import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { applyFilter, clearAllFilters, clearFilter } from './cross-filter';
import type { DrillStep, FilterValue } from './types';

export interface CrossFilterState {
  readonly filters: readonly FilterValue[];
  readonly drillPath: readonly DrillStep[];
  readonly setFilter: (next: FilterValue) => void;
  readonly removeFilter: (field: string) => void;
  readonly clearAll: () => void;
  readonly drillInto: (step: DrillStep) => void;
  /** Jumps back to `index` in the drill path (0 = the first step),
   * dropping everything after it -- not just popping one level. */
  readonly drillTo: (index: number) => void;
  readonly drillToRoot: () => void;
}

const CrossFilterContext = createContext<CrossFilterState | null>(null);

export function CrossFilterProvider({ children }: { readonly children: ReactNode }) {
  const [filters, setFilters] = useState<readonly FilterValue[]>([]);
  const [drillPath, setDrillPath] = useState<readonly DrillStep[]>([]);

  const value = useMemo<CrossFilterState>(
    () => ({
      filters,
      drillPath,
      setFilter: (next) => setFilters((current) => applyFilter(current, next)),
      removeFilter: (field) => setFilters((current) => clearFilter(current, field)),
      clearAll: () => {
        setFilters(clearAllFilters());
        setDrillPath([]);
      },
      drillInto: (step) => {
        setDrillPath((current) => [...current, step]);
        setFilters((current) => applyFilter(current, step.filter));
      },
      drillTo: (index) => {
        setDrillPath((current) => current.slice(0, index + 1));
      },
      drillToRoot: () => setDrillPath([]),
    }),
    [filters, drillPath],
  );

  return <CrossFilterContext.Provider value={value}>{children}</CrossFilterContext.Provider>;
}

export function useCrossFilter(): CrossFilterState {
  const context = useContext(CrossFilterContext);
  if (!context) {
    throw new Error('useCrossFilter must be used within a CrossFilterProvider');
  }
  return context;
}
