# NEWAX Core Database Registry Map

## Purpose

The Database Registry Map converts the checked-out `core-newax` repository state into a searchable, interactive HTML site and a machine-readable JSON inventory.

It is generated from repository evidence rather than manually maintained status claims:

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/**/migration.sql`
- `registry/module-registry.json`
- `apps/api/src/**/*.controller.ts`
- Git metadata for the checked-out commit
- Open pull requests when a GitHub token is available in publish mode

The generator keeps four states separate:

1. **Repository state:** What exists in the exact checked-out source tree.
2. **Governance state:** Whether a module is planned, draft, active, deprecated, replaced, or archived in the Module Registry.
3. **Deployment state:** Migration files are source definitions. Their presence does not prove production deployment.
4. **Pull-request state:** Open pull requests are proposed work and are not presented as merged into `main`.

## Generated outputs

The workflow creates:

```text
docs/generated/database-registry/
├── .nojekyll
├── index.html
└── inventory.json
```

Generated files are workflow artifacts and are not treated as hand-edited source files.

## Local commands

Generate a deterministic local snapshot:

```bash
pnpm database-registry:generate
```

Generate with exact Git and GitHub workflow metadata:

```bash
GITHUB_TOKEN=... node tooling/database-registry/generate.mjs \
  --mode publish \
  --output docs/generated/database-registry \
  --write
```

Run focused tests:

```bash
pnpm database-registry:test
```

The generator has no third-party runtime dependency. It uses Node.js standard-library APIs only.

## Automatic workflow

`.github/workflows/database-registry.yml` runs for:

- Every pull request, to prove the generator still understands the proposed schema, migrations, registry, and controllers.
- Every push to `main`, including merged work.
- Manual workflow dispatch.

Every run:

1. Checks out the exact repository state.
2. Runs focused generator tests.
3. Reads schema, migrations, Module Registry, APIs, Git metadata, and open pull requests.
4. Generates the HTML site and JSON inventory.
5. Verifies the generated contract and exact source SHA.
6. Uploads a 30-day review artifact.
7. Publishes to GitHub Pages only when the controlled publishing gate is enabled.

## Controlled publishing gate

The workflow deliberately does not publish by default. The database map exposes internal architecture, module boundaries, table names, migrations, permissions, and active pull-request information. Public exposure would be unacceptable.

Before enabling publication, NEWAX must confirm that the GitHub Pages site is private or otherwise access-controlled under the organization plan and repository settings.

After that review:

1. Open **Repository Settings → Pages**.
2. Select **GitHub Actions** as the Pages source.
3. Open **Repository Settings → Secrets and variables → Actions → Variables**.
4. Create `DATABASE_REGISTRY_PAGES_ENABLED` with value `true`.
5. Run the **Database Registry Map** workflow once, or merge the next verified change into `main`.

The deployment job will then publish the latest verified `main` state automatically after every merge.

## Stable URL

GitHub Pages supplies the initial stable URL through the deployment environment. A custom domain such as `registry.core.newax.co` may be attached only after access control and DNS ownership are verified.

Do not create a public custom domain merely because the HTML renders nicely. It contains architecture evidence, not marketing copy.

## Status language

The generated site follows NEWAX engineering status rules:

- **Planned:** Registered but not implemented.
- **Implemented / draft:** Source exists, but Module Registry governance remains draft.
- **Active:** Approved for the use defined by the Module Registry.
- **Open pull request:** Proposed or verified branch work that is not merged into the displayed repository state.
- **Migration defined:** A migration file exists in source. Production application is not inferred.
