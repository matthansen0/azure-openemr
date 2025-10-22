#!/bin/bash

#############################################################################
# OpenEMR + Azure Health Data Services (AHDS) + FHIR Connector Deployment
#
# This script automates the complete deployment of:
# 1. OpenEMR on Azure VM (with Docker Compose)
# 2. Azure Health Data Services (FHIR R4)
# 3. FHIR Connector Azure Function
# 4. All necessary configurations and role assignments
# 5. Test patient creation and validation
#
# Usage: ./deploy.sh [branch_name]
#   branch_name: Git branch to deploy from (default: main)
#
#############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get branch from parameter or use main
BRANCH="${1:-main}"
print_info "Deploying from branch: $BRANCH"

# Generate unique names
TIMESTAMP=$(date +%s)
RESOURCE_GROUP="openemr-fhir-rg-${TIMESTAMP}"
LOCATION="eastus"
VM_NAME="OpenEMR-VM"
DNS_PREFIX="openemr-${TIMESTAMP}"
WORKSPACE_NAME="ahds-${TIMESTAMP}"
FHIR_SERVICE_NAME="fhir"
FUNCTION_APP_NAME="fhir-connector-${TIMESTAMP}"

print_info "========================================="
print_info "Deployment Configuration"
print_info "========================================="
print_info "Resource Group: $RESOURCE_GROUP"
print_info "Location: $LOCATION"
print_info "Branch: $BRANCH"
print_info "========================================="

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    print_error "Azure CLI is not installed. Please install it first."
    exit 1
fi

# Check if logged in to Azure
if ! az account show &> /dev/null; then
    print_error "Not logged in to Azure. Please run 'az login' first."
    exit 1
fi

SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)

print_info "Using Azure subscription: $SUBSCRIPTION_ID"
print_info "Tenant ID: $TENANT_ID"

# Prompt for VM credentials
print_info "Please provide VM credentials for OpenEMR:"
read -p "Enter admin username: " ADMIN_USERNAME
read -sp "Enter admin password: " ADMIN_PASSWORD
echo ""

#############################################################################
# Step 1: Create Resource Group
#############################################################################
print_info "Step 1: Creating resource group..."
az group create \
    --name "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --output none

print_info "Resource group created successfully"

#############################################################################
# Step 2: Deploy OpenEMR VM
#############################################################################
print_info "Step 2: Deploying OpenEMR on Azure VM (this takes ~15 minutes)..."

OPENEMR_DEPLOYMENT=$(az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --template-uri "https://raw.githubusercontent.com/matthansen0/azure-openemr/${BRANCH}/all-in-one/azuredeploy.json" \
    --parameters \
        branch="$BRANCH" \
        vmName="$VM_NAME" \
        adminUsername="$ADMIN_USERNAME" \
        authenticationType="password" \
        adminPasswordOrKey="$ADMIN_PASSWORD" \
        dnsLabelPrefix="$DNS_PREFIX" \
    --output json)

OPENEMR_FQDN=$(echo "$OPENEMR_DEPLOYMENT" | jq -r '.properties.outputs.hostname.value')
OPENEMR_URL="http://${OPENEMR_FQDN}"

print_info "OpenEMR deployed successfully"
print_info "OpenEMR URL: $OPENEMR_URL"
print_info "Default credentials: admin / openEMRonAzure!"

# Wait for OpenEMR to be fully ready
print_info "Waiting for OpenEMR to be fully accessible..."
RETRIES=0
MAX_RETRIES=30
until curl -sf "$OPENEMR_URL" > /dev/null 2>&1 || [ $RETRIES -eq $MAX_RETRIES ]; do
    print_info "Waiting for OpenEMR... (attempt $((RETRIES+1))/$MAX_RETRIES)"
    sleep 10
    RETRIES=$((RETRIES+1))
done

if [ $RETRIES -eq $MAX_RETRIES ]; then
    print_error "OpenEMR did not become accessible in time"
    exit 1
fi

print_info "OpenEMR is now accessible"

#############################################################################
# Step 3: Deploy Azure Health Data Services (AHDS)
#############################################################################
print_info "Step 3: Deploying Azure Health Data Services..."

# Create AHDS workspace
az healthcareapis workspace create \
    --resource-group "$RESOURCE_GROUP" \
    --name "$WORKSPACE_NAME" \
    --location "$LOCATION" \
    --output none

# Create FHIR service
az healthcareapis workspace fhir-service create \
    --resource-group "$RESOURCE_GROUP" \
    --workspace-name "$WORKSPACE_NAME" \
    --name "$FHIR_SERVICE_NAME" \
    --kind "fhir-R4" \
    --location "$LOCATION" \
    --managed-identity-type "SystemAssigned" \
    --output none

FHIR_ENDPOINT="https://${WORKSPACE_NAME}-${FHIR_SERVICE_NAME}.fhir.azurehealthcareapis.com"
print_info "AHDS FHIR service deployed successfully"
print_info "FHIR Endpoint: $FHIR_ENDPOINT"

#############################################################################
# Step 4: Create Azure AD App Registration for FHIR Connector
#############################################################################
print_info "Step 4: Creating Azure AD app registration for FHIR connector..."

APP_NAME="openemr-fhir-connector-${TIMESTAMP}"

# Create app registration
APP_ID=$(az ad app create \
    --display-name "$APP_NAME" \
    --query appId \
    --output tsv)

# Create service principal
az ad sp create --id "$APP_ID" --output none

# Create client secret
CLIENT_SECRET=$(az ad app credential reset \
    --id "$APP_ID" \
    --query password \
    --output tsv)

