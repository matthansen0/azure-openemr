# Deployment Guide

This guide provides step-by-step instructions for deploying the OpenEMR FHIR Connector to Azure.

## Prerequisites

- Azure subscription with permissions to create resources
- Azure CLI installed and configured
- OpenEMR instance deployed and accessible
- Basic understanding of Azure Resource Manager (ARM) templates

## Deployment Steps

### 1. Provision Azure Health Data Services (AHDS)

First, deploy the AHDS workspace and FHIR service:

```bash
# Set variables
RESOURCE_GROUP="openemr-fhir-rg"
LOCATION="eastus"
WORKSPACE_NAME="openemr-ahds-workspace"
FHIR_SERVICE_NAME="fhir"

# Create resource group
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION

# Deploy AHDS
az deployment group create \
  --resource-group $RESOURCE_GROUP \
  --template-file ahds.json \
  --parameters ahds.parameters.json \
  --parameters workspaceName=$WORKSPACE_NAME fhirServiceName=$FHIR_SERVICE_NAME

# Get FHIR endpoint URL
FHIR_ENDPOINT=$(az deployment group show \
  --resource-group $RESOURCE_GROUP \
  --name ahds \
  --query properties.outputs.fhirServiceUrl.value \
  --output tsv)

echo "FHIR Endpoint: $FHIR_ENDPOINT"
```

### 2. Configure Azure AD (Entra ID) App Registration

Create an app registration for the connector. You can use either Azure CLI or the Azure Portal.

#### Using Azure CLI

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

echo "App ID (AHDS_CLIENT_ID): $APP_ID"
echo "Client Secret (AHDS_CLIENT_SECRET): $CLIENT_SECRET"
echo "Tenant ID (AHDS_TENANT_ID): $TENANT_ID"
```

#### Using Azure Portal

1. Go to **Microsoft Entra ID** (formerly Azure Active Directory)
2. Click **App registrations** → **+ New registration**
3. Enter name: `openemr-fhir-connector`
4. Select **Accounts in this organizational directory only**
5. Click **Register**
6. From the Overview page, copy:
   - **Application (client) ID** → This is your `AHDS_CLIENT_ID`
   - **Directory (tenant) ID** → This is your `AHDS_TENANT_ID`
7. Go to **Certificates & secrets** → **+ New client secret**
8. Add description and expiration, click **Add**
9. **Copy the secret Value immediately** → This is your `AHDS_CLIENT_SECRET` (cannot be viewed again)

**Save all three values - you'll need them in step 5.**

### 3. Grant FHIR Permissions

Assign the necessary permissions to the service principal:

```bash
# Get FHIR service resource ID
FHIR_RESOURCE_ID=$(az healthcareapis workspace fhir-service show \
  --resource-group $RESOURCE_GROUP \
  --workspace-name $WORKSPACE_NAME \
  --fhir-service-name $FHIR_SERVICE_NAME \
  --query id \
  --output tsv)

# Assign FHIR Data Contributor role
az role assignment create \
  --assignee $APP_ID \
  --role "FHIR Data Contributor" \
  --scope $FHIR_RESOURCE_ID
```

### 4. Deploy Azure Function App

Deploy the function app infrastructure:

```bash
FUNCTION_APP_NAME="openemr-fhir-connector-${RANDOM}"

az deployment group create \
  --resource-group $RESOURCE_GROUP \
  --template-file function-app.json \
  --parameters function-app.parameters.json \
  --parameters functionAppName=$FUNCTION_APP_NAME

echo "Function App Name: $FUNCTION_APP_NAME"
```

### 5. Configure Application Settings

Set the required environment variables for the function app:

```bash
az functionapp config appsettings set \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    OPENEMR_BASE_URL="https://your-openemr-instance.com" \
    OPENEMR_CLIENT_ID="your-openemr-client-id" \
    OPENEMR_CLIENT_SECRET="your-openemr-client-secret" \
    AHDS_FHIR_ENDPOINT="$FHIR_ENDPOINT" \
    AHDS_TENANT_ID="$TENANT_ID" \
    AHDS_CLIENT_ID="$APP_ID" \
    AHDS_CLIENT_SECRET="$CLIENT_SECRET"
```

**Note**: Replace the OpenEMR values with your actual OpenEMR instance details.

### 6. Build and Publish Function Code

Build the TypeScript code and publish to Azure:

```bash
# Navigate to fhir-connector directory
cd ..

