#!/usr/bin/env bash
#
# NEWAX storage schema migration runner.
#
# Applies db/migrations/*.sql in order, once each, tracked in
# storage.schema_migrations inside the n8n Postgres database.
#
# Migrations run one-per-transaction (ON_ERROR_STOP + -1): a failing
# migration rolls back cleanly and is not recorded as applied.
#
# Env overrides:
#   PG_CONTAINER  (default: n8n-postgres)
#   PG_DB         (default: n8n)
#   PG_USER       (default: n8n)
#
# Usage:
#   db/migrate.sh            apply all pending migrations
#   db/migrate.sh status     show applied / pending, do not change anything
#   db/migrate.sh verify     re-check on-disk checksums vs recorded, read-only (exit 1 on drift)
#
set -euo pipefail

PG_CONTAINER="${PG_CONTAINER:-n8n-postgres}"
PG_DB="${PG_DB:-n8n}"
PG_USER="${PG_USER:-n8n}"
MIG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/migrations" && pwd)"

psql_q() { docker exec -i "$PG_CONTAINER" psql -v ON_ERROR_STOP=1 -X -q -U "$PG_USER" -d "$PG_DB" "$@"; }
psql_val() { docker exec -i "$PG_CONTAINER" psql -v ON_ERROR_STOP=1 -X -tAq -U "$PG_USER" -d "$PG_DB" -c "$1"; }

bootstrap() {
  psql_q <<'SQL'
CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE IF NOT EXISTS storage.schema_migrations (
    version     text PRIMARY KEY,
    description text,
    checksum    text NOT NULL,
    applied_at  timestamptz NOT NULL DEFAULT now(),
    applied_by  text NOT NULL DEFAULT current_user,
    duration_ms integer
);
COMMENT ON TABLE storage.schema_migrations IS 'Applied NEWAX storage schema migrations (managed by db/migrate.sh).';

-- If the storage foundation already exists (it was applied by hand before
-- this runner existed), adopt it as migration 0001 without re-running it.
DO $$
BEGIN
  IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'storage' AND table_name = 'assets'
     )
     AND NOT EXISTS (SELECT 1 FROM storage.schema_migrations WHERE version = '0001')
  THEN
     INSERT INTO storage.schema_migrations (version, description, checksum, duration_ms)
     VALUES ('0001', 'baseline_storage_foundation (adopted; schema pre-existed)', 'adopted', 0);
     RAISE NOTICE 'Adopted pre-existing storage foundation as migration 0001.';
  END IF;
END $$;
SQL
}

bootstrap

shopt -s nullglob
files=( "$MIG_DIR"/[0-9][0-9][0-9][0-9]_*.sql )
if (( ${#files[@]} == 0 )); then
  echo "No migration files found in $MIG_DIR" >&2
  exit 1
fi

mode="${1:-apply}"
pending=0

if [[ "$mode" == "verify" ]]; then
  # Single read-only pull of the ledger. Guard against set -e: a failed psql
  # in a command substitution must not abort before we can report.
  if ! db_rows="$(psql_val "SELECT version, checksum FROM storage.schema_migrations ORDER BY version")"; then
    echo "verify: cannot read storage.schema_migrations" >&2
    exit 2
  fi

  # on-disk version -> 1
  declare -A disk_has=()
  for f in "${files[@]}"; do
    b="$(basename "$f")"; disk_has["${b%%_*}"]=1
  done

  ok=0; drift=0; missing=0; applied=""
  while IFS='|' read -r version recorded; do
    [[ -z "$version" ]] && continue
    applied+=" $version "
    if [[ -z "${disk_has[$version]:-}" ]]; then
      echo "MISSING ${version}  recorded in DB, no file on disk"
      missing=$((missing + 1)); continue
    fi
    if [[ "$recorded" == "adopted" ]]; then
      echo "ok    ${version}  (adopted)"; ok=$((ok + 1)); continue
    fi
    path=""
    for ff in "$MIG_DIR/${version}"_*.sql; do path="$ff"; done
    disk_sum="$(sha256sum "$path" | cut -d' ' -f1)"
    if [[ "$recorded" == "$disk_sum" ]]; then
      echo "ok    ${version}"; ok=$((ok + 1))
    else
      echo "DRIFT ${version}  on-disk sha256 != recorded checksum"
      drift=$((drift + 1))
    fi
  done <<< "$db_rows"

  # Informational: disk files not yet applied. Does NOT affect exit code.
  for f in "${files[@]}"; do
    b="$(basename "$f")"; v="${b%%_*}"
    [[ "$applied" == *" $v "* ]] || echo "PEND  ${v}  ${b#*_}"
  done

  echo "---"
  echo "${ok} ok, ${drift} drift, ${missing} missing"
  if (( drift > 0 || missing > 0 )); then exit 1; fi
  exit 0
fi

for f in "${files[@]}"; do
  base="$(basename "$f")"
  version="${base%%_*}"
  description="${base#*_}"; description="${description%.sql}"
  checksum="$(sha256sum "$f" | cut -d' ' -f1)"
  recorded="$(psql_val "SELECT checksum FROM storage.schema_migrations WHERE version = '${version}'")"

  if [[ -n "$recorded" ]]; then
    if [[ "$recorded" != "adopted" && "$recorded" != "$checksum" ]]; then
      echo "WARN  ${version}  applied, but ${base} changed on disk since (checksum mismatch)"
    else
      echo "ok    ${version}  ${description}"
    fi
    continue
  fi

  pending=$((pending + 1))
  if [[ "$mode" == "status" ]]; then
    echo "PEND  ${version}  ${description}"
    continue
  fi

  echo "APPLY ${version}  ${description}"
  start_ms=$(date +%s%3N)
  docker exec -i "$PG_CONTAINER" psql -v ON_ERROR_STOP=1 -X -q -1 -U "$PG_USER" -d "$PG_DB" -f - < "$f"
  end_ms=$(date +%s%3N)

  psql_q -c "INSERT INTO storage.schema_migrations (version, description, checksum, duration_ms)
             VALUES ('${version}', '${description//\'/\'\'}', '${checksum}', $((end_ms - start_ms)))"
  echo "      done in $((end_ms - start_ms)) ms"
done

if [[ "$mode" == "status" ]]; then
  echo "---"
  echo "${pending} pending migration(s)."
else
  echo "---"
  echo "Migrations up to date."
fi
