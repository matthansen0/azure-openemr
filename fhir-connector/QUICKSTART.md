# Quick Start Guide

This guide will help you get the OpenEMR FHIR Connector up and running quickly for testing and development.

## Prerequisites Checklist

Before you begin, ensure you have:

- [ ] OpenEMR 7.0.2+ deployed and accessible
- [ ] Azure subscription with permissions to create resources
- [ ] Node.js 18.x or later installed
- [ ] Azure CLI installed and configured
- [ ] Basic understanding of FHIR and Azure services

## Step 1: Deploy OpenEMR (if not already done)

If you don't have OpenEMR running yet, use the all-in-one deployment:

```bash
# Clone this repository
git clone https://github.com/matthansen0/azure-openemr.git
cd azure-openemr

# Deploy using the Azure Portal button in the main README
# Or use Azure CLI:
az group create --name openemr-rg --location eastus
az deployment group create \
  --resource-group openemr-rg \
  --template-file all-in-one/azuredeploy.json \
  --parameters all-in-one/azuredeploy.parameters.json
```

Wait for deployment to complete (approximately 15 minutes).

## Step 2: Configure OpenEMR for FHIR

1. **Access OpenEMR Admin Panel**
   - Navigate to your OpenEMR URL
   - Login with credentials: `admin / openEMRonAzure!` (or your custom credentials)

2. **Enable FHIR API**
   - Go to **Administration** → **Globals** → **Connectors**
   - Enable **Enable OpenEMR Patient FHIR API**
   - Enable **Enable OpenEMR FHIR API**
   - Click **Save**

3. **Register API Client**
   - Go to **Administration** → **System** → **API Clients**
   - Click **Register New API Client**
   - Fill in:
     - **Client Name**: `FHIR Connector`
     - **Redirect URI**: Leave blank (not needed for client credentials)
     - **Grant Type**: Select `Client Credentials`
     - **Scope**: Check `api:fhir`
   - Click **Register**
   - **IMPORTANT**: Save the **Client ID** and **Client Secret** - you'll need them later

4. **Verify FHIR API**
   ```bash
   # Test the FHIR metadata endpoint (should return JSON)
   curl https://your-openemr-url.com/apis/default/fhir/metadata
   ```

## Step 3: Deploy Azure Health Data Services

```bash
# Set variables
RESOURCE_GROUP="fhir-connector-rg"
LOCATION="eastus"
WORKSPACE_NAME="openemr-ahds-$(date +%s)"
FHIR_SERVICE_NAME="fhir"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Deploy AHDS
cd fhir-connector/deployment
az deployment group create \
  --resource-group $RESOURCE_GROUP \
  --template-file ahds.json \
  --parameters ahds.parameters.json \
  --parameters workspaceName=$WORKSPACE_NAME

# Get the FHIR endpoint (save this)
az deployment group show \
  --resource-group $RESOURCE_GROUP \
  --name ahds \
  --query properties.outputs.fhirServiceUrl.value
```

## Step 4: Configure Azure AD (Entra ID) Authentication

You can configure authentication using either Azure CLI (faster) or Azure Portal (more visual).

### Option A: Using Azure CLI (Recommended for Automation)

```bash
# Create app registration
APP_NAME="openemr-fhir-connector"
APP_ID=$(az ad app create \
  --display-name $APP_NAME \
  --query appId \
  --output tsv)

# Create service principal
az ad sp create --id $APP_ID

# Create client secret
CLIENT_SECRET=$(az ad app credential reset \
  --id $APP_ID \
  --query password \
  --output tsv)

# Get tenant ID
TENANT_ID=$(az account show --query tenantId --output tsv)

# Save these values!
echo "Azure AD App ID: $APP_ID"
echo "Azure AD Client Secret: $CLIENT_SECRET"
echo "Azure AD Tenant ID: $TENANT_ID"

# Assign FHIR permissions
FHIR_RESOURCE_ID=$(az healthcareapis workspace fhir-service show \
  --resource-group $RESOURCE_GROUP \
  --workspace-name $WORKSPACE_NAME \
  --fhir-service-name $FHIR_SERVICE_NAME \
  --query id \
  --output tsv)

az role assignment create \
  --assignee $APP_ID \
  --role "FHIR Data Contributor" \
  --scope $FHIR_RESOURCE_ID
```

