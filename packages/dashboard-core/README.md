# @newaxhq/dashboard-core

Widget/service registry and layout composition, built on
`@newaxhq/dashboard-contracts`. Core owns this registration/composition
logic; each service owns its own widget data and content — this package
never fetches or renders a widget's data, it only decides which
registered, authorized widgets belong in a resolved layout.

## What's here

- `WidgetRegistry` / `ServiceRegistry` — in-memory registration at
  service-bootstrap time. Throws on malformed/duplicate registration
  (trusted, server-side, startup-time — unlike render-time code).
- `composeDashboard(layout, registry, grantedPermissions)` — resolves a
  persisted `DashboardLayout` against what's actually registered and what
  the caller can see. Degrades by dropping widgets, never throws; dropped
  placements are returned, not silently discarded, so the shell can
  surface "a widget here is no longer available" instead of lying about
  the layout being unchanged.

## What's not here

Layout _persistence_ (saving/loading a user's or org's layout, resolving
the user → organization → service-default precedence) is a backend
concern — see `docs/package-governance/README.md` §8 on where the
security/data boundary sits. This package composes a layout it's handed;
it doesn't fetch one.
