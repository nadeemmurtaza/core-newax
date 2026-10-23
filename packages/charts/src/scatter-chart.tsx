import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart as RechartsScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { formatChartValue } from './formatters';
import type { ValueFormat } from './types';

export interface ScatterSeries {
  readonly key: string;
  readonly label: string;
  readonly color?: string;
  readonly points: readonly { readonly x: number; readonly y: number; readonly z?: number }[];
}

export interface ScatterChartProps {
  readonly series: readonly ScatterSeries[];
  readonly xLabel: string;
  readonly yLabel: string;
  readonly xValueFormat?: ValueFormat;
  readonly yValueFormat?: ValueFormat;
  /** Presence of `z` on any point's data makes this a bubble chart --
   * same component, not a separate one. */
  readonly accessibilityDescription: string;
  readonly height?: number;
  readonly gridColor?: string;
  readonly axisColor?: string;
  readonly onPointClick?: (
    point: { readonly x: number; readonly y: number; readonly z?: number },
    seriesKey: string,
  ) => void;
}

const DEFAULT_COLORS = ['#0097b2', '#f5b841', '#0f7a4d', '#b42318'];

export function ScatterChart({
  series,
  xLabel,
  yLabel,
  xValueFormat = 'number',
  yValueFormat = 'number',
  accessibilityDescription,
  height = 320,
  gridColor,
  axisColor,
  onPointClick,
}: ScatterChartProps) {
  const hasZ = series.some((item) => item.points.some((point) => point.z !== undefined));

  return (
    <div role="img" aria-label={accessibilityDescription}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsScatterChart>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis
            type="number"
            dataKey="x"
            name={xLabel}
            stroke={axisColor}
            tickFormatter={(value: number) => formatChartValue(value, xValueFormat)}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={yLabel}
            stroke={axisColor}
            tickFormatter={(value: number) => formatChartValue(value, yValueFormat)}
          />
          {hasZ ? <ZAxis type="number" dataKey="z" range={[64, 400]} /> : null}
          <Tooltip
            formatter={(value, name) =>
              formatChartValue(Number(value), name === xLabel ? xValueFormat : yValueFormat)
            }
          />
          <Legend />
          {series.map((item, index) => (
            <Scatter
              key={item.key}
              name={item.label}
              data={item.points as unknown as Record<string, unknown>[]}
              fill={item.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
              {...(onPointClick
                ? {
                    onClick: (point: { payload?: { x: number; y: number; z?: number } }) => {
                      if (point.payload) {
                        onPointClick(point.payload, item.key);
                      }
                    },
                  }
                : {})}
            />
          ))}
        </RechartsScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