# Install dependencies
npm install

# Build TypeScript
npm run build

# Publish to Azure
func azure functionapp publish $FUNCTION_APP_NAME
```

### 7. Verify Deployment

Test the deployment:

```bash
# Get function app URL
FUNCTION_URL=$(az functionapp show \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query defaultHostName \
  --output tsv)

# Get function key (for authentication)
FUNCTION_KEY=$(az functionapp keys list \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query functionKeys.default \
  --output tsv)

echo "Function URL: https://$FUNCTION_URL"
echo "Function Key: $FUNCTION_KEY"

# Test the sync-patient function
curl -X POST "https://$FUNCTION_URL/api/sync-patient?code=$FUNCTION_KEY" \
  -H "Content-Type: application/json" \
  -d '{"patientId": "1"}'
```

## Post-Deployment Configuration

### Enable Managed Identity (Production)

For production deployments, use managed identity instead of client secrets:

```bash
# Enable system-assigned managed identity
az functionapp identity assign \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP

# Get the managed identity principal ID
PRINCIPAL_ID=$(az functionapp identity show \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query principalId \
  --output tsv)

# Assign FHIR Data Contributor role to managed identity
az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role "FHIR Data Contributor" \
  --scope $FHIR_RESOURCE_ID

# Update application settings to use managed identity
az functionapp config appsettings delete \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --setting-names AHDS_CLIENT_SECRET
```

Update the code to use `DefaultAzureCredential` when `AHDS_CLIENT_SECRET` is not present.

### Configure Key Vault Integration

For enhanced security, store secrets in Azure Key Vault:

```bash
# Create Key Vault
KEY_VAULT_NAME="openemr-kv-${RANDOM}"
az keyvault create \
  --name $KEY_VAULT_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

# Store secrets
az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name "openemr-client-secret" \
  --value "$OPENEMR_CLIENT_SECRET"

az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name "ahds-client-secret" \
  --value "$CLIENT_SECRET"

# Grant function app access to Key Vault
az keyvault set-policy \
  --name $KEY_VAULT_NAME \
  --object-id $PRINCIPAL_ID \
  --secret-permissions get list

# Update app settings to reference Key Vault
az functionapp config appsettings set \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    OPENEMR_CLIENT_SECRET="@Microsoft.KeyVault(SecretUri=https://${KEY_VAULT_NAME}.vault.azure.net/secrets/openemr-client-secret/)" \
    AHDS_CLIENT_SECRET="@Microsoft.KeyVault(SecretUri=https://${KEY_VAULT_NAME}.vault.azure.net/secrets/ahds-client-secret/)"
```

## Monitoring and Diagnostics

### Enable Application Insights

Application Insights is automatically configured during deployment. View logs and metrics:

```bash
# Get Application Insights instrumentation key
APP_INSIGHTS_KEY=$(az monitor app-insights component show \
  --app $FUNCTION_APP_NAME-insights \
  --resource-group $RESOURCE_GROUP \
  --query instrumentationKey \
  --output tsv)

echo "Application Insights Key: $APP_INSIGHTS_KEY"
```

Access Application Insights in Azure Portal:
1. Navigate to the Function App
2. Click **Application Insights** in the left menu
3. View **Live Metrics**, **Failures**, **Performance**, and **Logs**

### View Function Logs

Stream function logs in real-time:

```bash
az webapp log tail \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP
```

## Troubleshooting

### Common Deployment Issues

**Issue: ARM template deployment fails**
- Check resource naming conflicts (names must be unique)
- Verify subscription has sufficient quota
- Review deployment operation details in Azure Portal

**Issue: Function app fails to start**
- Verify all required application settings are configured
- Check storage account connection string is valid
- Review function app logs for error messages

**Issue: FHIR permissions denied**
- Verify service principal has FHIR Data Contributor role
- Wait a few minutes for role assignment to propagate
- Check app registration has correct tenant ID

## Cleanup

To remove all deployed resources:

```bash
az group delete \
  --name $RESOURCE_GROUP \
  --yes \
  --no-wait
```

## Next Steps

- Configure OpenEMR API client (see main README)
- Test synchronization with sample data
- Set up monitoring alerts
- Implement production security best practices
- Extend connector for additional FHIR resources

## Support

For deployment issues:
- Review Azure deployment logs in Portal
- Check Application Insights for runtime errors
- Consult Azure Health Data Services documentation
- Open an issue on GitHub
