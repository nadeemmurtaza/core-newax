#!/usr/bin/env bash
#
# NEWAX PostgreSQL backup  (Phase 11, local + RustFS stage).
#
#   1. pg_dump the n8n database (custom format) + a plain dump of the
#      storage schema for quick inspection
#   2. copy both into the RustFS newax-backups bucket
#   3. if BACKUP_OFFSITE_ENDPOINT is set, replicate to that external S3
#      target  <-- this is the real disaster-recovery boundary
#   4. prune local + newax-backups copies older than RETENTION_DAYS
#
# IMPORTANT: steps 1-2 keep the backup on the same VPS / same disk image as
# the primary. That is NOT disaster recovery. Configure BACKUP_OFFSITE_* to
# an off-box target (Backblaze B2, Wasabi, S3, another provider) to close
# that gap. See scripts/backup.env.example.
#
#   set -a; . scripts/backup.env; set +a
#   scripts/backup-postgres.sh
#
set -euo pipefail

PG_CONTAINER="${PG_CONTAINER:-n8n-postgres}"
PG_DB="${PG_DB:-n8n}"
PG_USER="${PG_USER:-n8n}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
LOCAL_DIR="${BACKUP_LOCAL_DIR:-/opt/newax/backups/postgres}"

RUSTFS_ENDPOINT="${RUSTFS_ENDPOINT:-http://10.0.5.5:9000}"
RUSTFS_BUCKET="${RUSTFS_BACKUP_BUCKET:-newax-backups}"

ts="$(date -u +%Y%m%dT%H%M%SZ)"
stamp_dir="postgres/${ts}"
base="n8n_${PG_DB}_${ts}"

mkdir -p "$LOCAL_DIR"
full_dump="${LOCAL_DIR}/${base}.dump"
storage_sql="${LOCAL_DIR}/${base}.storage.sql"

echo "[1/4] pg_dump ${PG_DB} -> ${full_dump}"
docker exec "$PG_CONTAINER" pg_dump -U "$PG_USER" -d "$PG_DB" -Fc --no-owner --no-privileges \
  > "$full_dump"
docker exec "$PG_CONTAINER" pg_dump -U "$PG_USER" -d "$PG_DB" --schema=storage --no-owner --no-privileges \
  | gzip > "${storage_sql}.gz"

sha256sum "$full_dump" "${storage_sql}.gz" > "${LOCAL_DIR}/${base}.sha256"
echo "      $(du -h "$full_dump" | cut -f1) full dump, checksums written"

s3() {
  AWS_ACCESS_KEY_ID="${RUSTFS_ACCESS_KEY:?}" \
  AWS_SECRET_ACCESS_KEY="${RUSTFS_SECRET_KEY:?}" \
  AWS_DEFAULT_REGION="${RUSTFS_REGION:-us-east-1}" \
  AWS_EC2_METADATA_DISABLED=true \
  aws --endpoint-url "$RUSTFS_ENDPOINT" s3 "$@"
}

echo "[2/4] upload -> s3://${RUSTFS_BUCKET}/${stamp_dir}/"
for f in "$full_dump" "${storage_sql}.gz" "${LOCAL_DIR}/${base}.sha256"; do
  s3 cp "$f" "s3://${RUSTFS_BUCKET}/${stamp_dir}/$(basename "$f")"
done

if [[ -n "${BACKUP_OFFSITE_ENDPOINT:-}" ]]; then
  echo "[3/4] replicate -> ${BACKUP_OFFSITE_ENDPOINT%/}/${BACKUP_OFFSITE_BUCKET}/${stamp_dir}/"
  AWS_ACCESS_KEY_ID="${BACKUP_OFFSITE_ACCESS_KEY:?}" \
  AWS_SECRET_ACCESS_KEY="${BACKUP_OFFSITE_SECRET_KEY:?}" \
  AWS_DEFAULT_REGION="${BACKUP_OFFSITE_REGION:-us-east-1}" \
  AWS_EC2_METADATA_DISABLED=true \
  aws --endpoint-url "$BACKUP_OFFSITE_ENDPOINT" s3 cp "$LOCAL_DIR/" \
      "s3://${BACKUP_OFFSITE_BUCKET}/${stamp_dir}/" \
      --recursive --exclude "*" --include "${base}.*"
else
  echo "[3/4] SKIP offsite replication (BACKUP_OFFSITE_ENDPOINT not set)"
  echo "      -> backup is still same-VPS only; not disaster recovery"
fi

echo "[4/4] prune older than ${RETENTION_DAYS} days"
find "$LOCAL_DIR" -type f -mtime "+${RETENTION_DAYS}" -print -delete || true
cutoff="$(date -u -d "${RETENTION_DAYS} days ago" +%Y%m%dT%H%M%SZ)"
while read -r line; do
  key="$(awk '{print $4}' <<<"$line")"
  [[ -z "$key" ]] && continue
  dirts="$(sed -E 's#.*postgres/([0-9TZ]+)/.*#\1#' <<<"$key")"
  if [[ "$dirts" < "$cutoff" ]]; then
    echo "      rm s3://${RUSTFS_BUCKET}/${key}"
    s3 rm "s3://${RUSTFS_BUCKET}/${key}"
  fi
done < <(s3 ls "s3://${RUSTFS_BUCKET}/postgres/" --recursive || true)

echo "done: ${base}"
