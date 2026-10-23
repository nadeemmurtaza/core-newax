import { VisuallyHidden } from '@newaxhq/ui';
import { formatChartValue } from './formatters';
import type { ChartDataPoint, SeriesConfig } from './types';

export interface AccessibleDataTableProps {
  readonly data: readonly ChartDataPoint[];
  readonly xKey: string;
  readonly series: readonly SeriesConfig[];
}

/**
 * The screen-reader alternative every chart renders alongside its visual
 * plot -- a chart conveys a trend visually, but someone using a screen
 * reader needs the actual numbers, not a described shape. Visually
 * hidden, not `display:none`, so assistive tech still reaches it.
 */
export function AccessibleDataTable({ data, xKey, series }: AccessibleDataTableProps) {
  return (
    <VisuallyHidden>
      <table>
        <caption>Data table for the chart above</caption>
        <thead>
          <tr>
            <th scope="col">{xKey}</th>
            {series.map((item) => (
              <th scope="col" key={item.key}>
                {item.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={index}>
              <th scope="row">{String(row[xKey] ?? '')}</th>
              {series.map((item) => {
                const value = row[item.key];
                return (
                  <td key={item.key}>
                    {value === null || value === undefined
                      ? '—'
                      : formatChartValue(Number(value), item.valueFormat)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </VisuallyHidden>
  );
}
