# OpenEMR + Azure Health Data Services Integration - Architecture and Design

## Overview

This document describes the complete architecture of the OpenEMR + Azure Health Data Services (AHDS) integration, including the FHIR connector that enables automatic synchronization of patient data.

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Azure Resource Group                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐         ┌─────────────────────────────┐  │
│  │   OpenEMR VM     │         │   Azure Function App        │  │
│  │                  │         │   (FHIR Connector)          │  │
│  │  ┌────────────┐  │         │                             │  │
│  │  │  OpenEMR   │  │ OAuth2  │  ┌───────────────────────┐  │  │
│  │  │  Container │  ├────────>│  │  HTTP Functions       │  │  │
│  │  │  (7.0.2)   │  │         │  │  - syncPatient        │  │  │
│  │  └────────────┘  │         │  │  - syncObservation    │  │  │
│  │        │         │         │  │  - syncPatientWith... │  │  │
│  │        v         │         │  └───────────────────────┘  │  │
│  │  ┌────────────┐  │         │                             │  │
│  │  │   MySQL    │  │         │  ┌───────────────────────┐  │  │
│  │  │  Container │  │         │  │  Timer Function       │  │  │
│  │  │ (MariaDB)  │  │         │  │  - autoSync (1 min)   │  │  │
│  │  └────────────┘  │         │  └───────────────────────┘  │  │
│  │                  │         │                             │  │
│  │  FHIR API:       │         │  Dependencies:              │  │
│  │  /apis/default/  │         │  - Storage Account          │  │
│  │  fhir            │         │  - Application Insights     │  │
│  └──────────────────┘         └─────────────────────────────┘  │
│         │                                    │                  │
│         │                                    │ Azure AD         │
│         │                                    │ (OAuth2)         │
│         │                                    v                  │
│         │                      ┌─────────────────────────────┐  │
│         │                      │  Azure Health Data Services │  │
│         │                      │  (AHDS)                     │  │
│         │                      │                             │  │
│         │                      │  ┌───────────────────────┐  │  │
│         └─────────────────────>│  │  FHIR Service (R4)    │  │  │
│                                │  │  - Patient resources  │  │  │
│                                │  │  - Observation res.   │  │  │
│                                │  └───────────────────────┘  │  │
│                                └─────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Details

#### 1. OpenEMR VM
- **OS**: Ubuntu 22.04 LTS
- **Deployment**: Docker Compose
- **Services**:
  - OpenEMR 7.0.2 (PHP application)
  - MariaDB 10.11 (MySQL database)
- **Access**: HTTP/HTTPS via public IP
- **FHIR API**: `/apis/default/fhir/*`

#### 2. FHIR Connector (Azure Function App)
- **Runtime**: Node.js 18
- **Plan**: Consumption (serverless)
- **Functions**:
  - **HTTP-triggered**:
    - `syncPatient` - Sync individual patient
    - `syncObservation` - Sync individual observation
    - `syncPatientWithObservations` - Sync patient + all observations
  - **Timer-triggered**:
    - `autoSync` - Runs every minute, syncs all patients and observations

#### 3. Azure Health Data Services
- **Type**: FHIR R4 service
- **Authentication**: Azure AD (OAuth2)
- **Access**: Managed via RBAC (FHIR Data Contributor role)

## Data Flow

### Automatic Synchronization Flow

```
1. Timer Trigger (Every Minute)
   │
   v
2. autoSync Function Executes
   │
   ├─> Authenticate to OpenEMR (OAuth2 client credentials)
   │
   ├─> Search for all patients in OpenEMR
   │   GET /apis/default/fhir/Patient
   │
   ├─> For each patient:
   │   ├─> Authenticate to AHDS (Azure AD)
   │   ├─> Upsert patient to AHDS FHIR
   │   │   PUT /Patient/{id}
   │   │
   │   └─> Search for patient's observations
   │       GET /apis/default/fhir/Observation?patient={id}
   │       │
   │       └─> For each observation:
   │           └─> Upsert observation to AHDS FHIR
   │               PUT /Observation/{id}
   │
   └─> Log results to Application Insights
```

### Manual Sync Flow

```
1. HTTP Request to Function
   POST /api/syncPatient
   Body: { "patientId": "1" }
   │
   v
2. Function Authenticates
   ├─> OpenEMR OAuth2
   └─> Azure AD
   │
   v
3. Retrieve Resource from OpenEMR
   GET /apis/default/fhir/Patient/1
   │
   v
4. Push Resource to AHDS
   PUT /Patient/1
   │
   v
5. Return Success/Failure
```

## Authentication & Security

### OpenEMR Authentication
- **Method**: OAuth2 Client Credentials Flow
- **Grant Type**: `client_credentials`
- **Scope**: `api:fhir`
- **Token Endpoint**: `/oauth2/default/token`
- **Token Lifetime**: Configurable in OpenEMR (typically 1 hour)

