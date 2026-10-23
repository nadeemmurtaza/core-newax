import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
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

export interface LineChartProps {
  readonly data: readonly ChartDataPoint[];
  readonly xKey: string;
  readonly series: readonly SeriesConfig[];
  readonly palette?: readonly string[];
  readonly thresholds?: readonly ThresholdLine[];
  readonly accessibilityDescription: string;
  readonly height?: number;
}

export function LineChart({
  data,
  xKey,
  series,
  palette,
  thresholds = [],
  accessibilityDescription,
  height = 320,
}: LineChartProps) {
  const colors = resolveSeriesColors(series, palette);

  return (
    <div role="img" aria-label={accessibilityDescription}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsLineChart data={data as Record<string, unknown>[]}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} />
          <YAxis
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
            <Line
              key={item.key}
              type="monotone"
              dataKey={item.key}
              name={item.label}
              stroke={colors.get(item.key) as string}
              dot={false}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
      <AccessibleDataTable data={data} xKey={xKey} series={series} />
    </div>
  );
}
