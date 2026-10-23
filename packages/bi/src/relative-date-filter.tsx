import { cn, DatePicker, Select } from '@newaxhq/ui';
import { resolveRelativeDateRange } from './relative-date';
import type { DateRangeValue, RelativeDatePreset } from './types';

const PRESET_LABELS: Record<RelativeDatePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last7days: 'Last 7 days',
  last30days: 'Last 30 days',
  thisMonth: 'This month',
  lastMonth: 'Last month',
  quarterToDate: 'Quarter to date',
  yearToDate: 'Year to date',
  custom: 'Custom range',
};

const PRESET_ORDER: readonly RelativeDatePreset[] = [
  'today',
  'yesterday',
  'last7days',
  'last30days',
  'thisMonth',
  'lastMonth',
  'quarterToDate',
  'yearToDate',
  'custom',
];

export interface RelativeDateFilterProps {
  readonly value: DateRangeValue;
  readonly onChange: (next: DateRangeValue) => void;
  readonly className?: string;
}

export function RelativeDateFilter({ value, onChange, className }: RelativeDateFilterProps) {
  const handlePresetChange = (preset: RelativeDatePreset) => {
    if (preset === 'custom') {
      onChange({ preset, start: value.start, end: value.end });
      return;
    }
    onChange({ preset, ...resolveRelativeDateRange(preset) });
  };

  return (
    <div className={cn('nx-relative-date-filter', className)}>
      <Select
        value={value.preset}
        onChange={(event) => handlePresetChange(event.target.value as RelativeDatePreset)}
        aria-label="Date range"
      >
        {PRESET_ORDER.map((preset) => (
          <option key={preset} value={preset}>
            {PRESET_LABELS[preset]}
          </option>
        ))}
      </Select>
      {value.preset === 'custom' ? (
        <div className="nx-relative-date-filter-custom">
          <DatePicker
            value={value.start}
            onChange={(event) => onChange({ ...value, start: event.target.value })}
            aria-label="Start date"
          />
          <DatePicker
            value={value.end}
            onChange={(event) => onChange({ ...value, end: event.target.value })}
            aria-label="End date"
          />
        </div>
      ) : null}
    </div>
  );
}
