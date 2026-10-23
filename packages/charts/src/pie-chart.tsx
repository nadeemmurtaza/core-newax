import {
  Cell,
  Legend,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { VisuallyHidden } from '@newaxhq/ui';
import { formatChartValue } from './formatters';
import type { ValueFormat } from './types';

export interface PieSlice {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly color?: string;
}

export interface PieChartProps {
  readonly data: readonly PieSlice[];
  readonly palette?: readonly string[];
  /** 0 = pie, >0 = donut -- same component, not two. */
  readonly innerRadiusRatio?: number;
  readonly valueFormat?: ValueFormat;
  readonly accessibilityDescription: string;
  readonly height?: number;
}

const DEFAULT_PALETTE = ['#0097b2', '#f5b841', '#0f7a4d', '#b42318', '#4b5566', '#8a9aa6'];

export function PieChart({
  data,
  palette = DEFAULT_PALETTE,
  innerRadiusRatio = 0,
  valueFormat = 'number',
  accessibilityDescription,
  height = 320,
}: PieChartProps) {
  return (
    <div role="img" aria-label={accessibilityDescription}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsPieChart>
          <Pie
            data={data as unknown as Record<string, unknown>[]}
            dataKey="value"
            nameKey="label"
            outerRadius="80%"
            {...(innerRadiusRatio > 0 ? { innerRadius: `${innerRadiusRatio * 100}%` } : {})}
          >
            {data.map((slice, index) => (
              <Cell
                key={slice.id}
                fill={slice.color ?? (palette[index % palette.length] as string)}
              />
            ))}
          </Pie>
          <Tooltip formatter={(value) => formatChartValue(Number(value), valueFormat)} />
          <Legend />
        </RechartsPieChart>
      </ResponsiveContainer>
      <VisuallyHidden>
        <table>
          <caption>Data table for the chart above</caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            {data.map((slice) => (
              <tr key={slice.id}>
                <th scope="row">{slice.label}</th>
                <td>{formatChartValue(slice.value, valueFormat)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
    </div>
  );
}
