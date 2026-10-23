import { formatChartValue, type ValueFormat } from '@newaxhq/charts';
import { cn } from '@newaxhq/ui';
import type { KpiTarget, KpiTrendDirection } from './types';

export interface KpiScorecardProps {
  readonly label: string;
  readonly value: number;
  readonly valueFormat?: ValueFormat;
  readonly target?: KpiTarget;
  readonly trend?: { readonly direction: KpiTrendDirection; readonly label: string };
  readonly className?: string;
}

/**
 * The glance-level "are we on track" card -- value, optional target
 * comparison, optional trend. Status (`nx-kpi-scorecard-on-target`/
 * `-below-target`) is a plain value >= target comparison; a real
 * business rule for "on track" (seasonality, tolerance bands) belongs
 * upstream, this just renders what it's given.
 */
export function KpiScorecard({
  label,
  value,
  valueFormat = 'number',
  target,
  trend,
  className,
}: KpiScorecardProps) {
  const onTarget = target ? value >= target.value : null;

  return (
    <div
      className={cn(
        'nx-kpi-scorecard',
        onTarget === true && 'nx-kpi-scorecard-on-target',
        onTarget === false && 'nx-kpi-scorecard-below-target',
        className,
      )}
    >
      <p className="nx-kpi-scorecard-label">{label}</p>
      <p className="nx-kpi-scorecard-value">{formatChartValue(value, valueFormat)}</p>
      {target ? (
        <p className="nx-kpi-scorecard-target">
          Target: {formatChartValue(target.value, valueFormat)} ({target.label})
        </p>
      ) : null}
      {trend ? (
        <p className={cn('nx-kpi-scorecard-trend', `nx-kpi-scorecard-trend-${trend.direction}`)}>
          {trend.label}
        </p>
      ) : null}
    </div>
  );
}
