# Security Architecture

## Principles

1. **Zero Shared Keys or Connection Strings**: Storage accounts disable shared
   key access (`allowSharedKeyAccess: false`). Access uses Managed Identity.
2. **Private Data Planes**: Key Vault, Storage accounts, and AHDS FHIR service
   have public network access disabled (`publicNetworkAccess: 'Disabled'`).
3. **Least Privilege Azure RBAC**:
   - Connector identity: `FHIR Data Contributor` on AHDS, `Key Vault Secrets User` on Key Vault.
   - Viewer identity: `FHIR Data Reader` on AHDS.
   - OpenEMR VM identity: `Key Vault Secrets User` on Key Vault.
4. **Asymmetric OAuth Authentication**: OpenEMR integration uses `private_key_jwt`
   with RS384 assertions signed by a private key stored in Key Vault.
5. **No PHI in Telemetry**: Application Insights logs emit operational counters
   and diagnostic metrics only. No patient names, dates of birth, or resource payloads are logged.
