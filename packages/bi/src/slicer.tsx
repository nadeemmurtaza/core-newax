import { cn, Checkbox } from '@newaxhq/ui';
import type { FilterValue } from './types';

export interface SlicerOption {
  readonly value: string;
  readonly label: string;
}

export interface SlicerProps {
  readonly field: string;
  readonly label: string;
  readonly options: readonly SlicerOption[];
  readonly value: FilterValue | undefined;
  readonly onChange: (next: FilterValue) => void;
  readonly className?: string;
}

/** A global filter panel's one slicer -- the field + the currently
 * selected values. Multi-select by design: "selected = []" is how a
 * cleared slicer is represented, so the dashboard's filter chips can
 * show/hide based on the same state a chart reads. */
export function Slicer({ field, label, options, value, onChange, className }: SlicerProps) {
  const selected = new Set(value?.selected ?? []);

  const toggle = (optionValue: string) => {
    const next = new Set(selected);
    if (next.has(optionValue)) {
      next.delete(optionValue);
    } else {
      next.add(optionValue);
    }
    onChange({ field, selected: [...next] });
  };

  return (
    <fieldset className={cn('nx-slicer', className)}>
      <legend className="nx-slicer-label">{label}</legend>
      <ul className="nx-slicer-options">
        {options.map((option) => (
          <li key={option.value} className="nx-slicer-option">
            <label>
              <Checkbox
                checked={selected.has(option.value)}
                onChange={() => toggle(option.value)}
              />
              {option.label}
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