### AHDS Authentication
- **Method**: Azure AD OAuth2
- **Credential Types**:
  - Client Secret (current implementation)
  - Managed Identity (recommended for production)
- **Scope**: `{fhir-endpoint}/.default`
- **Role Required**: FHIR Data Contributor

### Security Best Practices

1. **Secrets Management**
   - Store secrets in Azure Key Vault
   - Reference via function app settings: `@Microsoft.KeyVault(...)`
   - Rotate secrets regularly

2. **Network Security**
   - OpenEMR: Configure NSG to restrict access
   - AHDS: Use Private Link for production
   - Function App: Enable IP restrictions

3. **Identity**
   - Use System-Assigned Managed Identity
   - Grant minimal required permissions
   - Enable Azure AD authentication on function endpoints

4. **Monitoring**
   - Enable Application Insights
   - Configure alerts for failures
   - Regular security audits

## Data Model

### FHIR Resources

#### Patient Resource
```json
{
  "resourceType": "Patient",
  "id": "1",
  "identifier": [{
    "system": "urn:oid:1.2.36.146.595.217.0.1",
    "value": "12345"
  }],
  "name": [{
    "use": "official",
    "family": "Doe",
    "given": ["John"]
  }],
  "gender": "male",
  "birthDate": "1980-01-01"
}
```

#### Observation Resource
```json
{
  "resourceType": "Observation",
  "id": "1",
  "status": "final",
  "code": {
    "coding": [{
      "system": "http://loinc.org",
      "code": "29463-7",
      "display": "Body Weight"
    }]
  },
  "subject": {
    "reference": "Patient/1"
  },
  "effectiveDateTime": "2024-01-01T12:00:00Z",
  "valueQuantity": {
    "value": 185,
    "unit": "lbs",
    "system": "http://unitsofmeasure.org",
    "code": "[lb_av]"
  }
}
```

## Error Handling & Retry Logic

### Retry Strategy

The sync service implements exponential backoff:

```typescript
Attempt 1: Execute immediately
Attempt 2: Wait 1 second (2^0 * 1000ms)
Attempt 3: Wait 2 seconds (2^1 * 1000ms)
Max Attempts: 3
```

### Error Categories

1. **Transient Errors** (Retried)
   - Network timeouts
   - 429 Rate Limiting
   - 503 Service Unavailable
   - Token expiration

