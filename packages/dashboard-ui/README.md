# @newaxhq/dashboard-ui

Dashboard shell components built on `@newaxhq/dashboard-contracts` and
`@newaxhq/ui`. Renders structure and the standard render-state vocabulary
only — each widget's actual content comes from the owning service.

## What's here

- `DashboardGrid` — the grid shell a dashboard's widgets render into.
- `WidgetContainer` — per-widget shell: size, title, and the standard
  loading/empty/access-denied/error states (`presentWidgetState`), with
  `children` rendered only once `state.kind === 'ready'`.

## Usage

```tsx
import { DashboardGrid, WidgetContainer } from '@newaxhq/dashboard-ui';
import { composeDashboard } from '@newaxhq/dashboard-core';

const { widgets } = composeDashboard(layout, registry, grantedPermissions);

<DashboardGrid>
  {widgets.map(({ widget, placement }) => (
    <WidgetContainer key={widget.id} widget={widget} size={placement.size} state={state}>
      {/* the owning service's own widget content */}
    </WidgetContainer>
  ))}
</DashboardGrid>;
```
