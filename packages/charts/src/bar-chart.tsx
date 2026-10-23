import {
  Bar,
  BarChart as RechartsBarChart,
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

export interface BarChartProps {
  readonly data: readonly ChartDataPoint[];
  readonly xKey: string;
  readonly series: readonly SeriesConfig[];
  readonly palette?: readonly string[];
  readonly layout?: 'vertical' | 'horizontal';
  readonly stacked?: boolean;
  readonly thresholds?: readonly ThresholdLine[];
  /** Theme-aware grid/axis stroke -- pass the host theme's neutral token
   * (e.g. neutral.200) instead of relying on recharts' hardcoded default,
   * so the chart actually follows light/dark instead of looking wrong in one. */
  readonly gridColor?: string;
  readonly axisColor?: string;
  readonly accessibilityDescription: string;
  readonly height?: number;
  readonly onDataPointClick?: (point: ChartDataPoint, seriesKey: string) => void;
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
  thresholds = [],
  gridColor,
  axisColor,
  accessibilityDescription,
  height = 320,
  onDataPointClick,
}: BarChartProps) {
  const colors = resolveSeriesColors(series, palette);
  const isHorizontalBars = layout === 'vertical';

  return (
    <div role="img" aria-label={accessibilityDescription}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart data={data as Record<string, unknown>[]} layout={layout}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          {isHorizontalBars ? (
            <>
              <XAxis
                type="number"
                stroke={axisColor}
                tickFormatter={(value: number) => formatChartValue(value, series[0]?.valueFormat)}
              />
              <YAxis type="category" dataKey={xKey} stroke={axisColor} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} stroke={axisColor} />
              <YAxis
                stroke={axisColor}
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
          {thresholds.map((threshold) => (
            <ReferenceLine
              key={threshold.label}
              {...(isHorizontalBars ? { x: threshold.value } : { y: threshold.value })}
              label={threshold.label}
              stroke={threshold.color ?? '#b42318'}
              strokeDasharray="4 4"
            />
          ))}
          {series.map((item) => (
            <Bar
              key={item.key}
              dataKey={item.key}
              name={item.label}
              fill={colors.get(item.key) as string}
              {...(stacked ? { stackId: 'stack' } : {})}
              {...(onDataPointClick
                ? {
                    onClick: (point: { payload?: ChartDataPoint }) => {
                      if (point.payload) {
                        onDataPointClick(point.payload, item.key);
                      }
                    },
                  }
                : {})}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
      <AccessibleDataTable data={data} xKey={xKey} series={series} />
    </div>
  );
}
