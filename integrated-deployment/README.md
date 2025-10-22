# Integrated Deployment: OpenEMR + Azure Health Data Services + FHIR Connector

This directory contains scripts for deploying a complete, integrated solution that includes:
1. **OpenEMR** - Electronic Medical Records system on Azure VM
2. **Azure Health Data Services (AHDS)** - FHIR R4 service
3. **FHIR Connector** - Azure Function for automatic synchronization
4. **Automated Configuration** - Complete setup with minimal user interaction
5. **Verification** - Test patient creation and validation

## Overview

The integrated deployment automates the complete setup process:

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│  OpenEMR    │ ──────> │  Azure Function  │ ──────> │    AHDS     │
│  FHIR API   │ OAuth2  │  FHIR Connector  │ Azure AD│  FHIR API   │
│  (VM)       │         │  (Auto-sync 1min)│         │  (Managed)  │
└─────────────┘         └──────────────────┘         └─────────────┘
```

## Prerequisites

1. **Azure Subscription** with permissions to:
   - Create resource groups and resources
   - Create Azure AD app registrations
   - Assign roles

2. **Azure CLI** installed and configured
   ```bash
   # Install Azure CLI
   curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
   
   # Login to Azure
   az login
   ```

3. **jq** for JSON parsing
   ```bash
   # Install jq (Ubuntu/Debian)
   sudo apt-get install jq
   
   # Install jq (macOS)
   brew install jq
   ```

## Quick Start

### 1. Deploy Everything

```bash
# Clone the repository
git clone https://github.com/matthansen0/azure-openemr.git
cd azure-openemr/integrated-deployment

# Run the deployment script
./deploy.sh [branch_name]

# Examples:
./deploy.sh main              # Deploy from main branch
./deploy.sh dev               # Deploy from dev branch
./deploy.sh feature/my-branch # Deploy from custom branch
```

The deployment script will:
- Prompt for VM credentials (username and password)
- Create a new Azure resource group
- Deploy OpenEMR on an Azure VM (~15 minutes)
- Deploy Azure Health Data Services (FHIR R4)
- Create Azure AD app registration
- Deploy FHIR Connector Function App
- Configure all necessary settings
- Save deployment information to `deployment-info.json`

### 2. Manual Configuration (One-Time Setup)

After deployment, you need to configure the OpenEMR API client **once**:

1. **Access OpenEMR**
   - URL will be displayed at the end of deployment
   - Default credentials: `admin / openEMRonAzure!`

2. **Enable FHIR API**
   - Navigate to **Administration** → **Globals** → **Connectors**
   - Enable **"Enable OpenEMR Patient FHIR API"**
   - Enable **"Enable OpenEMR FHIR API"**
   - Click **Save**

3. **Register API Client**
   - Go to **Administration** → **System** → **API Clients**
   - Click **"Register New API Client"**
   - Configure:
     - **Client Name**: `FHIR Connector`
     - **Grant Type**: `Client Credentials`
     - **Scope**: Check `api:fhir`
   - Click **Register**
   - **IMPORTANT**: Copy the Client ID and Client Secret

4. **Update Function App Settings**
   ```bash
   # Load deployment info
   RESOURCE_GROUP=$(jq -r '.resourceGroup' deployment-info.json)
   FUNCTION_APP=$(jq -r '.functionApp.name' deployment-info.json)
   
   # Update with your actual OpenEMR credentials
   az functionapp config appsettings set \
     --name "$FUNCTION_APP" \
     --resource-group "$RESOURCE_GROUP" \
     --settings \
       OPENEMR_CLIENT_ID="your-actual-client-id" \
       OPENEMR_CLIENT_SECRET="your-actual-client-secret"
   ```

### 3. Deploy Function Code

```bash
# Navigate to fhir-connector directory
cd ../fhir-connector

# Install dependencies
npm install

# Build TypeScript
npm run build

# Deploy to Azure
FUNCTION_APP=$(jq -r '.functionApp.name' ../integrated-deployment/deployment-info.json)
func azure functionapp publish "$FUNCTION_APP"
```

### 4. Verify the Integration

```bash
# Return to integrated-deployment directory
cd ../integrated-deployment

# Run verification script
./verify.sh

