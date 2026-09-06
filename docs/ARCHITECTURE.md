# System Architecture: OpenEMR to Azure Health Data Services

## Overview

This system provides a one-way, automated synchronization of Patient and
Observation resources from OpenEMR to Azure Health Data Services (AHDS) FHIR R4.

```
┌────────────────────────────────┐
│ OpenEMR 8.3.0 + MariaDB 11.8.8 │
│ (Azure IaaS VM + Caddy TLS)    │
└───────────────┬────────────────┘
                │ OAuth2 RS384 (private_key_jwt)
                │ FHIR R4 queries (_lastUpdated)
┌───────────────▼────────────────┐
│ Azure Function: Connector      │
│ (Node 22 Flex FC1, VNet)       │
└───────────────┬────────────────┘
                │ Managed Identity (FHIR Data Contributor)
                │ Conditional PUT / deterministic IDs
┌───────────────▼────────────────┐
│ Azure Health Data Services     │
│ (AHDS FHIR R4, Private EP)     │
└───────────────▲────────────────┘
                │ Managed Identity (FHIR Data Reader)
┌───────────────┴────────────────┐
│ Azure Function: Viewer         │
│ (Node 22 Flex FC1, Entra PKCE) │
└────────────────────────────────┘
```

## Key Components

1. **OpenEMR Stack**: Ubuntu 24.04 LTS VM running pinned `openemr/openemr:8.3.0`
   and `mariadb:11.8.8` containers with Caddy reverse proxy for TLS termination.
2. **FHIR Connector**: Node 22 Azure Function on Flex Consumption (`FC1`). Runs
   a 1-minute timer to query changed Patients and Observations from OpenEMR and
   upsert them to AHDS.
3. **FHIR Viewer**: Node 22 Azure Function on Flex Consumption (`FC1`). Provides
   a read-only browser UI + BFF using Entra ID PKCE authentication.
4. **Azure Health Data Services**: Managed FHIR R4 service with private
   endpoints and Azure RBAC authorization.
5. **Key Vault**: RBAC-only key vault holding the OpenEMR asymmetric client
   private key and client ID.

## Identity and Mapping

- **Resource IDs**: Destination AHDS IDs are derived deterministically:
  `SHA256(openemrBaseUrl/resourceType/sourceId)[0..48]`.
- **Subject Rewrite**: Observation `subject.reference` is rewritten from
  `Patient/{openemrId}` to `Patient/{mappedDestinationId}`.
- **Watermarks**: Stored in keyless Azure Table Storage per resource type.
