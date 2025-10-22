# Deployment Checklist

Use this checklist to ensure successful deployment of the OpenEMR + AHDS + FHIR Connector solution.

## Pre-Deployment

- [ ] **Azure Subscription Ready**
  - Have an active Azure subscription
  - Sufficient permissions to create resources
  - Can create Azure AD app registrations
  - Can assign RBAC roles

- [ ] **Tools Installed**
  - [ ] Azure CLI (`az --version`)
  - [ ] jq (`jq --version`)
  - [ ] Node.js 18+ (`node --version`)
  - [ ] Azure Functions Core Tools (`func --version`)
  - [ ] Git (`git --version`)

- [ ] **Logged into Azure**
  ```bash
  az login
  az account show  # Verify correct subscription
  ```

## Deployment Steps

### Option A: Automated Script

- [ ] **1. Clone Repository**
  ```bash
  git clone https://github.com/matthansen0/azure-openemr.git
  cd azure-openemr
  git checkout copilot/integrate-openemr-fhir-api-again
  ```

- [ ] **2. Run Deployment Script**
  ```bash
  cd integrated-deployment
  ./deploy.sh
  ```
  - Provide VM admin username when prompted
  - Provide VM admin password when prompted
  - Wait ~20 minutes for deployment

- [ ] **3. Save Deployment Information**
  - Deployment info saved to `deployment-info.json`
  - Note the OpenEMR URL
  - Note the AHDS FHIR endpoint
  - Note the Function App name

### Option B: Deploy to Azure Button

- [ ] **1. Click Deploy Button**
  - See [QUICKSTART.md](QUICKSTART.md)
  - Fill in required parameters
  - Wait for deployment to complete

- [ ] **2. Note Outputs**
  - OpenEMR URL
  - FHIR Service URL
  - Function App name

## Post-Deployment Configuration

- [ ] **1. Access OpenEMR**
  - Navigate to OpenEMR URL from deployment
  - Login: `admin / openEMRonAzure!`
  - Verify OpenEMR is accessible

- [ ] **2. Enable FHIR API**
  - [ ] Go to **Administration** → **Globals** → **Connectors**
  - [ ] Enable **"Enable OpenEMR Patient FHIR API"**
  - [ ] Enable **"Enable OpenEMR FHIR API"**
  - [ ] Click **Save**

- [ ] **3. Register API Client**
  - [ ] Go to **Administration** → **System** → **API Clients**
  - [ ] Click **"Register New API Client"**
  - [ ] Set **Client Name**: `FHIR Connector`
  - [ ] Set **Grant Type**: `Client Credentials`
  - [ ] Check **Scope**: `api:fhir`
  - [ ] Click **Register**
  - [ ] **IMPORTANT**: Copy Client ID
  - [ ] **IMPORTANT**: Copy Client Secret (shown only once!)

- [ ] **4. Update Function App Settings**
  ```bash
  # Load deployment info
  RESOURCE_GROUP=$(jq -r '.resourceGroup' deployment-info.json)
  FUNCTION_APP=$(jq -r '.functionApp.name' deployment-info.json)
  
  # Update settings with your actual values
  az functionapp config appsettings set \
    --name "$FUNCTION_APP" \
    --resource-group "$RESOURCE_GROUP" \
    --settings \
      OPENEMR_CLIENT_ID="<paste-client-id>" \
      OPENEMR_CLIENT_SECRET="<paste-client-secret>"
  ```

- [ ] **5. Deploy Function Code**
  ```bash
  cd ../fhir-connector
  npm install
  npm run build
  
  # Get function app name from deployment
  FUNCTION_APP=$(jq -r '.functionApp.name' ../integrated-deployment/deployment-info.json)
  
  # Publish
  func azure functionapp publish "$FUNCTION_APP"
  ```
  - Verify no errors during publish
  - Note the function URLs

## Verification

- [ ] **1. Run Verification Script**
  ```bash
  cd ../integrated-deployment
  ./verify.sh
  ```

- [ ] **2. Expected Results**
  - [ ] Script creates patient "John Doe"
  - [ ] Script creates test observation
  - [ ] Manual sync triggered successfully
  - [ ] Wait 60 seconds for auto-sync
  - [ ] Patient found in AHDS FHIR
  - [ ] Verification PASSED message displayed

- [ ] **3. Verify in Azure Portal**
  - [ ] Navigate to Function App
  - [ ] Go to **Functions** → **autoSync** → **Monitor**
  - [ ] See successful executions every minute
  - [ ] No errors in logs

## Monitoring Setup

- [ ] **Configure Application Insights**
  - [ ] Navigate to Function App → **Application Insights**
  - [ ] View **Live Metrics** - should show activity every minute
  - [ ] Check **Failures** - should be empty or minimal
  - [ ] Review **Performance** - check average execution time

- [ ] **Set Up Alerts (Optional)**
  - [ ] Create alert for sync failures
  - [ ] Create alert for high error rate
  - [ ] Create alert for authentication failures

## Testing

- [ ] **Create Test Patient in OpenEMR**
  - [ ] Login to OpenEMR
  - [ ] Create a new patient
  - [ ] Add some observations (vitals, lab results)

- [ ] **Verify Sync**
  - [ ] Wait 1-2 minutes for auto-sync
  - [ ] Check AHDS FHIR for the patient:
    ```bash
    FHIR_ENDPOINT=$(jq -r '.ahds.fhirEndpoint' deployment-info.json)
    TOKEN=$(az account get-access-token --resource "$FHIR_ENDPOINT" --query accessToken -o tsv)
    curl -X GET "${FHIR_ENDPOINT}/Patient" -H "Authorization: Bearer $TOKEN"
    ```

