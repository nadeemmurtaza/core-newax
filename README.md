# newax-rustfs-admin

Permanent storage architecture for the NEWAX platform: RustFS (object bytes) +
PostgreSQL `storage` schema (asset identity, versions, events, processing,
RAG chunks) + n8n storage-service workflows.

> **Rule:** PostgreSQL is the source of truth for *assets*. RustFS is the source
> of truth for *bytes*. Never make a workflow depend on a raw RustFS object key
> alone — reference `asset_id`.

## Layout

| Path | What |
|---|---|
| `db/migrate.sh` | Idempotent migration runner (tracked in `storage.schema_migrations`) |
| `db/migrations/` | Numbered SQL migrations `0001`..`0007` |
| `db/tests/smoke.sql` | Rolled-back functional test of the schema |
| `scripts/rustfs-enable-versioning.sh` | Enable S3 versioning on permanent buckets |
| `scripts/backup-postgres.sh` | pg_dump → RustFS `newax-backups` → optional offsite |
| `n8n/workflows/` | Importable storage-service workflows |
| `docs/` | Architecture, object-key standard, status matrix, agent pipeline |
| `.claude/agents`, `.claude/skills` | Multi-agent delivery pipeline |

## Environment (this VPS)

| Component | Where |
|---|---|
| RustFS | container `rustfs`, S3 at `http://rustfs:9000` (host: `http://10.0.5.5:9000`), path-style |
| PostgreSQL | container `n8n-postgres`, db `n8n`, user `n8n`, image `pgvector/pgvector:pg16` |
| n8n | container `n8n`, `https://n8n.newax.co` |
| Buckets | `newax-images` `newax-videos` `newax-documents` `newax-temp` `newax-backups` |

## Run migrations

```bash
db/migrate.sh status   # show pending
db/migrate.sh          # apply
docker exec -i n8n-postgres psql -U n8n -d n8n -v ON_ERROR_STOP=1 -X -f - < db/tests/smoke.sql
```

## One-time infra

```bash
cp scripts/rustfs.env.example scripts/rustfs.env   # fill in RUSTFS_ACCESS/SECRET_KEY
set -a; . scripts/rustfs.env; set +a
scripts/rustfs-enable-versioning.sh --status
```

See `docs/STATUS.md` for what is done and what still needs a decision from you.
