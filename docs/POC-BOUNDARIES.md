# Proof of Concept Scope and Boundaries

## In Scope

- One-way synchronization from OpenEMR 8.3.0 to AHDS FHIR R4.
- Patient and Observation FHIR resource types.
- 1-minute timer cadence.
- RS384 asymmetric client assertion authentication.
- Managed-identity keyless private Azure data planes.
- Read-only Entra-authenticated FHIR viewer.

## Out of Scope

- Bidirectional synchronization or writes back to OpenEMR.
- Resource deletions or purge operations.
- Additional FHIR resource types (Medications, Encounters, etc.).
- Bulk FHIR `$export` or `$import`.
- Clinical certification or HIPAA compliance guarantees.
- High availability or multi-region failover.