# The script will:
# 1. Create a test patient "John Doe" in OpenEMR
# 2. Trigger manual sync
# 3. Wait 60 seconds for auto-sync
# 4. Verify patient exists in AHDS FHIR
```

## Features

### Automatic Synchronization

The FHIR Connector includes a timer-triggered function that:
- Runs **every minute** (`autoSync` function)
- Searches for all patients in OpenEMR
- Syncs patients and their observations to AHDS
- Includes retry logic for transient failures
- Logs all operations to Application Insights

### Manual Sync Functions

In addition to automatic sync, you can trigger manual syncs:

```bash
# Get function app details
FUNCTION_APP=$(jq -r '.functionApp.name' deployment-info.json)
RESOURCE_GROUP=$(jq -r '.resourceGroup' deployment-info.json)

# Get function key
FUNCTION_KEY=$(az functionapp keys list \
  --name "$FUNCTION_APP" \
  --resource-group "$RESOURCE_GROUP" \
  --query functionKeys.default \
  --output tsv)

FUNCTION_URL="https://${FUNCTION_APP}.azurewebsites.net"

# Sync a specific patient
curl -X POST "${FUNCTION_URL}/api/syncPatient?code=${FUNCTION_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"patientId": "1"}'

# Sync a specific observation
curl -X POST "${FUNCTION_URL}/api/syncObservation?code=${FUNCTION_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"observationId": "1"}'

# Sync patient with all observations
curl -X POST "${FUNCTION_URL}/api/syncPatientWithObservations?code=${FUNCTION_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"patientId": "1"}'
```

## Deployment Outputs

After successful deployment, you'll receive:

```
OpenEMR:
  URL: http://openemr-xxxxxxxx.eastus.cloudapp.azure.com
  Username: admin
  Password: openEMRonAzure!

Azure Health Data Services:
  FHIR Endpoint: https://ahds-xxxxxxxx-fhir.fhir.azurehealthcareapis.com

FHIR Connector:
  Function App: fhir-connector-xxxxxxxx
  Azure AD App ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

All information is also saved to `deployment-info.json` for later reference.

## Monitoring

### View Function Logs

```bash
# Stream live logs
FUNCTION_APP=$(jq -r '.functionApp.name' deployment-info.json)
RESOURCE_GROUP=$(jq -r '.resourceGroup' deployment-info.json)

az webapp log tail \
  --name "$FUNCTION_APP" \
  --resource-group "$RESOURCE_GROUP"
```

### Application Insights

1. Navigate to Azure Portal
2. Find your Function App
3. Click **Application Insights** in the left menu
4. View:
   - **Live Metrics** - Real-time function executions
   - **Failures** - Errors and exceptions
   - **Performance** - Execution times
   - **Logs** - Query detailed logs

### Check Auto-Sync Status

The `autoSync` function runs every minute. Check its execution:

```bash
# View recent executions
az monitor app-insights query \
  --app $(az functionapp show --name "$FUNCTION_APP" --resource-group "$RESOURCE_GROUP" --query "appInsightsId" -o tsv) \
  --analytics-query "traces | where operation_Name == 'autoSync' | order by timestamp desc | take 10"
```

## Troubleshooting

### Deployment Failures

**Problem**: ARM template deployment fails

**Solutions**:
- Ensure unique resource names (script uses timestamps)
- Check Azure subscription quotas
- Verify you have sufficient permissions
- Review deployment logs in Azure Portal

### OpenEMR Not Accessible

**Problem**: OpenEMR URL returns connection error

**Solutions**:
- Wait a few more minutes (initial setup can take 15-20 minutes)
- Check VM is running: `az vm show --name OpenEMR-VM --resource-group <rg-name>`
- Check NSG rules allow HTTP/HTTPS traffic
- SSH into VM and check Docker containers: `docker ps`

### Function Sync Failures

**Problem**: Sync fails with authentication errors

**Solutions**:
- Verify OpenEMR API client is configured correctly
- Check function app settings have correct credentials
- Ensure FHIR Data Contributor role is assigned
- Wait a few minutes for role assignments to propagate

### Patient Not Found in AHDS

**Problem**: Verification shows patient missing in AHDS

**Solutions**:
- Check function app logs for errors
- Manually trigger sync again
- Verify FHIR endpoint is correct
- Test AHDS connectivity with Azure CLI:
  ```bash
  FHIR_ENDPOINT=$(jq -r '.ahds.fhirEndpoint' deployment-info.json)
  TOKEN=$(az account get-access-token --resource "$FHIR_ENDPOINT" --query accessToken -o tsv)
  curl -X GET "${FHIR_ENDPOINT}/metadata" -H "Authorization: Bearer $TOKEN"
  ```

## Security Considerations

### Production Hardening

For production deployments, consider these enhancements:

