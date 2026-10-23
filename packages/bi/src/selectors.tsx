import { Select } from '@newaxhq/ui';
import type { DimensionOption, MetricOption } from './types';

export interface MetricSelectorProps {
  readonly options: readonly MetricOption[];
  readonly value: string;
  readonly onChange: (key: string) => void;
  readonly className?: string;
}

/** Lets the reader pick which metric a chart plots -- the chart itself
 * stays dumb, it just renders whatever `value` resolves to upstream. */
export function MetricSelector({ options, value, onChange, className }: MetricSelectorProps) {
  return (
    <Select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Metric"
      className={className}
    >
      {options.map((option) => (
        <option key={option.key} value={option.key}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}

export interface DimensionSelectorProps {
  readonly options: readonly DimensionOption[];
  readonly value: string;
  readonly onChange: (key: string) => void;
  readonly className?: string;
}

export function DimensionSelector({ options, value, onChange, className }: DimensionSelectorProps) {
  return (
    <Select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Dimension"
      className={className}
    >
      {options.map((option) => (
        <option key={option.key} value={option.key}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}
