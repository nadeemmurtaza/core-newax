import { cn } from '@newaxhq/ui';
import type { DrillStep } from './types';

export interface DrillBreadcrumbProps {
  readonly path: readonly DrillStep[];
  readonly onNavigate: (index: number) => void;
  readonly onRoot: () => void;
  readonly rootLabel?: string;
  readonly className?: string;
}

/**
 * A separate, small breadcrumb for drill *data* paths -- distinct from
 * @newaxhq/shell's page-navigation Breadcrumbs, which this package
 * deliberately does not depend on: a drill path is dashboard state, not
 * a route, and `@newaxhq/bi` has no business depending on the app shell.
 */
export function DrillBreadcrumb({
  path,
  onNavigate,
  onRoot,
  rootLabel = 'All',
  className,
}: DrillBreadcrumbProps) {
  return (
    <nav aria-label="Drill path" className={cn('nx-drill-breadcrumb', className)}>
      <ol className="nx-drill-breadcrumb-list">
        <li>
          <button type="button" onClick={onRoot}>
            {rootLabel}
          </button>
        </li>
        {path.map((step, index) => (
          <li key={`${step.label}-${index}`}>
            {index === path.length - 1 ? (
              <span aria-current="step">{step.label}</span>
            ) : (
              <button type="button" onClick={() => onNavigate(index)}>
                {step.label}
              </button>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
