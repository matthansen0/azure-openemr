# OpenEMR FHIR Connector for Azure Health Data Services

This Azure Function application enables synchronization of FHIR R4 resources from OpenEMR to Azure Health Data Services (AHDS).

## Overview

The connector implements a POC (Proof of Concept) integration pattern that:
- Authenticates to OpenEMR FHIR API using OAuth2 client credentials
- Authenticates to Azure Health Data Services using Azure AD
- Syncs Patient and Observation resources from OpenEMR to AHDS
- Includes retry logic for transient failures
- Provides comprehensive logging and error handling

## Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│  OpenEMR    │ ──────> │  Azure Function  │ ──────> │    AHDS     │
│  FHIR API   │ OAuth2  │  FHIR Connector  │ Azure AD│  FHIR API   │
└─────────────┘         └──────────────────┘         └─────────────┘
```

### Components

- **OpenEMR Client** (`src/openemr-client.ts`): Handles authentication and retrieval of FHIR resources from OpenEMR
- **AHDS Client** (`src/ahds-client.ts`): Handles authentication and pushing FHIR resources to Azure Health Data Services
- **Sync Service** (`src/sync-service.ts`): Orchestrates synchronization with retry logic
- **Azure Functions**:
  - `syncPatient`: Syncs a single patient by ID
  - `syncObservation`: Syncs a single observation by ID
  - `syncPatientWithObservations`: Syncs a patient and all their observations

## Prerequisites

1. **OpenEMR Instance**
   - OpenEMR 7.0.2 or later deployed (see main repo README)
   - FHIR API enabled in Admin > Globals > Connectors
   - OAuth2 client registered for API access

2. **Azure Health Data Services**
   - AHDS workspace provisioned
   - FHIR service deployed
   - Azure AD app registration with FHIR.Read and FHIR.Write permissions

3. **Development Tools**
   - Node.js 18.x or later
   - Azure Functions Core Tools 4.x
   - TypeScript 5.x

## Setup

### 1. Install Dependencies

```bash
cd fhir-connector
npm install
```

### 2. Configure OpenEMR API Client

In OpenEMR:
1. Navigate to **Administration** > **System** > **API Clients**
2. Click **Register New API Client**
3. Configure:
   - **Client Name**: FHIR Connector
   - **Grant Type**: Client Credentials
   - **Scope**: `api:fhir`
   - **Redirect URI**: Not required for client credentials
4. Save and note the **Client ID** and **Client Secret**

### 3. Configure Azure AD App Registration

In Azure Portal:
1. Navigate to **Azure Active Directory** > **App registrations**
2. Click **New registration**
3. Configure:
   - **Name**: OpenEMR FHIR Connector
   - **Supported account types**: Single tenant
4. After creation, go to **Certificates & secrets** and create a new client secret
5. Go to **API permissions** and add:
   - **Azure Healthcare APIs** > **user_impersonation**
   - Grant admin consent
6. Note the **Application (client) ID**, **Directory (tenant) ID**, and **Client Secret**

### 4. Configure Local Settings

Copy `local.settings.json` and update with your values:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "OPENEMR_BASE_URL": "https://your-openemr-instance.com",
    "OPENEMR_CLIENT_ID": "your-openemr-client-id",
    "OPENEMR_CLIENT_SECRET": "your-openemr-client-secret",
    "AHDS_FHIR_ENDPOINT": "https://your-workspace-fhir.fhir.azurehealthcareapis.com",
    "AHDS_TENANT_ID": "your-tenant-id",
    "AHDS_CLIENT_ID": "your-azure-ad-client-id",
    "AHDS_CLIENT_SECRET": "your-azure-ad-client-secret"
  }
}
```

## Development

### Build

```bash
npm run build
```

### Run Locally

```bash
npm start
```

The functions will be available at:
- `http://localhost:7071/api/sync-patient`
- `http://localhost:7071/api/sync-observation`
- `http://localhost:7071/api/sync-patient-with-observations`

## Usage

### Sync a Single Patient

```bash
curl -X POST http://localhost:7071/api/sync-patient \
  -H "Content-Type: application/json" \
  -d '{"patientId": "1"}'
```

### Sync a Single Observation

```bash
curl -X POST http://localhost:7071/api/sync-observation \
  -H "Content-Type: application/json" \
  -d '{"observationId": "1"}'
```

### Sync Patient with Observations

