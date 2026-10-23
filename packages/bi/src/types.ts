/** A single slicer/filter's current value: the field it filters and the
 * selected values. The slicer UI only ever reads/writes this -- what the
 * field means and how it's applied to a query is the backend's job. */
export interface FilterValue {
  readonly field: string;
  readonly selected: readonly string[];
}

export type RelativeDatePreset =
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'last30days'
  | 'thisMonth'
  | 'lastMonth'
  | 'quarterToDate'
  | 'yearToDate'
  | 'custom';

export interface DateRangeValue {
  readonly preset: RelativeDatePreset;
  /** ISO 8601 dates -- required when preset is 'custom', derived otherwise. */
  readonly start: string;
  readonly end: string;
}

/** One step in a drill path: what the user drilled into, and the filter
 * it implies. Reversible -- the UI can jump back to any prior step. */
export interface DrillStep {
  readonly label: string;
  readonly filter: FilterValue;
}

export interface MetricOption {
  readonly key: string;
  readonly label: string;
}

export interface DimensionOption {
  readonly key: string;
  readonly label: string;
}

export type KpiTrendDirection = 'up' | 'down' | 'flat';

export interface KpiTarget {
  readonly value: number;
  readonly label: string;
}
