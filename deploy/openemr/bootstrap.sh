#!/usr/bin/env bash
set -Eeuo pipefail

echo "==> OpenEMR 8.3 Unattended Bootstrap"

if [ ! -f .env ]; then
  echo "ERROR: .env file missing in deploy/openemr directory" >&2
  exit 1
fi

echo "==> Starting Docker Compose stack..."
docker compose up -d

echo "==> Waiting for OpenEMR web service readiness..."
attempts=0
max_attempts=60
until curl -fsS -k "https://localhost/fhir/metadata" >/dev/null 2>&1 || curl -fsS "http://localhost/fhir/metadata" >/dev/null 2>&1; do
  attempts=$((attempts + 1))
  if [ "$attempts" -ge "$max_attempts" ]; then
    echo "ERROR: OpenEMR FHIR metadata endpoint timed out after $max_attempts attempts" >&2
    docker compose logs --tail=100
    exit 1
  fi
  printf '.'
  sleep 5
done

echo ""
echo "==> OpenEMR FHIR capability metadata is active."
echo "==> Verifying OpenEMR OIDC discovery endpoint..."

if curl -fsS -k "https://localhost/oauth2/default/.well-known/openid-configuration" >/dev/null 2>&1; then
  echo "==> OpenEMR OIDC discovery verified."
else
  echo "WARN: OAuth2 discovery check pending certificate/DNS readiness."
fi

echo "==> Bootstrap complete."
