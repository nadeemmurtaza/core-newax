import {
  Bar,
  BarChart as RechartsBarChart,
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

export interface BarChartProps {
  readonly data: readonly ChartDataPoint[];
  readonly xKey: string;
  readonly series: readonly SeriesConfig[];
  readonly palette?: readonly string[];
  readonly layout?: 'vertical' | 'horizontal';
  readonly stacked?: boolean;
  readonly accessibilityDescription: string;
  readonly height?: number;
}

/** One component covers grouped, stacked, and horizontal bars -- the
 * distinction is `stacked`/`layout`, not three near-duplicate components. */
export function BarChart({
  data,
  xKey,
  series,
  palette,
  layout = 'horizontal',
  stacked = false,
  accessibilityDescription,
  height = 320,
}: BarChartProps) {
  const colors = resolveSeriesColors(series, palette);
  const isHorizontalBars = layout === 'vertical';

  return (
    <div role="img" aria-label={accessibilityDescription}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart data={data as Record<string, unknown>[]} layout={layout}>
          <CartesianGrid strokeDasharray="3 3" />
          {isHorizontalBars ? (
            <>
              <XAxis
                type="number"
                tickFormatter={(value: number) => formatChartValue(value, series[0]?.valueFormat)}
              />
              <YAxis type="category" dataKey={xKey} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} />
              <YAxis
                tickFormatter={(value: number) => formatChartValue(value, series[0]?.valueFormat)}
              />
            </>
          )}
          <Tooltip
            formatter={(value, name) => {
              const config = series.find((item) => item.label === name || item.key === name);
              return formatChartValue(Number(value), config?.valueFormat);
            }}
          />
          <Legend />
          {series.map((item) => (
            <Bar
              key={item.key}
              dataKey={item.key}
              name={item.label}
              fill={colors.get(item.key) as string}
              {...(stacked ? { stackId: 'stack' } : {})}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
      <AccessibleDataTable data={data} xKey={xKey} series={series} />
    </div>
  );
}
