import { cn } from '@newaxhq/ui';
import type { SwitcherOption } from './types';

export interface SwitcherProps {
  readonly label: string;
  readonly current: SwitcherOption;
  readonly options: readonly SwitcherOption[];
  readonly className?: string;
}

/**
 * One switcher implementation shared by the application switcher and the
 * organization/workspace switcher -- they're the same interaction
 * (current value, dropdown of alternatives, navigate on pick), not two
 * components that happen to look alike today and drift apart tomorrow.
 */
export function Switcher({ label, current, options, className }: SwitcherProps) {
  const alternatives = options.filter((option) => option.id !== current.id);

  return (
    <details className={cn('nx-switcher', className)}>
      <summary className="nx-switcher-current" aria-label={label}>
        {current.label}
      </summary>
      {alternatives.length > 0 ? (
        <ul className="nx-switcher-menu">
          {alternatives.map((option) => (
            <li key={option.id}>
              <a href={option.href} className="nx-switcher-option">
                <span className="nx-switcher-option-label">{option.label}</span>
                {option.description ? (
                  <span className="nx-switcher-option-description">{option.description}</span>
                ) : null}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </details>
  );
}
