# NEWAX package governance

Rules for every package under `packages/*` that other NEWAX repos are
meant to depend on. Applies starting with Phase 1
(`@newaxhq/eslint-config`, `@newaxhq/typescript-config`,
`@newaxhq/prettier-config`, `@newaxhq/ui`); extend it to later packages as
they're built, don't restart it per package.

## 1. Owner

Every package names an owner in its `README.md` (a person, not "the team").
The owner approves breaking changes and answers "can I depend on this".

## 2. One responsibility

A package has one job. `@newaxhq/ui` is structure/state primitives, not
colour — colour is `@newaxhq/design-system`. If a package starts doing two
things, split it before it grows a third.

## 3. No overlapping packages

Before adding a package, grep for the concern it covers. Two packages that
both "do design tokens" is a fork, not a feature. See the root
`CLAUDE.md` Globalization section — same rule, applied to packages instead
of files.

## 4. Public API only

Consumers import from the package's documented entry points
(`package.json#exports` / `main`), never from `dist/internal/...` or a
deep path the README doesn't mention. Internal refactors that don't touch
the documented surface are not breaking changes.

## 5. Semantic versioning

- Patch: bug fix, no API change.
- Minor: new export, backward compatible.
- Major: anything a consumer's existing import could break on.

A major bump needs a one-paragraph migration note in the package's
`README.md` under a `## Migrating to vN` heading.

## 6. Dependency direction

Shared packages depend on other shared packages or external libraries —
never on an application (`apps/*`). A dependency cycle between two shared
packages is a design error, not something to route around with a type-only
import.

## 7. Quality gate before merge

Each package ships its own `test` and `typecheck` scripts (see
`dashboard-contracts` and `ui` for the pattern) and both must pass. A
package with no tests is not done, it's a draft.

## 8. Security boundary

A shared package may provide client-side helpers for auth/permissions
(`@newaxhq/auth`, `@newaxhq/access-control`), but it is never the enforcement
point. The server that owns the protected resource rejects unauthorized
requests regardless of what the shared package's UI renders. Don't let a
shared package's green tests be mistaken for a security guarantee.

## 9. No silent forks

If an app needs a shared component to behave differently, that's either:

- a variant the shared package should expose (prop, config), or
- proof the capability isn't actually shared and belongs in that app.

Copying the component into the app and hand-editing it is not an option —
that's exactly the "two globals for the same thing" failure this repo's
Globalization rules call out.

## 10. Registry

Published to GitHub Packages:

- Org scope: `@newaxhq/*` — https://github.com/orgs/newaxhq/packages
- Personal scope (pre-org packages, still in use): `@nadeemmurtaza/*`

Every new publishable package is named `@newaxhq/*` from the start — in
`package.json#name`, in its `.npmrc` scope, everywhere. `@newax/*` is
retired for new packages; older internal (non-published) workspace
modules like `@newax/auth` keep their existing name until they're
published, at which point they rename too. Public npmjs.com publication
is a Phase 5 decision per package, not a default.