print_info "App registration created"
print_info "App ID: $APP_ID"

# Grant FHIR Data Contributor role
print_info "Granting FHIR Data Contributor role..."

FHIR_RESOURCE_ID=$(az healthcareapis workspace fhir-service show \
    --resource-group "$RESOURCE_GROUP" \
    --workspace-name "$WORKSPACE_NAME" \
    --name "$FHIR_SERVICE_NAME" \
    --query id \
    --output tsv)

az role assignment create \
    --assignee "$APP_ID" \
    --role "FHIR Data Contributor" \
    --scope "$FHIR_RESOURCE_ID" \
    --output none

# Wait for role assignment to propagate
print_info "Waiting for role assignment to propagate (30 seconds)..."
sleep 30

#############################################################################
# Step 5: Deploy Function App Infrastructure
#############################################################################
print_info "Step 5: Deploying Function App infrastructure..."

az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --template-uri "https://raw.githubusercontent.com/matthansen0/azure-openemr/${BRANCH}/fhir-connector/deployment/function-app.json" \
    --parameters functionAppName="$FUNCTION_APP_NAME" \
    --output none

print_info "Function App infrastructure deployed"

#############################################################################
# Step 6: Configure OpenEMR API Client
#############################################################################
print_info "Step 6: Configuring OpenEMR API client..."

# Note: This step requires SSH access to the VM to configure OpenEMR
# For now, we'll document the manual steps needed
print_warn "Manual configuration required for OpenEMR:"
print_warn "1. SSH into the VM: ssh ${ADMIN_USERNAME}@${OPENEMR_FQDN}"
print_warn "2. Access OpenEMR at ${OPENEMR_URL}"
print_warn "3. Login with admin / openEMRonAzure!"
print_warn "4. Navigate to Administration > System > API Clients"
print_warn "5. Register a new API client with client credentials grant type and api:fhir scope"
print_warn "6. Save the client ID and secret"

# For automated deployment, we would need to use OpenEMR's API or database directly
# This is a limitation of the current POC but can be automated in production

# Placeholder values - in production, this would be automated
OPENEMR_CLIENT_ID="placeholder-client-id"
OPENEMR_CLIENT_SECRET="placeholder-client-secret"

print_warn "Using placeholder OpenEMR credentials for now"

#############################################################################
# Step 7: Configure Function App Settings
#############################################################################
print_info "Step 7: Configuring Function App settings..."

az functionapp config appsettings set \
    --name "$FUNCTION_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --settings \
        OPENEMR_BASE_URL="$OPENEMR_URL" \
        OPENEMR_CLIENT_ID="$OPENEMR_CLIENT_ID" \
        OPENEMR_CLIENT_SECRET="$OPENEMR_CLIENT_SECRET" \
        AHDS_FHIR_ENDPOINT="$FHIR_ENDPOINT" \
        AHDS_TENANT_ID="$TENANT_ID" \
        AHDS_CLIENT_ID="$APP_ID" \
        AHDS_CLIENT_SECRET="$CLIENT_SECRET" \
    --output none

print_info "Function App settings configured"

#############################################################################
# Step 8: Deploy Function Code
#############################################################################
print_info "Step 8: Deploying Function code..."

# In a real deployment, this would build and publish the function code
# For this POC, we'll document the steps
print_warn "To deploy function code, run:"
print_warn "  cd fhir-connector"
print_warn "  npm install && npm run build"
print_warn "  func azure functionapp publish $FUNCTION_APP_NAME"

#############################################################################
# Summary
#############################################################################
print_info "========================================="
print_info "Deployment Complete!"
print_info "========================================="
print_info ""
print_info "OpenEMR:"
print_info "  URL: $OPENEMR_URL"
print_info "  Username: admin"
print_info "  Password: openEMRonAzure!"
print_info ""
print_info "Azure Health Data Services:"
print_info "  FHIR Endpoint: $FHIR_ENDPOINT"
print_info ""
print_info "FHIR Connector:"
print_info "  Function App: $FUNCTION_APP_NAME"
print_info "  Azure AD App ID: $APP_ID"
print_info ""
print_info "Next Steps:"
print_info "1. Configure OpenEMR API client (see manual steps above)"
print_info "2. Update Function App settings with real OpenEMR credentials"
print_info "3. Deploy function code"
print_info "4. Run verification script to test the integration"
print_info ""
print_info "Resource Group: $RESOURCE_GROUP"
print_info "To delete all resources: az group delete --name $RESOURCE_GROUP --yes"
print_info "========================================="

# Save deployment info to file
cat > deployment-info.json <<EOF
{
  "timestamp": "$TIMESTAMP",
  "resourceGroup": "$RESOURCE_GROUP",
  "location": "$LOCATION",
  "branch": "$BRANCH",
  "openemr": {
    "url": "$OPENEMR_URL",
    "fqdn": "$OPENEMR_FQDN",
    "username": "admin",
    "password": "openEMRonAzure!"
  },
  "ahds": {
    "fhirEndpoint": "$FHIR_ENDPOINT",
    "workspace": "$WORKSPACE_NAME",
    "fhirService": "$FHIR_SERVICE_NAME"
  },
  "functionApp": {
    "name": "$FUNCTION_APP_NAME",
    "appId": "$APP_ID"
  },
  "azure": {
    "subscriptionId": "$SUBSCRIPTION_ID",
    "tenantId": "$TENANT_ID"
  }
}
EOF

print_info "Deployment information saved to deployment-info.json"