```bash
curl -X POST http://localhost:7071/api/sync-patient-with-observations \
  -H "Content-Type: application/json" \
  -d '{"patientId": "1"}'
```

## Deployment

### Deploy to Azure

See [deployment/README.md](deployment/README.md) for detailed deployment instructions using Azure Resource Manager templates.

Quick deployment:

```bash
# Create resource group
az group create --name openemr-fhir-connector-rg --location eastus

# Deploy function app and dependencies
az deployment group create \
  --resource-group openemr-fhir-connector-rg \
  --template-file deployment/function-app.json \
  --parameters deployment/function-app.parameters.json

# Publish function code
func azure functionapp publish <your-function-app-name>
```

### Configure Application Settings

After deployment, configure the application settings in Azure Portal or via Azure CLI:

```bash
az functionapp config appsettings set \
  --name <your-function-app-name> \
  --resource-group openemr-fhir-connector-rg \
  --settings \
    OPENEMR_BASE_URL=https://your-openemr-instance.com \
    OPENEMR_CLIENT_ID=your-openemr-client-id \
    OPENEMR_CLIENT_SECRET=your-openemr-client-secret \
    AHDS_FHIR_ENDPOINT=https://your-workspace-fhir.fhir.azurehealthcareapis.com \
    AHDS_TENANT_ID=your-tenant-id \
    AHDS_CLIENT_ID=your-azure-ad-client-id \
    AHDS_CLIENT_SECRET=your-azure-ad-client-secret
```

## Security & Compliance

### PHI Data Handling

This connector handles Protected Health Information (PHI). Ensure compliance with applicable regulations:

- **Encryption in Transit**: All API calls use HTTPS/TLS
- **Encryption at Rest**: AHDS encrypts data at rest by default
- **Access Control**: Use managed identities in production (recommended over client secrets)
- **Audit Logging**: Enable Application Insights for comprehensive logging
- **Minimal Retention**: No PHI is persisted in the function app
- **Least Privilege**: Grant minimal required permissions to service principals

### Production Recommendations

1. **Use Managed Identity** instead of client secret for AHDS authentication
2. **Store secrets in Azure Key Vault** and reference them in function app settings
3. **Enable Application Insights** for monitoring and diagnostics
4. **Implement IP restrictions** on function app if not publicly accessible
5. **Enable Advanced Threat Protection** on AHDS workspace
6. **Regular security reviews** and credential rotation

## Monitoring

### Logging

The connector logs:
- Authentication events (success/failure)
- Resource sync operations (start, success, failure)
- Retry attempts
- Error details

Logs are available in:
- Azure Function logs (Function App > Log stream)
- Application Insights (if enabled)

### Metrics

Key metrics to monitor:
- Sync success rate
- Sync latency
- Authentication failures
- Retry counts

## Troubleshooting

### Common Issues

**Authentication Failed (OpenEMR)**
- Verify client ID and secret are correct
- Ensure FHIR API is enabled in OpenEMR globals
- Check client has `api:fhir` scope

**Authentication Failed (AHDS)**
- Verify tenant ID, client ID, and client secret
- Ensure app registration has FHIR permissions
- Confirm admin consent was granted

**Resource Not Found**
- Verify resource ID exists in OpenEMR
- Check FHIR API endpoint is accessible
- Ensure patient/observation exists in OpenEMR database

**Sync Failures**
- Check network connectivity between function app and endpoints
- Review Application Insights for detailed error messages
- Verify FHIR resource format compatibility

## Extension Points

This POC can be extended for production use:

1. **Additional Resource Types**: Add support for Encounter, MedicationRequest, Condition, etc.
2. **Bulk Sync**: Implement batch synchronization using OpenEMR `$export` and AHDS import
3. **Incremental Sync**: Track last sync timestamp and sync only changed resources
4. **Terminology Mapping**: Map OpenEMR codes to standard terminologies (SNOMED, LOINC)
5. **De-duplication**: Check for existing resources in AHDS before creating
6. **Scheduling**: Add timer-triggered functions for automatic periodic sync
7. **Webhooks**: Implement event-driven sync based on OpenEMR changes

## License

MIT License - See [LICENSE](../LICENSE) file in repository root

## Contributing

Contributions welcome! Please see the main repository [README](../README.md) for contribution guidelines.

## Support

For issues or questions:
- Open an issue on GitHub
- Review OpenEMR documentation: https://www.open-emr.org/wiki/
- Review AHDS documentation: https://docs.microsoft.com/azure/healthcare-apis/
