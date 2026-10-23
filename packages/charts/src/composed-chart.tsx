import {
  Bar,
  CartesianGrid,
  ComposedChart as RechartsComposedChart,
  Legend,
  Line,
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

export interface ComposedSeriesConfig extends SeriesConfig {
  readonly as: 'bar' | 'line';
}

export interface ComposedChartProps {
  readonly data: readonly ChartDataPoint[];
  readonly xKey: string;
  readonly series: readonly ComposedSeriesConfig[];
  readonly palette?: readonly string[];
  readonly thresholds?: readonly ThresholdLine[];
  readonly gridColor?: string;
  readonly axisColor?: string;
  readonly accessibilityDescription: string;
  readonly height?: number;
  readonly onDataPointClick?: (point: ChartDataPoint, seriesKey: string) => void;
}

/**
 * The doc's own canonical example -- "revenue bars plus margin line" --
 * one axis set, mixed `bar`/`line` series. Not every series needs to be
 * the same mark type.
 */
export function ComposedChart({
  data,
  xKey,
  series,
  palette,
  thresholds = [],
  gridColor,
  axisColor,
  accessibilityDescription,
  height = 320,
  onDataPointClick,
}: ComposedChartProps) {
  const colors = resolveSeriesColors(series, palette);

  return (
    <div role="img" aria-label={accessibilityDescription}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsComposedChart data={data as Record<string, unknown>[]}>
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
          {series.map((item) =>
            item.as === 'bar' ? (
              <Bar
                key={item.key}
                dataKey={item.key}
                name={item.label}
                fill={colors.get(item.key) as string}
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
            ) : (
              <Line
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={item.label}
                stroke={colors.get(item.key) as string}
                dot={false}
              />
            ),
          )}
        </RechartsComposedChart>
      </ResponsiveContainer>
      <AccessibleDataTable data={data} xKey={xKey} series={series} />
    </div>
  );
}
