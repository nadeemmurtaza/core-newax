import {
  Area,
  AreaChart as RechartsAreaChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AccessibleDataTable } from './accessible-data-table';
import { formatChartValue } from './formatters';
import { resolveSeriesColors } from './palette';
import type { ChartDataPoint, SeriesConfig, ThresholdLine } from './types';

export interface AreaChartProps {
  readonly data: readonly ChartDataPoint[];
  readonly xKey: string;
  readonly series: readonly SeriesConfig[];
  readonly palette?: readonly string[];
  readonly stacked?: boolean;
  readonly thresholds?: readonly ThresholdLine[];
  readonly gridColor?: string;
  readonly axisColor?: string;
  readonly accessibilityDescription: string;
  readonly height?: number;
  readonly onDataPointClick?: (point: ChartDataPoint, seriesKey: string) => void;
}

export function AreaChart({
  data,
  xKey,
  series,
  palette,
  stacked = false,
  thresholds = [],
  gridColor,
  axisColor,
  accessibilityDescription,
  height = 320,
  onDataPointClick,
}: AreaChartProps) {
  const colors = resolveSeriesColors(series, palette);

  return (
    <div role="img" aria-label={accessibilityDescription}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsAreaChart data={data as Record<string, unknown>[]}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey={xKey} stroke={axisColor} />
          <YAxis
            stroke={axisColor}
            tickFormatter={(value: number) => formatChartValue(value, series[0]?.valueFormat)}
          />
          <Tooltip
            formatter={(value, name) => {
              const config = series.find((item) => item.label === name || item.key === name);
              return formatChartValue(Number(value), config?.valueFormat);
            }}
          />
          <Legend />
          {thresholds.map((threshold) => (
            <ReferenceLine
              key={threshold.label}
              y={threshold.value}
              label={threshold.label}
              stroke={threshold.color ?? '#b42318'}
              strokeDasharray="4 4"
            />
          ))}
          {series.map((item) => (
            <Area
              key={item.key}
              type="monotone"
              dataKey={item.key}
              name={item.label}
              stroke={colors.get(item.key) as string}
              fill={colors.get(item.key) as string}
              fillOpacity={0.25}
              {...(stacked ? { stackId: 'stack' } : {})}
              {...(onDataPointClick
                ? {
                    onClick: (point: Record<string, unknown>) =>
                      onDataPointClick(point as ChartDataPoint, item.key),
                  }
                : {})}
            />
          ))}
        </RechartsAreaChart>
      </ResponsiveContainer>
      <AccessibleDataTable data={data} xKey={xKey} series={series} />
    </div>
  );
}
