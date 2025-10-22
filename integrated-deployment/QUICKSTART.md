# Quick Start: Deploy Complete OpenEMR + FHIR Integration

This guide provides the fastest path to deploying a complete OpenEMR + Azure Health Data Services + FHIR Connector solution.

## Option 1: One-Click Deploy to Azure (Simplest)

[![Deploy To Azure](https://raw.githubusercontent.com/Azure/azure-quickstart-templates/master/1-CONTRIBUTION-GUIDE/images/deploytoazure.svg?sanitize=true)](https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fmatthansen0%2Fazure-openemr%2Fcopilot%2Fintegrate-openemr-fhir-api-again%2Fintegrated-deployment%2Fazuredeploy.json)

**Note**: This button deploys from the `copilot/integrate-openemr-fhir-api-again` branch. Once merged to main, update the URL to use `main` branch.

### What Gets Deployed

- ✅ OpenEMR 7.0.2 on Azure VM
- ✅ Azure Health Data Services (FHIR R4)  
- ✅ FHIR Connector Azure Function (with auto-sync every minute)
- ✅ All networking and security infrastructure

### After Deployment

1. **Configure OpenEMR API Client** (5 minutes)
   - Access OpenEMR at the URL shown in deployment outputs
   - Login with `admin / openEMRonAzure!`
   - Go to Administration > System > API Clients
   - Register new client with client credentials grant and `api:fhir` scope
   - Save the client ID and secret

2. **Update Function App Settings**
   ```bash
   az functionapp config appsettings set \
     --name <function-app-name> \
     --resource-group <resource-group-name> \
     --settings \
       OPENEMR_CLIENT_ID="<your-client-id>" \
       OPENEMR_CLIENT_SECRET="<your-client-secret>"
   ```

3. **Deploy Function Code**
   ```bash
   cd fhir-connector
   npm install && npm run build
   func azure functionapp publish <function-app-name>
   ```

4. **Verify Integration**
   ```bash
   cd ../integrated-deployment
   ./verify.sh deployment-info.json
   ```

## Option 2: Automated Script Deploy (Recommended for Dev/Test)

### Prerequisites
- Azure CLI installed and logged in
- jq installed for JSON parsing
- Bash shell (Linux, macOS, or WSL on Windows)

### Steps

```bash
# Clone repository
git clone https://github.com/matthansen0/azure-openemr.git
cd azure-openemr

# Checkout the feature branch (until merged to main)
git checkout copilot/integrate-openemr-fhir-api-again

# Run deployment script
cd integrated-deployment
./deploy.sh

# Follow the prompts to provide VM credentials
# Wait ~20 minutes for deployment to complete

# Configure OpenEMR API client (see manual steps in output)

# Deploy function code
cd ../fhir-connector
npm install && npm run build
func azure functionapp publish <function-app-name-from-output>

# Run verification
cd ../integrated-deployment
./verify.sh
```

## Option 3: Manual Step-by-Step (Full Control)

See the [full deployment guide](README.md) for detailed step-by-step instructions.

## What Happens After Deployment?

### Automatic Synchronization

The FHIR Connector runs automatically every minute:
- Searches for all patients in OpenEMR
- Syncs patients to AHDS FHIR
- Syncs all observations for each patient
- Logs all operations to Application Insights

### Manual Sync

You can also trigger manual syncs:

```bash
# Get function URL and key
FUNCTION_APP="<your-function-app-name>"
RESOURCE_GROUP="<your-resource-group>"

FUNCTION_KEY=$(az functionapp keys list \
  --name "$FUNCTION_APP" \
  --resource-group "$RESOURCE_GROUP" \
  --query functionKeys.default -o tsv)

FUNCTION_URL="https://${FUNCTION_APP}.azurewebsites.net"

# Sync specific patient
curl -X POST "${FUNCTION_URL}/api/syncPatient?code=${FUNCTION_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"patientId": "1"}'
```

## Verification

The verification script:
1. Creates a test patient "John Doe" in OpenEMR
2. Creates a test observation (body weight)
3. Triggers manual sync
4. Waits 60 seconds for auto-sync
5. Verifies patient exists in AHDS FHIR

Expected output:
```
[SUCCESS] =========================================
[SUCCESS] VERIFICATION PASSED!
[SUCCESS] =========================================
[SUCCESS] Patient 'John Doe' was successfully:
[SUCCESS]   1. Created in OpenEMR (Patient/1)
[SUCCESS]   2. Synced via FHIR Connector
[SUCCESS]   3. Verified in AHDS FHIR
[SUCCESS] Found 1 patient(s) in AHDS
[SUCCESS] =========================================
```

## Monitoring

### View Live Logs

```bash
az webapp log tail \
  --name <function-app-name> \
  --resource-group <resource-group-name>
```

### Application Insights

1. Go to Azure Portal
2. Navigate to your Function App
3. Click "Application Insights"
4. View:
   - Live Metrics (real-time execution)
   - Failures (errors and exceptions)
   - Performance (execution times)
   - Logs (detailed traces)

## Troubleshooting

### Common Issues

**Issue**: OpenEMR not accessible
- Wait longer (initial setup can take 15-20 minutes)
- Check VM is running
- Verify NSG allows HTTP/HTTPS traffic

**Issue**: Function sync fails
- Verify OpenEMR API client is configured
- Check function app settings are correct
- Ensure FHIR Data Contributor role is assigned
- Wait a few minutes for role assignments to propagate

**Issue**: Patient not found in AHDS
- Check function logs for errors
- Manually trigger sync
- Verify FHIR endpoint connectivity

### Getting Help

- Review detailed [deployment guide](README.md)
- Check [FHIR connector documentation](../fhir-connector/README.md)
- Review Application Insights logs
- Open an issue on GitHub

## Cleanup

To remove all resources:

```bash
az group delete --name <resource-group-name> --yes --no-wait
```

## Next Steps

- Add more FHIR resource types (Encounter, Medication, etc.)
- Implement incremental sync based on last updated timestamp
- Add terminology mapping for standard codes
- Enable managed identity for enhanced security
- Store secrets in Azure Key Vault
- Configure alerts and monitoring dashboards

## Architecture

```
┌─────────────────┐         ┌──────────────────────┐         ┌─────────────────┐
│   OpenEMR VM    │         │  Azure Function App  │         │      AHDS       │
│                 │         │                      │         │                 │
│  - OpenEMR 7.0.2│ ──────> │  FHIR Connector      │ ──────> │  FHIR Service   │
│  - MySQL DB     │ OAuth2  │  - syncPatient       │ Azure   │  (R4)           │
│  - FHIR API     │         │  - syncObservation   │ AD      │                 │
│                 │         │  - autoSync (1 min)  │         │                 │
└─────────────────┘         └──────────────────────┘         └─────────────────┘
         │                             │                             │
         │                             │                             │
         └─────────────────────────────┴─────────────────────────────┘
                        All deployed in single Resource Group
```

## Support

- **Documentation**: See [README.md](README.md) for detailed docs
- **Issues**: [GitHub Issues](https://github.com/matthansen0/azure-openemr/issues)
- **OpenEMR**: [https://www.open-emr.org/](https://www.open-emr.org/)
- **AHDS**: [https://docs.microsoft.com/azure/healthcare-apis/](https://docs.microsoft.com/azure/healthcare-apis/)
