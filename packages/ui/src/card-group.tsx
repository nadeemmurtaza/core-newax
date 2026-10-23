import { cn } from './cn';

export interface CardGroupOption {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly disabled?: boolean;
}

export interface RadioCardGroupProps {
  readonly name: string;
  readonly options: readonly CardGroupOption[];
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly className?: string;
}

/** Single-select, rendered as cards -- the choices need room for a
 * description, where a plain RadioGroup's labels don't. */
export function RadioCardGroup({ name, options, value, onChange, className }: RadioCardGroupProps) {
  return (
    <div role="radiogroup" className={cn('nx-card-group', className)}>
      {options.map((option) => (
        <label
          key={option.id}
          className={cn(
            'nx-card-group-option',
            value === option.id && 'nx-card-group-option-selected',
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.id}
            checked={value === option.id}
            disabled={option.disabled}
            onChange={() => onChange(option.id)}
          />
          <span className="nx-card-group-option-label">{option.label}</span>
          {option.description ? (
            <span className="nx-card-group-option-description">{option.description}</span>
          ) : null}
        </label>
      ))}
    </div>
  );
}

export interface CheckboxCardGroupProps {
  readonly options: readonly CardGroupOption[];
  readonly value: ReadonlySet<string>;
  readonly onChange: (value: ReadonlySet<string>) => void;
  readonly className?: string;
}

export function CheckboxCardGroup({ options, value, onChange, className }: CheckboxCardGroupProps) {
  const toggle = (id: string) => {
    const next = new Set(value);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange(next);
  };

  return (
    <div className={cn('nx-card-group', className)}>
      {options.map((option) => (
        <label
          key={option.id}
          className={cn(
            'nx-card-group-option',
            value.has(option.id) && 'nx-card-group-option-selected',
          )}
        >
          <input
            type="checkbox"
            checked={value.has(option.id)}
            disabled={option.disabled}
            onChange={() => toggle(option.id)}
          />
          <span className="nx-card-group-option-label">{option.label}</span>
          {option.description ? (
            <span className="nx-card-group-option-description">{option.description}</span>
          ) : null}
        </label>
      ))}
    </div>
  );
}
