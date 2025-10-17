# Architecture Overview

This document describes the architecture of the OpenEMR FHIR Connector for Azure Health Data Services.

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          Azure Health Data Services                       │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                        FHIR Service (R4)                          │    │
│  │  • Patient Resources                                              │    │
│  │  • Observation Resources                                          │    │
│  │  • Other FHIR Resources                                           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ HTTPS + OAuth2 (Azure AD)
                                    │
┌──────────────────────────────────────────────────────────────────────────┐
│                        Azure Function App                                 │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  HTTP Trigger Functions                                          │    │
│  │  • syncPatient                                                    │    │
│  │  • syncObservation                                                │    │
│  │  • syncPatientWithObservations                                    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Core Services                                                    │    │
│  │  • OpenEMR Client (OAuth2)                                        │    │
│  │  • AHDS Client (Azure AD)                                         │    │
│  │  • Sync Service (Orchestration & Retry)                           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Supporting Services                                              │    │
│  │  • Application Insights (Logging & Monitoring)                    │    │
│  │  • Key Vault (Secrets Management) [Optional]                      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ HTTPS + OAuth2 (Client Credentials)
                                    │
┌──────────────────────────────────────────────────────────────────────────┐
│                          OpenEMR Instance                                 │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    FHIR R4 API Endpoint                           │    │
│  │  • /apis/default/fhir/Patient                                     │    │
│  │  • /apis/default/fhir/Observation                                 │    │
│  │  • /apis/default/fhir/metadata                                    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                  OAuth2 Server                                    │    │
│  │  • Client credentials grant                                       │    │
│  │  • Token endpoint: /oauth2/default/token                          │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                  MySQL Database                                   │    │
│  │  • Patient data                                                   │    │
│  │  • Clinical data                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

## Component Details

### OpenEMR Instance
- **Container**: openemr/openemr:7.0.2
- **FHIR API**: Native FHIR R4 support
- **Authentication**: OAuth2 with client credentials flow
- **Database**: MariaDB/MySQL for data persistence

### Azure Function App
- **Runtime**: Node.js 18.x
- **Language**: TypeScript
- **Hosting**: Consumption Plan (serverless)
- **Triggers**: HTTP-triggered functions
- **Authentication**: Function key or Azure AD

### Azure Health Data Services
- **Service**: FHIR service (managed)
- **Version**: FHIR R4
- **Authentication**: Azure AD (OAuth2)
- **Roles**: FHIR Data Contributor required

## Data Flow

### Sync Patient Flow

```
1. Client Request
   │
   ├─> POST /api/sync-patient
   │   Body: { "patientId": "1" }
   │
2. Function Initialization
   │
   ├─> Create OpenEMR Client
   ├─> Create AHDS Client
   ├─> Create Sync Service
   │
3. OpenEMR Authentication
   │
   ├─> POST /oauth2/default/token
   │   grant_type=client_credentials
   │   client_id=...
   │   client_secret=...
   │   scope=api:fhir
   │
   └─> Receive access_token
   │
4. Fetch Patient from OpenEMR
   │
   ├─> GET /apis/default/fhir/Patient/1
   │   Authorization: Bearer {token}
   │
   └─> Receive Patient FHIR resource
   │
5. Azure AD Authentication
   │
   ├─> POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
   │   grant_type=client_credentials
   │   client_id=...
   │   client_secret=...
   │   scope={fhir-endpoint}/.default
   │
   └─> Receive access_token
   │
6. Push to AHDS
   │
   ├─> PUT {fhir-endpoint}/Patient/1
   │   Authorization: Bearer {token}
   │   Content-Type: application/fhir+json
   │   Body: {Patient resource}
   │
   └─> Receive confirmation
   │
7. Response
   │
   └─> Return success/failure to client
```

### Retry Logic

```
Operation Attempt 1
   │
   ├─> Success? ──> Return result
   │
   └─> Failure
       │
       ├─> Wait 1 second
       │
       Operation Attempt 2
       │
       ├─> Success? ──> Return result
       │
       └─> Failure
           │
           ├─> Wait 2 seconds (exponential backoff)
           │
           Operation Attempt 3
           │
           ├─> Success? ──> Return result
           │
           └─> Failure ──> Throw error
```

## Security Architecture

### Authentication Flows

**OpenEMR Authentication (OAuth2 Client Credentials)**
```
Function App ──> OpenEMR OAuth2 Server
   │
   ├─> Request: client_id, client_secret, scope
   │
   └─> Response: access_token (bearer token)
   │
   ├─> Use token for FHIR API requests
   │
   └─> Token refresh when expired
```