1. **Use Managed Identity** instead of client secrets
   ```bash
   # Enable managed identity for function app
   az functionapp identity assign \
     --name "$FUNCTION_APP" \
     --resource-group "$RESOURCE_GROUP"
   
   # Assign FHIR role to managed identity
   PRINCIPAL_ID=$(az functionapp identity show \
     --name "$FUNCTION_APP" \
     --resource-group "$RESOURCE_GROUP" \
     --query principalId -o tsv)
   
   az role assignment create \
     --assignee "$PRINCIPAL_ID" \
     --role "FHIR Data Contributor" \
     --scope "<fhir-resource-id>"
   ```

2. **Store Secrets in Key Vault**
   ```bash
   # Create Key Vault
   az keyvault create \
     --name "openemr-kv-${TIMESTAMP}" \
     --resource-group "$RESOURCE_GROUP"
   
   # Store secrets
   az keyvault secret set \
     --vault-name "openemr-kv-${TIMESTAMP}" \
     --name "openemr-client-secret" \
     --value "$OPENEMR_CLIENT_SECRET"
   ```

3. **Restrict Network Access**
   - Configure NSG to limit OpenEMR access to specific IPs
   - Use Azure Private Link for AHDS
   - Enable function app IP restrictions

4. **Enable Advanced Threat Protection**
   - Enable on AHDS workspace
   - Configure alerts for suspicious activities

5. **Implement Audit Logging**
   - Enable diagnostic settings on all resources
   - Send logs to Log Analytics workspace
   - Set up alerts for critical events

## Cleanup

To remove all deployed resources:

```bash
RESOURCE_GROUP=$(jq -r '.resourceGroup' deployment-info.json)

# Delete the entire resource group
az group delete \
  --name "$RESOURCE_GROUP" \
  --yes \
  --no-wait

# Optionally delete the Azure AD app registration
APP_ID=$(jq -r '.functionApp.appId' deployment-info.json)
az ad app delete --id "$APP_ID"
```

## Architecture

### Resource Topology

```
Resource Group: openemr-fhir-rg-<timestamp>
├── OpenEMR VM
│   ├── Ubuntu 22.04 LTS
│   ├── Docker + Docker Compose
│   ├── OpenEMR Container (7.0.2)
│   └── MySQL Container (MariaDB 10.11)
│
├── Azure Health Data Services
│   ├── AHDS Workspace
│   └── FHIR Service (R4)
│
├── FHIR Connector
│   ├── Function App (Node.js 18)
│   ├── App Service Plan (Consumption)
│   ├── Storage Account
│   └── Application Insights
│
└── Networking
    ├── Virtual Network
    ├── Network Security Group
    └── Public IP Address
```

### Data Flow

1. **Patient Created in OpenEMR**
   - User creates patient via OpenEMR UI or API
   - Patient data stored in MySQL database

2. **Auto-Sync Trigger (Every Minute)**
   - Timer-triggered function executes
   - Authenticates to OpenEMR via OAuth2
   - Searches for all patients (or recent changes)

3. **Data Retrieval**
   - Fetches patient FHIR resources
   - Fetches associated observations

4. **Authentication to AHDS**
   - Obtains Azure AD token
   - Uses FHIR Data Contributor role

5. **Data Upload**
   - POSTs/PUTs patient to AHDS
   - POSTs/PUTs observations to AHDS
   - Handles errors with retry logic

6. **Logging**
   - All operations logged to Application Insights
   - Errors captured with stack traces
   - Metrics tracked for monitoring

## Extending the Solution

### Add More FHIR Resources

To sync additional resource types (Encounter, MedicationRequest, etc.):

1. Add sync methods to `src/sync-service.ts`
2. Create new Azure Function handlers in `functions/`
3. Update `autoSync` function to include new resources

### Implement Incremental Sync

For production efficiency, sync only changed records:

```typescript
// Example: Filter by _lastUpdated
const bundle = await openemrClient.searchFhirResources('Patient', {
  '_lastUpdated': `gt${lastSyncTimestamp}`
});
```

### Add Terminology Mapping

Map OpenEMR codes to standard terminologies:

```typescript
// Example: Map local codes to SNOMED
function mapToStandard(resource: any): any {
  // Implement mapping logic
  return transformedResource;
}
```

## Support

For issues or questions:
- **GitHub Issues**: [matthansen0/azure-openemr/issues](https://github.com/matthansen0/azure-openemr/issues)
- **OpenEMR Documentation**: [https://www.open-emr.org/wiki/](https://www.open-emr.org/wiki/)
- **AHDS Documentation**: [https://docs.microsoft.com/azure/healthcare-apis/](https://docs.microsoft.com/azure/healthcare-apis/)

## License

MIT License - See [LICENSE](../LICENSE) file in repository root