2. **Permanent Errors** (Not Retried)
   - 401 Unauthorized
   - 400 Bad Request (invalid FHIR resource)
   - 404 Not Found (resource doesn't exist)

### Logging

All operations are logged with:
- Timestamp
- Operation type
- Resource type and ID
- Success/failure status
- Error details (if applicable)
- Retry attempts

## Performance Considerations

### Throughput

- **Auto-sync frequency**: Every 1 minute
- **Concurrent operations**: Limited by function app scaling
- **Batch size**: All patients per execution (POC - optimize for production)

### Optimization Strategies (Production)

1. **Incremental Sync**
   ```typescript
   // Only sync resources modified since last sync
   const lastSync = await getLastSyncTimestamp();
   searchParams._lastUpdated = `gt${lastSync}`;
   ```

2. **Pagination**
   ```typescript
   // Process large datasets in batches
   let nextUrl = `/Patient?_count=100`;
   while (nextUrl) {
     const bundle = await fetch(nextUrl);
     processBatch(bundle.entry);
     nextUrl = bundle.link.find(l => l.relation === 'next')?.url;
   }
   ```

3. **Parallel Processing**
   ```typescript
   // Process patients in parallel
   const results = await Promise.all(
     patients.map(p => syncPatient(p.id))
   );
   ```

## Monitoring & Observability

### Key Metrics

1. **Sync Success Rate**
   ```kusto
   traces
   | where message contains "Successfully synced"
   | summarize SuccessCount = count() by bin(timestamp, 1h)
   ```

2. **Sync Latency**
   ```kusto
   requests
   | where name startswith "sync"
   | summarize avg(duration), percentile(duration, 95) by name
   ```

3. **Error Rate**
   ```kusto
   exceptions
   | summarize ErrorCount = count() by problemId
   | order by ErrorCount desc
   ```

### Alerts

Configure alerts for:
- Sync success rate < 95%
- Average latency > 5 seconds
- Authentication failures > 5 in 5 minutes
- Function execution failures

## Deployment Architecture

### Infrastructure as Code

```
integrated-deployment/
├── azuredeploy.json          # ARM template (nested deployment)
├── azuredeploy.parameters.json
├── deploy.sh                  # Automated deployment script
├── verify.sh                  # Verification script
├── README.md                  # Full documentation
└── QUICKSTART.md             # Quick start guide
```

### Deployment Options

1. **One-Click Azure Portal**
   - Deploy to Azure button
   - Web-based parameter input
   - ~20 minutes

2. **Automated Script**
   - Bash script (`deploy.sh`)
   - Minimal user input
   - ~20 minutes + manual API client setup

3. **Manual/Scripted**
   - Step-by-step via Azure CLI
   - Full control over each resource
   - ~30-45 minutes

## Extension Points

### Adding New Resource Types

1. **Create sync method** in `src/sync-service.ts`:
   ```typescript
   async syncEncounter(encounterId: string): Promise<SyncResult> {
     // Implementation similar to syncPatient
   }
   ```

2. **Create Azure Function** in `functions/syncEncounter.ts`:
   ```typescript
   export async function syncEncounter(
     request: HttpRequest,
     context: InvocationContext
   ): Promise<HttpResponseInit> {
     // Function handler
   }
   ```

3. **Update autoSync** to include new resource type

### Custom Transformations

Add transformation logic in sync service:

```typescript
private transformResource(resource: any): any {
  // Map OpenEMR codes to standard terminologies
  // Normalize identifiers
  // Add provenance information
  return transformedResource;
}
```

## Compliance & Governance

### PHI Handling

- **Encryption in Transit**: All API calls use HTTPS/TLS 1.2+
- **Encryption at Rest**: AHDS encrypts data at rest automatically
- **Access Logs**: All data access logged via Application Insights
- **Data Residency**: Configure region during deployment
- **Retention**: No PHI stored in function app (stateless)

### Audit Trail

Every sync operation creates an audit entry:
- Who: Service principal ID
- What: Resource type and ID
- When: ISO 8601 timestamp
- Where: Source (OpenEMR) and destination (AHDS)
- Result: Success or failure with details

## Disaster Recovery

### Backup Strategy

1. **OpenEMR**
   - MySQL: Automated backups via Azure Backup
   - Container volumes: Persistent across deployments

2. **AHDS**
   - Automatic backup and geo-replication (configured at service level)
   - Point-in-time restore capability

3. **Function App**
   - Infrastructure as Code (redeploy anytime)
   - Configuration in Key Vault (backed up)

### Recovery Procedures

1. **OpenEMR Failure**
   - Restore VM from backup
   - Verify Docker containers are running
   - Sync resumes automatically

2. **AHDS Failure**
   - Azure handles service recovery
   - Function retries will handle temporary outages

3. **Function App Failure**
   - Redeploy from ARM template
   - Restore application settings
   - Manual sync to catch up if needed

## Cost Optimization

### Estimated Monthly Costs (USD)

| Component | SKU | Estimated Cost |
|-----------|-----|---------------|
| VM (B2s) | 2 vCPU, 4 GB RAM | $30-40 |
| AHDS FHIR | Standard | $0.05/transaction |
| Function App | Consumption | $5-10 |
| Storage | LRS | $1-2 |
| Application Insights | Pay-as-you-go | $2-5 |
| **Total** | | **~$40-60/month** |

### Cost Reduction Strategies

1. **Use Reserved Instances** for VM (save up to 72%)
2. **Optimize sync frequency** (reduce to 5 or 15 minutes)
3. **Implement incremental sync** (reduce AHDS transactions)
4. **Use cheaper VM SKU** for dev/test (B1s)

## Future Enhancements

### Roadmap

1. **Phase 1 (Current POC)**
   - ✅ Patient + Observation sync
   - ✅ Automatic sync every minute
   - ✅ Basic retry logic
   - ✅ Logging and monitoring

2. **Phase 2 (Production-Ready)**
   - [ ] Incremental sync (only changed records)
   - [ ] Additional resource types (Encounter, Medication, etc.)
   - [ ] Managed Identity authentication
   - [ ] Key Vault integration
   - [ ] Enhanced error handling

3. **Phase 3 (Advanced Features)**
   - [ ] Bi-directional sync (AHDS → OpenEMR)
   - [ ] Conflict resolution
   - [ ] Terminology mapping (SNOMED, LOINC)
   - [ ] De-duplication
   - [ ] Data quality validation

4. **Phase 4 (Scale & Performance)**
   - [ ] Bulk FHIR import/export
   - [ ] Durable Functions for orchestration
   - [ ] Event-driven sync (webhooks)
   - [ ] Multi-tenant support

## References

- [OpenEMR Documentation](https://www.open-emr.org/wiki/)
- [Azure Health Data Services Documentation](https://docs.microsoft.com/azure/healthcare-apis/)
- [FHIR R4 Specification](https://hl7.org/fhir/R4/)
- [Azure Functions Documentation](https://docs.microsoft.com/azure/azure-functions/)
- [HIPAA Compliance on Azure](https://docs.microsoft.com/azure/compliance/offerings/offering-hipaa-us)
