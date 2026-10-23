# @newaxhq/ui

Shared UI primitives for NEWAX applications: `Button`, `Input`, `Card`, and
`cn` — the one class-merge utility every surface should import instead of
hand-rolling its own.

Styled through `.nx-*` class hooks (`nx-btn`, `nx-btn-primary`,
`nx-input-error`, `nx-card`, ...). The consuming app supplies the actual
look via its own `@newaxhq/design-system` brand tokens / Tailwind theme — this
package owns structure and state, not colour.

## Usage

```tsx
import { Button, Input, Card } from '@newaxhq/ui';

<Card>
  <Input error={hasError} />
  <Button variant="primary" size="md">
    Save
  </Button>
</Card>;
```

## Scope (Phase 1)

Three primitives only, deliberately. Grow this package by adding the next
primitive an app actually needs twice — not by pre-building a catalogue.
See `docs/package-governance/` for the rule on who owns new additions.
