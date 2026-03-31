#!/usr/bin/env bash

set -euo pipefail

normalize_url() {
  local value="${1:-}"
  value="${value//$'\r'/}"
  value="${value//$'\n'/}"
  value="${value%"${value##*[![:space:]]}"}"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%/}"
  printf '%s' "$value"
}

require_env() {
  local name="$1"
  local value="$2"

  if [[ -z "$value" ]]; then
    echo "::error::Missing required environment variable: $name" >&2
    exit 1
  fi
}

check_http_200() {
  local name="$1"
  local url="$2"
  local output="$3"
  local status_code

  echo "Checking $name: $url"
  if ! status_code="$(
    curl -sSL --connect-timeout 10 --max-time 30 -o "$output" -w '%{http_code}' "$url"
  )"; then
    echo "::error::$name request failed ($url)" >&2
    exit 1
  fi

  if [[ "$status_code" != "200" ]]; then
    echo "::error::$name returned HTTP $status_code ($url)" >&2
    if [[ -s "$output" ]]; then
      echo "Response body:" >&2
      cat "$output" >&2
    fi
    exit 1
  fi
}

storefront_url="$(normalize_url "${STOREFRONT_URL:-}")"
backend_url="$(normalize_url "${BACKEND_URL:-}")"
expected_storefront_environment="$(normalize_url "${EXPECTED_STOREFRONT_ENVIRONMENT:-}")"

require_env "STOREFRONT_URL" "$storefront_url"
require_env "BACKEND_URL" "$backend_url"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

backend_output="$tmp_dir/backend-health.json"
storefront_output="$tmp_dir/storefront-health.json"
homepage_output="$tmp_dir/storefront-home.html"

check_http_200 "backend health" "$backend_url/health" "$backend_output"
check_http_200 "storefront health" "$storefront_url/api/health" "$storefront_output"
check_http_200 "storefront homepage" "$storefront_url" "$homepage_output"

python3 - "$storefront_output" "$expected_storefront_environment" <<'PY'
import json
import pathlib
import sys

payload_path = pathlib.Path(sys.argv[1])
expected_env = sys.argv[2]

payload = json.loads(payload_path.read_text())

if payload.get("status") != "ok":
    print("::error::Storefront health payload did not report status=ok", file=sys.stderr)
    print(json.dumps(payload, indent=2), file=sys.stderr)
    raise SystemExit(1)

environment = payload.get("environment")
if expected_env and environment != expected_env:
    print(
        f"::error::Storefront environment mismatch: expected {expected_env!r}, got {environment!r}",
        file=sys.stderr,
    )
    print(json.dumps(payload, indent=2), file=sys.stderr)
    raise SystemExit(1)

print("Storefront health payload:")
print(json.dumps(payload, indent=2))
PY

if ! grep -qi "<html" "$homepage_output"; then
  echo "::warning::Storefront homepage response did not include an <html tag; inspect the deployment response manually." >&2
fi

echo "Deployment health checks passed for:"
echo "- Backend: $backend_url"
echo "- Storefront: $storefront_url"