### Option B: Using Azure Portal (Step-by-Step GUI)

If you prefer using the Azure Portal interface:

1. **Open Azure Portal and Navigate to Entra ID**
   - Go to https://portal.azure.com
   - Search for "Microsoft Entra ID" (or "Azure Active Directory") in the top search bar
   - Click on the service

2. **Create App Registration**
   - Click **App registrations** in the left sidebar
   - Click **+ New registration** at the top
   - Fill in:
     - Name: `openemr-fhir-connector`
     - Supported account types: **Accounts in this organizational directory only**
     - Redirect URI: Leave blank
   - Click **Register**

3. **Copy Application and Tenant IDs**
   - You'll be taken to the app's Overview page
   - Copy these values (you'll need them later):
     - **Application (client) ID** → Save as `AHDS_CLIENT_ID`
     - **Directory (tenant) ID** → Save as `AHDS_TENANT_ID`

4. **Create Client Secret**
   - In the left menu, click **Certificates & secrets**
   - Click **Client secrets** tab
   - Click **+ New client secret**
   - Description: `FHIR Connector Secret`
   - Expires: Select appropriate duration (e.g., 24 months)
   - Click **Add**
   - **⚠️ IMPORTANT**: Copy the **Value** field immediately → Save as `AHDS_CLIENT_SECRET`
   - This value is only shown once and cannot be retrieved later!

5. **Add API Permissions** (Skip if using managed identity)
   - Click **API permissions** in the left menu
   - Click **+ Add a permission**
   - Select **APIs my organization uses** tab
   - Search for and select **Azure Healthcare APIs**
   - Select **Delegated permissions**
   - Check **user_impersonation**
   - Click **Add permissions**
   - Click **✓ Grant admin consent for [YourTenant]** (requires admin role)

6. **Assign FHIR Data Contributor Role**
   - Navigate to **Azure Health Data Services** in the portal
   - Select your workspace, then your FHIR service
   - Click **Access control (IAM)**
   - Click **+ Add** → **Add role assignment**
   - On the Role tab, select **FHIR Data Contributor**
   - Click **Next**
   - Click **+ Select members**
   - Search for `openemr-fhir-connector`
   - Select it and click **Select**
   - Click **Review + assign**

**You should now have these three values:**
- `AHDS_TENANT_ID`: Directory (tenant) ID from step 3
- `AHDS_CLIENT_ID`: Application (client) ID from step 3
- `AHDS_CLIENT_SECRET`: Secret value from step 4

## Step 5: Configure Local Development Environment

```bash
cd fhir-connector

# Copy the example environment file
cp .env.example .env

# Edit .env with your values
nano .env  # or use your favorite editor
```

Update the values in `.env`:
```env
OPENEMR_BASE_URL=https://your-openemr-url.com
OPENEMR_CLIENT_ID=<from Step 2>
OPENEMR_CLIENT_SECRET=<from Step 2>

AHDS_FHIR_ENDPOINT=<from Step 3>
AHDS_TENANT_ID=<from Step 4>
AHDS_CLIENT_ID=<from Step 4>
AHDS_CLIENT_SECRET=<from Step 4>
```

## Step 6: Install and Build

```bash
# Install dependencies
npm install

# Build TypeScript code
npm run build
```

## Step 7: Test Locally (Optional)

If you have Azure Functions Core Tools installed:

```bash
# Start the function app locally
npm start

# In another terminal, test the sync
curl -X POST http://localhost:7071/api/sync-patient \
  -H "Content-Type: application/json" \
  -d '{"patientId": "1"}'
```

## Step 8: Deploy to Azure

```bash
# Deploy function app infrastructure
FUNCTION_APP_NAME="openemr-fhir-conn-$(date +%s)"

az deployment group create \
  --resource-group $RESOURCE_GROUP \
  --template-file deployment/function-app.json \
  --parameters deployment/function-app.parameters.json \
  --parameters functionAppName=$FUNCTION_APP_NAME

# Configure application settings
az functionapp config appsettings set \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings @<(cat <<EOF
[
  {"name": "OPENEMR_BASE_URL", "value": "$OPENEMR_BASE_URL"},
  {"name": "OPENEMR_CLIENT_ID", "value": "$OPENEMR_CLIENT_ID"},
  {"name": "OPENEMR_CLIENT_SECRET", "value": "$OPENEMR_CLIENT_SECRET"},
  {"name": "AHDS_FHIR_ENDPOINT", "value": "$AHDS_FHIR_ENDPOINT"},
  {"name": "AHDS_TENANT_ID", "value": "$TENANT_ID"},
  {"name": "AHDS_CLIENT_ID", "value": "$APP_ID"},
  {"name": "AHDS_CLIENT_SECRET", "value": "$CLIENT_SECRET"}
]
EOF
)

# Publish function code (requires Azure Functions Core Tools)
func azure functionapp publish $FUNCTION_APP_NAME
```

## Step 9: Test the Connector

```bash
# Get function URL and key
FUNCTION_URL=$(az functionapp show \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query defaultHostName \
  --output tsv)

FUNCTION_KEY=$(az functionapp keys list \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query functionKeys.default \
  --output tsv)

# Test sync patient
curl -X POST "https://$FUNCTION_URL/api/sync-patient?code=$FUNCTION_KEY" \
  -H "Content-Type: application/json" \
  -d '{"patientId": "1"}'

# Test sync patient with observations
curl -X POST "https://$FUNCTION_URL/api/sync-patient-with-observations?code=$FUNCTION_KEY" \
  -H "Content-Type: application/json" \
  -d '{"patientId": "1"}'
```

## Step 10: Verify in Azure Portal

1. **Check Function Logs**
   - Navigate to Azure Portal → Function App
   - Go to **Functions** → **syncPatient** → **Monitor**
   - View execution logs

2. **Check AHDS FHIR Data**
   - Navigate to Azure Portal → Health Data Services workspace
   - Go to FHIR service
   - Use the built-in FHIR explorer or query via API:
   ```bash
   # Get access token
   TOKEN=$(az account get-access-token \
     --resource=$AHDS_FHIR_ENDPOINT \
     --query accessToken \
     --output tsv)
   
   # Query patients
   curl -X GET "$AHDS_FHIR_ENDPOINT/Patient" \
     -H "Authorization: Bearer $TOKEN"
   ```

3. **Check Application Insights**
   - Navigate to Application Insights resource
   - View **Live Metrics**, **Failures**, **Performance**

## Common Issues

### OpenEMR FHIR API Not Accessible
- Verify FHIR is enabled in OpenEMR Globals
- Check OpenEMR URL is accessible from Azure
- Ensure API client credentials are correct

### Azure AD Authentication Failed
- Verify tenant ID, client ID, and client secret
- Wait a few minutes for role assignments to propagate
- Check service principal has FHIR Data Contributor role

### Patient/Observation Not Found
- Login to OpenEMR and add sample patients/observations
- Use correct patient/observation IDs
- Verify data exists in OpenEMR database

## Next Steps

Now that you have the connector working:

1. **Add Sample Data** in OpenEMR
   - Create test patients
   - Add observations, encounters, medications

2. **Explore Additional Functions**
   - Try `syncObservation` endpoint
   - Test `syncPatientWithObservations` for bulk sync

3. **Set Up Monitoring**
   - Configure Application Insights alerts
   - Set up dashboards in Azure Portal

4. **Production Hardening**
   - Implement managed identity (see deployment README)
   - Configure Key Vault for secrets
   - Enable advanced threat protection
   - Set up backup and disaster recovery

5. **Extend the Connector**
   - Add support for more FHIR resources (Encounter, MedicationRequest, etc.)
   - Implement incremental sync
   - Add terminology mapping

## Resources

- [Full README](README.md)
- [Deployment Guide](deployment/README.md)
- [OpenEMR Documentation](https://www.open-emr.org/wiki/)
- [Azure Health Data Services Documentation](https://docs.microsoft.com/azure/healthcare-apis/)
- [FHIR R4 Specification](https://hl7.org/fhir/R4/)

## Getting Help

- Open an issue on GitHub
- Review Application Insights logs for detailed errors
- Check Azure Function execution history
- Consult OpenEMR and AHDS documentation

## Cleanup

To remove all resources when done testing:

```bash
# Delete the resource group (removes all resources)
az group delete --name $RESOURCE_GROUP --yes --no-wait
```
