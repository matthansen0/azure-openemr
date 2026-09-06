# OpenEMR to Azure Health Data Services

This repository is rebuilding the original OpenEMR-to-AHDS idea as a secure,
synthetic-data proof of concept. The primary deployment is an `azd` workflow
backed by modular Bicep. It provisions OpenEMR, an Azure Health Data Services
FHIR R4 service, a one-way Patient and Observation connector, and a separate
read-only FHIR viewer.

The deployment is deliberately not a production or clinical certification. It
does not claim HIPAA compliance, high availability, disaster recovery, or
support for real patient data.

## Quick start

Use the repository dev container. The host machine must have Docker and VS
Code Dev Containers available; the container supplies Node.js 22, Azure CLI,
azd, Bicep, Docker Compose, shellcheck, jq, and the validation toolchain.

```powershell
az login --use-device-code
azd auth login --use-device-code
azd init
azd up
```

`azd up` is a complete acceptance workflow. It must provision the resources,
bootstrap OpenEMR, register the connector, deploy both Function apps, prove
private dependency access, wait for timer-driven Patient and Observation sync,
and verify the viewer's separate read-only identity. A successful ARM response
alone is not considered a successful deployment.

All Azure data planes are private and default-deny. Storage shared-key access,
account-key SAS, connection strings, public blobs, and temporary public
firewall exceptions are not used. Functions use managed identity for Storage,
Key Vault, and AHDS access.

## Versions

The integrated deployment targets the verified supported production pair:

- OpenEMR `8.3.0`, pinned to an architecture-specific immutable image digest
  during implementation.
- MariaDB `11.8.8`, pinned to the upstream digest verified for that release.
- Azure Functions Flex Consumption `FC1`, Node.js `22`, programming model v4.
- Azure Health Data Services FHIR R4.

## Inspecting FHIR data

The Azure portal manages AHDS but does not provide a FHIR resource browser. The
POC includes an Entra-authenticated, read-only browser viewer restricted to
Patient and Observation resources. It uses a separate managed identity with
`FHIR Data Reader`; the connector identity is not exposed to the browser.

Authenticated REST/curl and Postman instructions, including the required
private-network path, will be documented with the deployment runbook. The
Microsoft Power Query FHIR connector is also suitable for authorized read-only
inspection.

## Legacy deployment

The [all-in-one](all-in-one/) directory is retained as the original
OpenEMR-only ARM/Compose path. It uses older images, public assumptions, and
legacy bootstrap behavior. It is not part of the AHDS POC and is intentionally
not modified by the new implementation.

## Development and validation

Run the canonical checks from the dev container before deployment:

```bash
npm --prefix src/fhir-connector run typecheck
npm --prefix src/fhir-connector test
npm --prefix src/fhir-viewer run typecheck
npm --prefix src/fhir-viewer test
az bicep build --file infra/main.bicep
scripts/validate.sh
```

The validator reports `PASS`, `FAIL`, and `SKIP`, checks effective Azure
settings, and writes redacted deployment diagnostics. Logs must not contain
FHIR bodies, patient names, dates of birth, identifiers, Observation values,
credentials, or access tokens.

## Cleanup

```powershell
azd down --force --purge
```

The teardown hook removes the environment-scoped viewer app registration and
then lets azd remove the Azure resource group.