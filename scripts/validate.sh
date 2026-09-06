#!/usr/bin/env bash
set -Eeuo pipefail

failures=0

pass() {
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1"
  failures=$((failures + 1))
}

check_file() {
  if [[ -f "$1" ]]; then
    pass "$1 exists"
  else
    fail "$1 is missing"
  fi
}

check_dir() {
  if [[ -d "$1" ]]; then
    pass "$1 directory exists"
  else
    fail "$1 directory is missing"
  fi
}

check_file "azure.yaml"
check_file "README.md"
check_file ".gitignore"
check_file ".devcontainer/devcontainer.json"

check_file "infra/main.bicep"
check_file "infra/main.parameters.json"
check_file "infra/modules/network.bicep"
check_file "infra/modules/storage.bicep"
check_file "infra/modules/key-vault.bicep"
check_file "infra/modules/monitoring.bicep"
check_file "infra/modules/ahds.bicep"
check_file "infra/modules/openemr-vm.bicep"
check_file "infra/modules/function-app.bicep"

check_file "deploy/openemr/docker-compose.yml"
check_file "deploy/openemr/Caddyfile"
check_file "deploy/openemr/bootstrap.sh"
check_file "deploy/openemr/.env.template"

check_dir "src/fhir-connector"
check_file "src/fhir-connector/package.json"
check_file "src/fhir-connector/host.json"
check_file "src/fhir-connector/src/index.ts"
check_file "src/fhir-connector/src/services/resource-mapper.ts"
check_file "src/fhir-connector/src/services/auth-service.ts"
check_file "src/fhir-connector/src/services/watermark-manager.ts"
check_file "src/fhir-connector/src/services/fhir-sync-service.ts"
check_file "src/fhir-connector/src/clients/openemr-client.ts"
check_file "src/fhir-connector/src/clients/ahds-client.ts"

check_dir "src/fhir-viewer"
check_file "src/fhir-viewer/package.json"
check_file "src/fhir-viewer/host.json"
check_file "src/fhir-viewer/src/index.ts"
check_file "src/fhir-viewer/src/services/jwt-validator.ts"
check_file "src/fhir-viewer/src/services/rate-limiter.ts"
check_file "src/fhir-viewer/src/clients/ahds-reader-client.ts"

if rg -n --glob '*.bicep' --glob '*.bicepparam' \
  'listKeys|AccountKey=|SharedAccessSignature|sig=|AZURE_STORAGE_CONNECTION_STRING|WEBSITE_RUN_FROM_PACKAGE' .; then
  fail 'forbidden key-based or SAS-based access pattern found'
else
  pass 'no forbidden key-based or SAS-based access pattern found'
fi

if rg -n --glob 'infra/**/*.bicep' \
  "allowSharedKeyAccess: false|allowBlobPublicAccess: false|publicNetworkAccess: 'Disabled'|defaultAction: 'Deny'" \
  infra/modules/storage.bicep >/dev/null; then
  pass 'Storage module contains keyless private defaults'
else
  fail 'Storage module is missing one or more keyless private defaults'
fi

if (( failures > 0 )); then
  echo "Validation completed with $failures failure(s)."
  exit 1
fi

echo "All static acceptance checks passed successfully."