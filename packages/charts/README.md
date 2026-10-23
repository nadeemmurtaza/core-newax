# @newaxhq/charts

Reusable charting for NEWAX applications: turns operational data into
consistent visual intelligence, built on `recharts` rather than
reimplementing chart math/SVG/interaction from scratch.

**Tokens define how things look; this package defines how data is
visualized.** Colours come from the host app's `BrandTheme.colors.chart`
array (from `design-system`) via the `palette` prop, not a second colour
system — `DEFAULT_CHART_PALETTE` only applies when no palette is passed.

## What's here

| Chart           | Notes                                                                                                                                                                             |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LineChart`     | Multi-series, threshold reference lines                                                                                                                                           |
| `BarChart`      | Grouped, stacked, and horizontal — one component (`stacked`/`layout` props)                                                                                                       |
| `AreaChart`     | Stacked or overlapping                                                                                                                                                            |
| `PieChart`      | Pie or donut — one component (`innerRadiusRatio`)                                                                                                                                 |
| `ScatterChart`  | Scatter or bubble/3-axis — one component (presence of `z` on a point adds the third axis via `ZAxis`)                                                                             |
| `Sparkline`     | Compact trend only; no axes/tooltip/legend — use `LineChart` for anything inspectable                                                                                             |
| `ComposedChart` | Mixed series — the doc's own canonical example ("revenue bars plus margin line"); each series picks `as: 'bar' \| 'line'`                                                         |
| `RadarChart`    | Polar/polygon ("spider"/"polygraph") chart — several axes radiating from a centre point; genuinely useful only for a handful of comparable dimensions, not a bar-chart substitute |

`LineChart`/`BarChart`/`AreaChart`/`ComposedChart` accept
`onDataPointClick`; `PieChart` accepts `onSliceClick`; `ScatterChart`
accepts `onPointClick` — events only. Coordinating what the rest of a
dashboard does with that click (cross-filtering, drill-down, slicers) is
a BI-interaction-layer concern, not this package's — see "What's not
here" below. All cartesian charts accept `gridColor`/`axisColor` so the
grid/axis actually follows the host theme's light/dark neutral tokens
instead of recharts' hardcoded default.

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

**Advanced chart types** — histogram, box plot/violin, waterfall,
funnel, treemap, sunburst, heatmap, Sankey/alluvial, network graph,
geospatial, candlestick/OHLC, Gantt. The source doc's own Phase 5
("Advanced analytics") — deliberately deferred, not silently dropped.

**Analytical overlays beyond a flat threshold line** — forecast/
regression/confidence-band overlays are calculated upstream by an
analytics service, never fabricated in this package.

**A BI interaction layer** — global slicers, relative date filters,
cross-filtering across multiple visuals, drill-down/drill-through
navigation, dynamic metric/dimension selection, KPI scorecards, pivot
tables. A chart exposes click events; it does not decide how every other
chart on a dashboard reacts to one. That coordination is a separate
`@newaxhq/bi` package's job — not built yet, deliberately: core chart
rendering should stabilize first (the doc's own recommended order).

**Export/sharing and date-range/period-comparison helpers** — PNG/SVG/
CSV export, zoom/pan/brush, streaming updates. Add any of these when a
real NEWAX dashboard needs one.
