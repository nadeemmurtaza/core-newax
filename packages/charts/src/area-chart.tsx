import {
  Area,
  AreaChart as RechartsAreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AccessibleDataTable } from './accessible-data-table';
import { formatChartValue } from './formatters';
import { resolveSeriesColors } from './palette';
import type { ChartDataPoint, SeriesConfig } from './types';

export interface AreaChartProps {
  readonly data: readonly ChartDataPoint[];
  readonly xKey: string;
  readonly series: readonly SeriesConfig[];
  readonly palette?: readonly string[];
  readonly stacked?: boolean;
  readonly accessibilityDescription: string;
  readonly height?: number;
}

export function AreaChart({
  data,
  xKey,
  series,
  palette,
  stacked = false,
  accessibilityDescription,
  height = 320,
}: AreaChartProps) {
  const colors = resolveSeriesColors(series, palette);

  return (
    <div role="img" aria-label={accessibilityDescription}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsAreaChart data={data as Record<string, unknown>[]}>
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
            />
          ))}
        </RechartsAreaChart>
      </ResponsiveContainer>
      <AccessibleDataTable data={data} xKey={xKey} series={series} />
    </div>
  );
}
