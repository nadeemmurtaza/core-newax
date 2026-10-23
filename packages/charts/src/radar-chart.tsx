import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RechartsRadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { AccessibleDataTable } from './accessible-data-table';
import { formatChartValue } from './formatters';
import { resolveSeriesColors } from './palette';
import type { ChartDataPoint, SeriesConfig } from './types';

export interface RadarChartProps {
  readonly data: readonly ChartDataPoint[];
  /** The category key plotted around the polygon's points -- e.g. "metric". */
  readonly axisKey: string;
  readonly series: readonly SeriesConfig[];
  readonly palette?: readonly string[];
  readonly gridColor?: string;
  readonly accessibilityDescription: string;
  readonly height?: number;
}

/**
 * The polar/polygon chart (also called a spider or "polygraph" chart) --
 * one or more series plotted as a closed polygon across several axes
 * radiating from a centre point. Genuinely useful only when comparing a
 * handful of dimensions on a shared scale (e.g. a capability or risk
 * score across categories); not a drop-in replacement for a bar chart.
 */
export function RadarChart({
  data,
  axisKey,
  series,
  palette,
  gridColor,
  accessibilityDescription,
  height = 320,
}: RadarChartProps) {
  const colors = resolveSeriesColors(series, palette);

  return (
    <div role="img" aria-label={accessibilityDescription}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsRadarChart data={data as Record<string, unknown>[]}>
          <PolarGrid {...(gridColor ? { stroke: gridColor } : {})} />
          <PolarAngleAxis dataKey={axisKey} />
          <PolarRadiusAxis
            tickFormatter={(value: number) => formatChartValue(value, series[0]?.valueFormat)}
          />
          <Tooltip
            formatter={(value, name) => {
              const config = series.find((item) => item.label === name || item.key === name);
              return formatChartValue(Number(value), config?.valueFormat);
            }}
          />
          <Legend />
          {series.map((item) => (
            <Radar
              key={item.key}
              name={item.label}
              dataKey={item.key}
              stroke={colors.get(item.key) as string}
              fill={colors.get(item.key) as string}
              fillOpacity={0.2}
            />
          ))}
        </RechartsRadarChart>
      </ResponsiveContainer>
      <AccessibleDataTable data={data} xKey={axisKey} series={series} />
    </div>
  );
}
