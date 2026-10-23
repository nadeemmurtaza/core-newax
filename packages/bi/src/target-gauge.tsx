import { RadialBar, RadialBarChart, ResponsiveContainer } from 'recharts';
import { formatChartValue, type ValueFormat } from '@newaxhq/charts';
import { VisuallyHidden } from '@newaxhq/ui';

export interface TargetGaugeProps {
  readonly label: string;
  readonly value: number;
  readonly target: number;
  readonly valueFormat?: ValueFormat;
  readonly color?: string;
  readonly height?: number;
}

/** A radial gauge showing progress toward one target -- for exactly one
 * number against one goal. Multiple competing goals belong in a
 * KpiScorecard list, not several gauges fighting for attention. */
export function TargetGauge({
  label,
  value,
  target,
  valueFormat = 'percent',
  color = '#0097b2',
  height = 160,
}: TargetGaugeProps) {
  const ratio = target === 0 ? 0 : Math.min(value / target, 1);
  const data = [{ name: label, value: ratio * 100, fill: color }];

  return (
    <div
      role="img"
      aria-label={`${label}: ${formatChartValue(value, valueFormat)} of ${formatChartValue(target, valueFormat)}`}
    >
      <ResponsiveContainer width="100%" height={height}>
        <RadialBarChart
          data={data}
          startAngle={180}
          endAngle={0}
          innerRadius="70%"
          outerRadius="100%"
          barSize={16}
        >
          <RadialBar dataKey="value" cornerRadius={8} background />
        </RadialBarChart>
      </ResponsiveContainer>
      <VisuallyHidden>
        {label}: {formatChartValue(value, valueFormat)} of {formatChartValue(target, valueFormat)}
      </VisuallyHidden>
    </div>
  );
}
