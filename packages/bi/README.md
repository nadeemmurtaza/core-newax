# @newaxhq/bi

The analytical interaction layer for NEWAX dashboards: coordinates what a
`@newaxhq/charts` click event means _across_ a dashboard, so individual
charts stay dumb renderers while slicers, drill-down, and cross-filtering
work consistently everywhere they're used.

This package owns no data, no calculations, no authorization. It decides
"the user clicked March, so every chart reading `filters` should narrow
to March" as a coordination problem; the backend/analytics layer still
owns what "March" means and whether the user is allowed to see it.

## What's here

| Piece                                    | Role                                                                                                                                                                                |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CrossFilterProvider` / `useCrossFilter` | Shared filter + drill-path state. Wrap a dashboard once; every chart's `onDataPointClick` calls `setFilter`/`drillInto`, every other chart reads `filters` to decide what it shows. |
| `Slicer`                                 | Multi-select filter panel for one field                                                                                                                                             |
| `RelativeDateFilter`                     | Date-range slicer with the standard presets (today/7d/30d/this month/last month/QTD/YTD/custom)                                                                                     |
| `DrillBreadcrumb`                        | The drill _data_ path, not a page nav trail — deliberately doesn't depend on `@newaxhq/shell`                                                                                       |
| `MetricSelector` / `DimensionSelector`   | Lets the reader pick what a chart plots                                                                                                                                             |
| `KpiScorecard`                           | Value + optional target comparison + optional trend                                                                                                                                 |
| `TargetGauge`                            | Radial progress toward one target                                                                                                                                                   |

Pure, unit-tested logic: `resolveRelativeDateRange` (UTC-safe — local-time
`Date` construction mixed with `toISOString()` silently shifts dates by a
day in non-UTC timezones, so this avoids that entirely), `applyFilter`/
`clearFilter`/`clearAllFilters`/`matchesFilters` (the cross-filter
reducer, usable outside React if a chart needs to filter data server-side
before rendering).

## Usage

```tsx
import { CrossFilterProvider, useCrossFilter, Slicer, DrillBreadcrumb } from '@newaxhq/bi';
import { BarChart } from '@newaxhq/charts';

function RevenueByRegion() {
  const { filters, setFilter, drillPath, drillInto, drillTo, drillToRoot } = useCrossFilter();

  return (
    <>
      <DrillBreadcrumb path={drillPath} onNavigate={drillTo} onRoot={drillToRoot} />
      <BarChart
        data={data}
        xKey="region"
        series={[{ key: 'revenue', label: 'Revenue' }]}
        onDataPointClick={(point) =>
          drillInto({
            label: String(point.region),
            filter: { field: 'region', selected: [String(point.region)] },
          })
        }
        accessibilityDescription="Revenue by region"
      />
    </>
  );
}

<CrossFilterProvider>
  <Slicer
    field="tier"
    label="Tier"
    options={tierOptions}
    value={filters.find((f) => f.field === 'tier')}
    onChange={setFilter}
  />
  <RevenueByRegion />
</CrossFilterProvider>;
```

## What's not here (yet)

Pivot/matrix tables, decomposition trees, key-influencer analysis —
heavy, speculative; add when a real NEWAX dashboard needs one. Natural-
language narratives and predictive analytics belong in a dedicated
analytics service, never fabricated in a presentation package.
