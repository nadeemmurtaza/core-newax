export type ValueFormat = 'number' | 'currency' | 'percent' | 'compact' | 'integer';

export interface SeriesConfig {
  readonly key: string;
  readonly label: string;
  readonly color?: string;
  readonly valueFormat?: ValueFormat;
}

export type ChartDataPoint = Record<string, string | number | null>;

export type ChartState = 'loading' | 'error' | 'empty' | 'ready';

export interface ThresholdLine {
  readonly label: string;
  readonly value: number;
  readonly color?: string;
}
