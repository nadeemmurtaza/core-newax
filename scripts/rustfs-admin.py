#!/usr/bin/env python3
"""RustFS IAM admin helper — sign and send admin API requests with the root
credential (scripts/rustfs.env). RustFS's admin API lives under
/rustfs/admin/v3/... and is SigV4-signed like S3, but the `aws` CLI only
speaks the S3 API surface, so this exists to reach the admin-only endpoints
(add-canned-policy, add-user, set-user-or-group-policy, ...) directly.

Requires: boto3 (for botocore's SigV4 signer only — no AWS account needed).

Usage:
    set -a; . scripts/rustfs.env; set +a
    scripts/rustfs-admin.py PUT /rustfs/admin/v3/add-canned-policy \
        "name=my-policy" @policy.json
    scripts/rustfs-admin.py PUT /rustfs/admin/v3/add-user \
        "accessKey=my-user" '{"secretKey":"...","status":"enabled"}'
    scripts/rustfs-admin.py PUT /rustfs/admin/v3/set-user-or-group-policy \
        "policyName=my-policy&userOrGroup=my-user&isGroup=false"
"""
import os
import sys
import hashlib
import urllib.request
import urllib.error
from botocore.awsrequest import AWSRequest
from botocore.auth import SigV4Auth
from botocore.credentials import Credentials


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    method = sys.argv[1]
    path = sys.argv[2]
    query = sys.argv[3] if len(sys.argv) > 3 else ""
    body_arg = sys.argv[4] if len(sys.argv) > 4 else ""

    endpoint = os.environ["RUSTFS_ENDPOINT"].rstrip("/")
    access_key = os.environ["RUSTFS_ACCESS_KEY"]
    secret_key = os.environ["RUSTFS_SECRET_KEY"]
    region = os.environ.get("RUSTFS_REGION", "us-east-1")

    body = b""
    if body_arg:
        if body_arg.startswith("@"):
            with open(body_arg[1:], "rb") as f:
                body = f.read()
        else:
            body = body_arg.encode()

    url = endpoint + path
    if query:
        url += "?" + query

    request = AWSRequest(method=method, url=url, data=body)
    request.headers["x-amz-content-sha256"] = hashlib.sha256(body).hexdigest()
    creds = Credentials(access_key, secret_key)
    SigV4Auth(creds, "s3", region).add_auth(request)
    prepared = request.prepare()

    req = urllib.request.Request(
        url, data=body if body else None, method=method,
        headers=dict(prepared.headers),
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            print(f"HTTP {resp.status}")
            print(resp.read().decode(errors="replace"))
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}")
        print(e.read().decode(errors="replace"))
        sys.exit(1)


if __name__ == "__main__":
    main()