- [ ] **Manual Sync Test**
  ```bash
  FUNCTION_APP=$(jq -r '.functionApp.name' deployment-info.json)
  RESOURCE_GROUP=$(jq -r '.resourceGroup' deployment-info.json)
  FUNCTION_KEY=$(az functionapp keys list --name "$FUNCTION_APP" --resource-group "$RESOURCE_GROUP" --query functionKeys.default -o tsv)
  FUNCTION_URL="https://${FUNCTION_APP}.azurewebsites.net"
  
  # Test sync-patient
  curl -X POST "${FUNCTION_URL}/api/syncPatient?code=${FUNCTION_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"patientId": "1"}'
  ```

## Troubleshooting

If verification fails, check:

- [ ] **OpenEMR Issues**
  - [ ] VM is running: `az vm show --name OpenEMR-VM --resource-group $RESOURCE_GROUP`
  - [ ] SSH to VM: `ssh azureuser@<openemr-fqdn>`
  - [ ] Check Docker containers: `docker ps`
  - [ ] Check Docker logs: `docker logs openemr_openemr_1`

- [ ] **Function App Issues**
  - [ ] View logs: `az webapp log tail --name $FUNCTION_APP --resource-group $RESOURCE_GROUP`
  - [ ] Check app settings are correct
  - [ ] Verify function code deployed successfully
  - [ ] Test authentication to OpenEMR
  - [ ] Test authentication to AHDS

- [ ] **AHDS Issues**
  - [ ] Verify FHIR service is running
  - [ ] Check role assignments (FHIR Data Contributor)
  - [ ] Test direct API access with Azure CLI token
  - [ ] Wait a few minutes for role assignments to propagate

- [ ] **Network Issues**
  - [ ] Check NSG rules allow HTTP/HTTPS
  - [ ] Verify public IP is attached to VM
  - [ ] Test connectivity from function app to OpenEMR
  - [ ] Check firewall rules

## Common Issues & Solutions

### Issue: "OpenEMR not accessible"
**Solution**: Wait longer (15-20 minutes for initial setup), check VM is running

### Issue: "Failed to create OpenEMR API client"
**Solution**: Ensure FHIR API is enabled in Globals → Connectors

### Issue: "Authentication failed to AHDS"
**Solution**: 
- Verify app registration credentials are correct
- Ensure FHIR Data Contributor role is assigned
- Wait a few minutes for role propagation

### Issue: "Patient not found in AHDS"
**Solution**:
- Check function logs for errors
- Verify OpenEMR API client credentials in function settings
- Manually trigger sync again
- Check AHDS FHIR endpoint is correct

### Issue: "Function deployment failed"
**Solution**:
- Ensure Node.js 18 is installed
- Check `npm install` completed successfully
- Verify `npm run build` has no errors
- Try republishing: `func azure functionapp publish $FUNCTION_APP`

## Security Checklist (Production)

Before going to production, ensure:

- [ ] **Secrets in Key Vault**
  - [ ] Move OpenEMR client secret to Key Vault
  - [ ] Move AHDS client secret to Key Vault
  - [ ] Reference secrets via app settings: `@Microsoft.KeyVault(...)`

- [ ] **Managed Identity**
  - [ ] Enable system-assigned managed identity on function app
  - [ ] Assign FHIR Data Contributor role to managed identity
  - [ ] Remove client secret from app settings

- [ ] **Network Security**
  - [ ] Configure NSG to restrict OpenEMR access
  - [ ] Enable Private Link for AHDS (if available)
  - [ ] Configure IP restrictions on function app
  - [ ] Remove public IP from OpenEMR VM (if internal only)

- [ ] **Monitoring & Alerts**
  - [ ] Configure alerts for sync failures
  - [ ] Set up log retention policies
  - [ ] Enable advanced threat protection
  - [ ] Configure backup policies

- [ ] **Compliance**
  - [ ] Enable audit logging
  - [ ] Configure data retention
  - [ ] Document data flows
  - [ ] Review HIPAA/compliance requirements

## Success Criteria

Deployment is successful when:

- ✅ OpenEMR is accessible via web browser
- ✅ AHDS FHIR service is provisioned and accessible
- ✅ Function app is deployed and running
- ✅ Auto-sync function executes every minute without errors
- ✅ Test patient "John Doe" is created and synced successfully
- ✅ Verification script passes
- ✅ Application Insights shows healthy metrics
- ✅ No errors in function logs

## Next Steps

After successful deployment:

1. **Add Production Data**
   - Import existing patients from OpenEMR
   - Verify all data syncs correctly

2. **Optimize Performance**
   - Implement incremental sync
   - Add more resource types (Encounter, Medication, etc.)
   - Optimize sync frequency if needed

3. **Enhance Security**
   - Implement managed identity
   - Move secrets to Key Vault
   - Configure network restrictions

4. **Set Up Monitoring**
   - Create custom dashboards
   - Configure comprehensive alerts
   - Set up regular reports

5. **Plan for Scale**
   - Test with larger datasets
   - Implement pagination for large queries
   - Consider durable functions for orchestration

## Cleanup

To remove all resources when done:

```bash
RESOURCE_GROUP=$(jq -r '.resourceGroup' deployment-info.json)
APP_ID=$(jq -r '.functionApp.appId' deployment-info.json)

# Delete resource group
az group delete --name "$RESOURCE_GROUP" --yes --no-wait

# Optionally delete Azure AD app registration
az ad app delete --id "$APP_ID"
```

---

**Need Help?**
- Review [README.md](README.md) for detailed documentation
- Check [TROUBLESHOOTING.md](../fhir-connector/README.md#troubleshooting) for common issues
- Open an issue on [GitHub](https://github.com/matthansen0/azure-openemr/issues)
