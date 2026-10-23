# @newaxhq/charts

Reusable charting for NEWAX applications: turns operational data into
consistent visual intelligence, built on `recharts` rather than
reimplementing chart math/SVG/interaction from scratch.

**Tokens define how things look; this package defines how data is
visualized.** Colours come from the host app's `BrandTheme.colors.chart`
array (from `design-system`) via the `palette` prop, not a second colour
system — `DEFAULT_CHART_PALETTE` only applies when no palette is passed.

## What's here

| Chart          | Notes                                                                                 |
| -------------- | ------------------------------------------------------------------------------------- |
| `LineChart`    | Multi-series, threshold reference lines                                               |
| `BarChart`     | Grouped, stacked, and horizontal — one component (`stacked`/`layout` props)           |
| `AreaChart`    | Stacked or overlapping                                                                |
| `PieChart`     | Pie or donut — one component (`innerRadiusRatio`)                                     |
| `ScatterChart` | Scatter or bubble — one component (presence of `z` on a point)                        |
| `Sparkline`    | Compact trend only; no axes/tooltip/legend — use `LineChart` for anything inspectable |

Shared containers: `ChartContainer`, `ChartHeader`, `ChartTitle`,
`ChartDescription`, `ChartActions`, `ChartFooter`, `ChartSource`,
`ChartPlot`, `ChartLoadingState`, `ChartErrorState`, `ChartEmptyState`,
`ChartNoDataState`.

`formatChartValue` is the one formatting path every chart's axes/
tooltips/labels go through (number/currency/percent/compact/integer) —
no chart calls `toLocaleString` itself.

**Accessibility**: every data chart renders a visually-hidden `<table>`
alternative (`AccessibleDataTable`) alongside the visual plot, and the
plot itself carries `role="img"` with a required `accessibilityDescription`
— a chart conveys a trend visually; a screen-reader user needs the
numbers, not a described shape.

## Usage

```tsx
import { ChartContainer, ChartHeader, ChartTitle, LineChart } from '@newaxhq/charts';
import { THEME } from './brand'; // the app's own design-system BrandTheme

<ChartContainer>
  <ChartHeader>
    <ChartTitle>Monthly Revenue</ChartTitle>
  </ChartHeader>
  <LineChart
    data={data}
    xKey="month"
    series={[{ key: 'revenue', label: 'Revenue', valueFormat: 'currency' }]}
    palette={THEME.colors.chart}
    accessibilityDescription="Monthly revenue trend"
  />
</ChartContainer>;
```

## What's not here (yet)

Histogram, box plot, waterfall, funnel, treemap, heatmap, radar,
geospatial; forecast/regression/confidence-band overlays (those are
calculated upstream by an analytics service, never fabricated in this
package); date-range presets and period-comparison helpers; zoom/pan/
brush; streaming updates; PNG/SVG/CSV export. These are the source
doc's own Phase 5 ("Advanced analytics") and export/sharing scope —
deliberately deferred, not silently dropped. Add them when a real NEWAX
dashboard needs one.
