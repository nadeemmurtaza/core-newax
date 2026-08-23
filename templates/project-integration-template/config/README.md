# Config

## Purpose

The `config/` folder holds this project's Core integration configuration contract and its defaults.

## What Belongs Inside

- The project's `project_key`.
- The declared integration class and conformance level.
- Connection resolution configuration, referencing the Connection Registry.
- Secret references for signing keys and credentials.
- Staleness thresholds, retry bounds, and backoff parameters.
- Reconciliation frequency.

## What Should Never Be Placed Inside

- Credential values.
- Connection strings.
- Signing key values.
- Environment files containing secrets.
- Hardcoded database hosts.

## Best Practices

- Resolve connections through the Connection Registry keyed by `project_key` and environment. A
  hardcoded host makes physical placement an application concern, which is exactly what the
  topology avoids.
- Hold secrets as references resolved at runtime, per the Environment Standard.
- Keep defaults safe for local development without requiring production infrastructure.
- Document every required configuration value. A required value with no default and no
  documentation fails at deploy time rather than at review time.
