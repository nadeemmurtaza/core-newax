# @newax/dashboard-contracts

Versioned TypeScript contracts for NEWAX Core's shared dashboard shell
(`NEWAX_UNIFIED_IDENTITY_SSO_DASHBOARD_BRIEF`, sections 4-5). This package
is the **contract only** -- types, validators, and the version-compatibility
check every service and the shell code against. It does not implement the
shell, a widget registry service, or layout persistence; those are Phase 4
(`apps/web`/`apps/api` work), not this package.

## What's here

| Concern                                                  | File                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------ |
| Service registration, navigation                         | `src/types/service.ts`                                       |
| Widget metadata, data-adapter reference                  | `src/types/widget.ts`                                        |
| Dashboard layout (storage shape + validation)            | `src/types/layout.ts`, `src/validation/layout-validation.ts` |
| Shared render states (loading/empty/error/access-denied) | `src/types/states.ts`                                        |
| Permission-code shape (reused, not reinvented)           | `src/types/permissions.ts`                                   |
| Contract version + compatibility check                   | `src/version.ts`                                             |

## Design decisions

**No raw URLs in a widget's data-adapter reference.** `WidgetDataAdapterRef`
carries `ownerServiceId` + `endpointKey`, resolved server-side against that
service's approved API -- the same pattern the service catalogue uses for
`destinationKey` (`apps/api/src/catalogue`). A widget registration is never
allowed to tell the browser "fetch this arbitrary URL"; that would be the
exact "browser registers arbitrary executable code as a widget" failure
mode section 4 forbids.

**Hiding a widget is not authorization.** `requiredPermission` on a widget
or navigation item is presentation-only -- the owning service's backend
endpoint behind `endpointKey` must independently enforce the same (or a
stricter) check. This package can't enforce that from here; it's a
contract obligation on every service that registers a widget.

**Layout validation never throws.** `validateDashboardLayout` returns
`{ valid, reason }` so a corrupted or tampered stored layout degrades to
the service default (brief: "Recovery to a safe default layout when a
saved configuration is invalid") instead of crashing the shell.

**Contract version uses semver major-only compatibility.** A service
registered against `1.x.y` stays compatible with any shell on `1.*`; a
major bump on either side means the shell should refuse to render that
service's widgets rather than guess at an incompatible shape. See
`isContractCompatible`.

## What's deliberately not decided here

- **Where registrations live** (a table, a static manifest, a registry
  service) -- that's an implementation decision for Phase 4, not a
  contract concern.
- **Transport** (REST, GraphQL, RPC) for the data-adapter endpoints --
  `endpointKey` is transport-agnostic by design.
- **Auth mechanism** the shell uses to call a service's endpoint on the
  viewer's behalf -- depends on the nID/Core session bridge landing first
  (see the identity brief's own "no production-ready SSO yet" caveat).

## Status

Proposed contract, Phase 2 of the unified identity/dashboard brief. No
consumer (shell or service) implements it yet.
