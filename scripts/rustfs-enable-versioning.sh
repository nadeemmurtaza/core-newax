#!/usr/bin/env bash
#
# Enable S3 object versioning on the permanent NEWAX buckets and confirm
# newax-temp is left unversioned (temp objects are deleted, not retained).
#
# Requires the AWS CLI and RustFS credentials in the environment:
#   set -a; . scripts/rustfs.env; set +a
#   scripts/rustfs-enable-versioning.sh [--status]
#
set -euo pipefail

: "${RUSTFS_ENDPOINT:?set RUSTFS_ENDPOINT (see scripts/rustfs.env.example)}"
: "${RUSTFS_ACCESS_KEY:?set RUSTFS_ACCESS_KEY}"
: "${RUSTFS_SECRET_KEY:?set RUSTFS_SECRET_KEY}"

export AWS_ACCESS_KEY_ID="$RUSTFS_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$RUSTFS_SECRET_KEY"
export AWS_DEFAULT_REGION="${RUSTFS_REGION:-us-east-1}"
export AWS_EC2_METADATA_DISABLED=true

S3API=(aws --endpoint-url "$RUSTFS_ENDPOINT" s3api)

VERSIONED_BUCKETS=(newax-images newax-videos newax-documents newax-backups)
UNVERSIONED_BUCKETS=(newax-temp)

status() {
  printf '%-18s %s\n' "BUCKET" "VERSIONING"
  for b in "${VERSIONED_BUCKETS[@]}" "${UNVERSIONED_BUCKETS[@]}"; do
    local s
    s="$("${S3API[@]}" get-bucket-versioning --bucket "$b" --query 'Status' --output text 2>/dev/null || echo '<error>')"
    [[ "$s" == "None" || -z "$s" ]] && s="Disabled"
    printf '%-18s %s\n' "$b" "$s"
  done
}

if [[ "${1:-}" == "--status" ]]; then
  status
  exit 0
fi

for b in "${VERSIONED_BUCKETS[@]}"; do
  echo "Enabling versioning on $b ..."
  "${S3API[@]}" put-bucket-versioning --bucket "$b" \
    --versioning-configuration Status=Enabled
done

echo
echo "Leaving unversioned: ${UNVERSIONED_BUCKETS[*]}"
echo
status
