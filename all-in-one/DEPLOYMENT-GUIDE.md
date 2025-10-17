# OpenEMR Unified Deployment Guide

This guide explains how to deploy OpenEMR with optional FHIR connector and Azure Health Data Services (AHDS) integration using a single "Deploy to Azure" button.

## Overview

The unified deployment template provides:

1. **Base OpenEMR Deployment** (always deployed):
   - Ubuntu 22.04 LTS Virtual Machine
   - Docker and Docker Compose
   - OpenEMR 7.0.2+ container
   - MySQL database container
   - Network resources (VNet, NSG, Public IP)

2. **Optional FHIR Integration** (controlled by `deployFhirConnector` parameter):
   - Azure Health Data Services (AHDS) workspace
   - FHIR R4 service
   - Azure Function App for FHIR connector
   - Storage Account for function app
   - Application Insights for monitoring

## Deployment Options

### Option 1: Deploy OpenEMR Only (Default)

Click the "Deploy to Azure" button and use the default parameters. This will deploy only the OpenEMR VM without FHIR integration.

**Parameters:**
- `deployFhirConnector`: `false` (default)
- Other VM parameters as needed

### Option 2: Deploy OpenEMR with FHIR Connector

Click the "Deploy to Azure" button and set `deployFhirConnector` to `true`. This will deploy OpenEMR VM plus all FHIR integration components.

**Parameters:**
- `deployFhirConnector`: `true`
- Other VM and FHIR parameters as needed

## Deployment Steps

### 1. Initiate Deployment