**AHDS Authentication (Azure AD)**
```
Function App ──> Azure AD
   │
   ├─> Request: tenant_id, client_id, client_secret
   │
   └─> Response: access_token (bearer token)
   │
   ├─> Use token for FHIR API requests
   │
   └─> Token refresh when expired
```

### Security Layers

1. **Transport Security**
   - All API calls use HTTPS/TLS
   - Minimum TLS 1.2
   - Certificate validation

2. **Authentication**
   - OAuth2/OpenID Connect
   - Azure AD integration
   - Client credentials flow

3. **Authorization**
   - RBAC in Azure (FHIR Data Contributor)
   - Scope-based access in OpenEMR
   - Least privilege principle

4. **Secrets Management**
   - Environment variables (basic)
   - Azure Key Vault (recommended)
   - Managed identities (production)

5. **Network Security**
   - Private endpoints (optional)
   - Virtual network integration
   - IP restrictions

## Scalability Considerations

### Horizontal Scaling
- Azure Functions automatically scale based on load
- Consumption plan handles bursts up to 200 instances
- Premium plan for reserved capacity

### Vertical Scaling
- Adjust timeout values for large resources
- Increase memory allocation if needed
- Use premium plan for higher limits

### Performance Optimization
- Token caching to reduce auth overhead
- Connection pooling in HTTP clients
- Batch operations for bulk sync
- Async processing for large datasets

## Monitoring & Observability

### Application Insights Integration

```
Function Execution
   │
   ├─> Telemetry Events
   │   • Request start/end
   │   • Authentication events
   │   • API calls
   │   • Errors/exceptions
   │
   ├─> Metrics
   │   • Execution time
   │   • Success rate
   │   • Retry attempts
   │   • Resource count
   │
   └─> Logs
       • Info/Debug messages
       • Error details
       • Stack traces
```

### Key Metrics

- **Sync Success Rate**: Percentage of successful syncs
- **Sync Latency**: Time to complete sync operation
- **Auth Failure Rate**: Failed authentication attempts
- **Retry Rate**: Percentage of operations requiring retry
- **Resource Count**: Number of resources synced per time period

## Extension Points

### Adding New Resource Types

1. Create new sync method in `SyncService`
2. Add new Azure Function in `functions/`
3. Update documentation
4. Deploy and test

### Implementing Batch Sync

```typescript
async syncBatch(resourceType: string, resourceIds: string[]): Promise<SyncResult[]> {
  const results = [];
  for (const id of resourceIds) {
    const result = await this.syncResource(resourceType, id);
    results.push(result);
  }
  return results;
}
```

### Adding Terminology Mapping

```typescript
function mapTerminology(resource: any): any {
  // Map local codes to standard terminologies
  // SNOMED CT, LOINC, RxNorm, etc.
  return transformedResource;
}
```

### Implementing Incremental Sync

```typescript
async syncSince(resourceType: string, lastSyncTime: Date): Promise<SyncResult[]> {
  // Query OpenEMR for resources modified since lastSyncTime
  // Sync only changed resources
}
```

## Deployment Options

### Option 1: Serverless (Recommended for POC)
- Azure Functions Consumption Plan
- Auto-scaling
- Pay-per-execution
- No infrastructure management

### Option 2: Premium Plan
- Pre-warmed instances
- Virtual network integration
- Higher limits
- Predictable costs

### Option 3: Container-based
- Deploy as container to ACI or AKS
- Full control over runtime
- Custom scaling policies
- More complex management

## Disaster Recovery

### Backup Strategy
- AHDS automatic backups (managed service)
- OpenEMR database backups
- Function app code in source control

### Recovery Procedures
1. Restore AHDS from backup
2. Redeploy function app from source
3. Re-sync data from OpenEMR if needed

### High Availability
- AHDS: 99.9% SLA (managed service)
- Function App: Multi-region deployment
- OpenEMR: Load balancer + multiple instances

## Cost Estimation

### POC/Development
- AHDS FHIR: ~$0.50/hour (~$360/month)
- Function App: <$10/month (low volume)
- Storage: <$5/month
- **Total**: ~$375/month

### Production
- AHDS FHIR: ~$0.50-1.00/hour (~$360-720/month)
- Function App Premium: ~$150/month
- Application Insights: ~$50/month
- Key Vault: ~$5/month
- **Total**: ~$565-925/month

## References

- [FHIR R4 Specification](https://hl7.org/fhir/R4/)
- [Azure Health Data Services Docs](https://docs.microsoft.com/azure/healthcare-apis/)
- [OpenEMR API Documentation](https://www.open-emr.org/wiki/index.php/OpenEMR_API)
- [Azure Functions Documentation](https://docs.microsoft.com/azure/azure-functions/)
