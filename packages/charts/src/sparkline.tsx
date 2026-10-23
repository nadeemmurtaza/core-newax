import { Line, LineChart as RechartsLineChart, ResponsiveContainer } from 'recharts';

export interface SparklineProps {
  readonly data: readonly number[];
  readonly color?: string;
  readonly accessibilityDescription: string;
  readonly height?: number;
}

/** A compact trend indicator -- no axes, grid, tooltip, or legend; it is
 * a glance-level signal next to a Stat, not a standalone chart to
 * interrogate. Use LineChart for anything the reader needs to inspect. */
export function Sparkline({
  data,
  color = '#0097b2',
  accessibilityDescription,
  height = 32,
}: SparklineProps) {
  const points = data.map((value, index) => ({ index, value }));

  return (
    <div role="img" aria-label={accessibilityDescription} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={points}>
          <Line type="monotone" dataKey="value" stroke={color} dot={false} strokeWidth={2} />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