[![Deploy To Azure](https://raw.githubusercontent.com/Azure/azure-quickstart-templates/master/1-CONTRIBUTION-GUIDE/images/deploytoazure.svg?sanitize=true)](https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fmatthansen0%2Fazure-openemr%2Fmain%2Fall-in-one%2Fazuredeploy.json)

### 2. Configure Parameters

#### Required Parameters (VM Deployment)

- **Resource Group**: Create new or select existing
- **Region**: Azure region for deployment
- **Admin Username**: Username for VM SSH access
- **Authentication Type**: `password` or `sshPublicKey`
- **Admin Password or Key**: Password or SSH public key for authentication
- **DNS Label Prefix**: Unique DNS name for the public IP

#### Optional Parameters (VM)

- **VM Name**: Name of the virtual machine (default: `OpenEMR`)
- **VM Size**: Azure VM size (default: `Standard_D2s_v3`)
- **Branch**: Git branch to deploy from (`main` or `dev`)
- **Ubuntu OS Version**: Ubuntu version (default: `22_04-lts-gen2`)
- **Virtual Network Name**: VNet name (default: `vNet`)
- **Subnet Name**: Subnet name (default: `Subnet`)
- **Network Security Group Name**: NSG name (default: `SecGroupNet`)

#### FHIR Integration Parameters

- **Deploy FHIR Connector**: Set to `true` to enable FHIR integration (default: `false`)
- **FHIR Workspace Name**: Name for AHDS workspace (auto-generated if not specified)
- **FHIR Service Name**: Name for FHIR service (default: `fhir`)
- **Function App Name**: Name for Azure Function App (auto-generated if not specified)
- **Storage Account Type**: Storage redundancy for function app (default: `Standard_LRS`)

### 3. Review and Deploy

1. Review the parameters
2. Click "Review + create"
3. Review the validation results
4. Click "Create" to start deployment

Deployment typically takes 15-20 minutes for VM-only, or 20-30 minutes with FHIR integration.

### 4. Post-Deployment Configuration

#### For VM-Only Deployment

1. Wait for deployment to complete
2. Note the `hostname` output value
3. Access OpenEMR at `http://<hostname>` or `https://<hostname>`
4. Default credentials: `admin/openEMRonAzure!`
5. Change default credentials immediately

#### For Deployment with FHIR Connector

After deployment completes, additional configuration is required to enable FHIR synchronization. There are 5 main configuration steps:

1. **Configure OpenEMR API Client** - Register API credentials in OpenEMR
2. **Configure Azure AD App Registration** - Set up authentication for AHDS
3. **Assign FHIR Data Contributor Role** - Grant permissions to access FHIR service
4. **Configure Function App Settings** - Set environment variables
5. **Deploy Function Code** - Publish the connector code to Azure

Each step is detailed below:

##### Step 1: Configure OpenEMR API Client

**Summary**: Register an API client in OpenEMR to allow the FHIR connector to access OpenEMR's FHIR API.

1. Access OpenEMR web interface
2. Navigate to **Administration** > **System** > **API Clients**
3. Click **Register New API Client**
4. Configure:
   - **Client Name**: FHIR Connector
   - **Grant Type**: Client Credentials
   - **Scope**: `api:fhir`
5. Save and note the **Client ID** and **Client Secret**

##### Step 2: Configure Azure AD App Registration

**Summary**: Create an Azure AD app registration to authenticate the FHIR connector with Azure Health Data Services.

1. Go to **Microsoft Entra ID** in Azure Portal
2. Click **App registrations** > **+ New registration**
3. Configure:
   - **Name**: OpenEMR FHIR Connector
   - **Supported account types**: Single tenant
4. Click **Register**
5. Note the **Application (client) ID** and **Directory (tenant) ID**
6. Create a client secret:
   - Go to **Certificates & secrets** > **+ New client secret**
   - Copy the secret **Value** immediately
7. Configure API permissions:
   - Click **API permissions** > **+ Add a permission**
   - Select **Azure Healthcare APIs**
   - Check **user_impersonation**
   - Click **Grant admin consent**

##### Step 3: Assign FHIR Data Contributor Role

**Summary**: Grant the app registration permission to read and write FHIR data.

1. Navigate to your AHDS FHIR service in Azure Portal
2. Click **Access control (IAM)**
3. Click **+ Add** > **Add role assignment**
4. Select **FHIR Data Contributor** role
5. Select your app registration (OpenEMR FHIR Connector)
6. Click **Review + assign**

##### Step 4: Configure Function App Settings

**Summary**: Set the required environment variables for the FHIR connector to connect to both OpenEMR and AHDS.

1. Navigate to the deployed Function App in Azure Portal
2. Click **Configuration** under Settings
3. Add the following application settings:

```
OPENEMR_BASE_URL=https://<your-openemr-hostname>
OPENEMR_CLIENT_ID=<openemr-client-id-from-step-1>
OPENEMR_CLIENT_SECRET=<openemr-client-secret-from-step-1>
AHDS_FHIR_ENDPOINT=<fhir-service-url-from-deployment-outputs>
AHDS_TENANT_ID=<tenant-id-from-step-2>
AHDS_CLIENT_ID=<app-client-id-from-step-2>
AHDS_CLIENT_SECRET=<app-client-secret-from-step-2>
```

4. Click **Save**

##### Step 5: Deploy Function Code

**Summary**: Build and publish the FHIR connector code to the Azure Function App.

**Note**: The function app name can be found in the deployment outputs or in the Azure Portal under Function Apps.

1. Clone the repository locally (or use your fork):
   ```bash
   git clone https://github.com/matthansen0/azure-openemr.git
   cd azure-openemr/fhir-connector
   ```

2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```

3. Publish to Azure (replace `<function-app-name>` with your Function App name from deployment outputs):
   ```bash
   func azure functionapp publish <function-app-name>
   ```

4. Verify deployment (this will test the sync-patient endpoint with a sample patient ID):
   ```bash
   curl -X POST "https://<function-app-name>.azurewebsites.net/api/sync-patient" \
     -H "Content-Type: application/json" \
     -d '{"patientId": "1"}'
   ```
   
   Expected response: A success message indicating the patient was synced, or an error if patient ID 1 doesn't exist in OpenEMR.

## Deployment Outputs

After successful deployment, the following outputs are available:

### VM Deployment Outputs

- **adminUsername**: The VM admin username
- **hostname**: The fully qualified domain name (FQDN) of the VM
- **sshCommand**: SSH command to connect to the VM

### FHIR Integration Outputs (when deployed)

- **fhirServiceUrl**: The FHIR service endpoint URL
- **functionAppName**: The name of the deployed Function App
- **functionAppUrl**: The URL of the Function App

## Troubleshooting

### VM Deployment Issues

**Issue**: Deployment fails with VM name conflict
- **Solution**: Use a unique `vmName` parameter or deploy to a different resource group

**Issue**: Cannot access OpenEMR web interface
- **Solution**: Wait for the installation script to complete (check VM extension status)

### FHIR Integration Issues

**Issue**: Function App deployment fails
- **Solution**: Ensure unique `functionAppName` or use auto-generated name

**Issue**: FHIR authentication fails
- **Solution**: Verify Azure AD app registration settings and role assignments

**Issue**: Cannot sync data to FHIR service
- **Solution**: Check Function App configuration settings and verify OpenEMR API credentials

## Security Considerations

### VM Security

1. **Change default OpenEMR credentials** immediately after deployment
2. **Remove public IP** if not needed for external access
3. **Configure Network Security Group** rules to restrict access
4. **Enable Azure Disk Encryption** for data at rest
5. **Implement backup strategy** for VM and data

### FHIR Security

1. **Use Managed Identity** instead of client secrets (production)
2. **Store secrets in Azure Key Vault**
3. **Enable Application Insights** for monitoring
4. **Implement IP restrictions** on Function App
5. **Enable Advanced Threat Protection** on AHDS
6. **Regular credential rotation**
7. **Audit logs and access reviews**

## Cost Considerations

### VM-Only Deployment (approximate monthly costs)

- **VM (Standard_D2s_v3)**: ~$100/month
- **Storage (Standard LRS)**: ~$10/month
- **Bandwidth**: Variable based on usage
- **Public IP**: ~$4/month

**Estimated Total**: ~$115-150/month

### With FHIR Integration (additional costs)

- **Azure Health Data Services**: Pay-per-use (~$0.25-1.00 per GB stored)
- **Function App (Consumption)**: Pay-per-execution (~$0.20 per million executions)
- **Storage Account**: ~$5/month
- **Application Insights**: ~$2-10/month

**Estimated Additional**: ~$10-50/month depending on usage

## Next Steps

1. **Review the OpenEMR documentation**: https://www.open-emr.org/wiki/
2. **Configure OpenEMR settings** according to your requirements
3. **Set up backups** for VM and database
4. **Review FHIR Connector documentation**: [fhir-connector/README.md](../fhir-connector/README.md)
5. **Implement production security best practices**
6. **Set up monitoring and alerts**

## Additional Resources

- [OpenEMR Official Documentation](https://www.open-emr.org/wiki/)
- [Azure Health Data Services Documentation](https://docs.microsoft.com/azure/healthcare-apis/)
- [FHIR Connector README](../fhir-connector/README.md)
- [FHIR Connector Deployment Guide](../fhir-connector/deployment/README.md)
- [GitHub Repository](https://github.com/matthansen0/azure-openemr)

## Support

For issues or questions:
- Open an issue on [GitHub](https://github.com/matthansen0/azure-openemr/issues)
- Review existing documentation and guides
- Check Azure service health status

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.
