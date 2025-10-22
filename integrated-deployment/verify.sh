#!/bin/bash

#############################################################################
# OpenEMR + AHDS FHIR Connector Verification Script
#
# This script verifies the complete integration by:
# 1. Creating a test patient "John Doe" in OpenEMR
# 2. Waiting for sync (1 minute)
# 3. Verifying the patient exists in AHDS FHIR
#
# Usage: ./verify.sh [deployment-info.json]
#
#############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Load deployment info
DEPLOYMENT_INFO="${1:-deployment-info.json}"

if [ ! -f "$DEPLOYMENT_INFO" ]; then
    print_error "Deployment info file not found: $DEPLOYMENT_INFO"
    print_error "Please run deploy.sh first or specify the correct file path"
    exit 1
fi

print_info "Loading deployment information from $DEPLOYMENT_INFO"

OPENEMR_URL=$(jq -r '.openemr.url' "$DEPLOYMENT_INFO")
OPENEMR_USERNAME=$(jq -r '.openemr.username' "$DEPLOYMENT_INFO")
OPENEMR_PASSWORD=$(jq -r '.openemr.password' "$DEPLOYMENT_INFO")
FHIR_ENDPOINT=$(jq -r '.ahds.fhirEndpoint' "$DEPLOYMENT_INFO")
FUNCTION_APP_NAME=$(jq -r '.functionApp.name' "$DEPLOYMENT_INFO")
RESOURCE_GROUP=$(jq -r '.resourceGroup' "$DEPLOYMENT_INFO")

print_info "========================================="
print_info "Verification Configuration"
print_info "========================================="
print_info "OpenEMR URL: $OPENEMR_URL"
print_info "FHIR Endpoint: $FHIR_ENDPOINT"
print_info "Function App: $FUNCTION_APP_NAME"
print_info "========================================="

#############################################################################
# Step 1: Create Test Patient in OpenEMR
#############################################################################
print_info "Step 1: Creating test patient 'John Doe' in OpenEMR..."

# Get OpenEMR API access token
print_info "Authenticating with OpenEMR..."

# First, we need to get the OpenEMR client credentials from the function app settings
OPENEMR_CLIENT_ID=$(az functionapp config appsettings list \
    --name "$FUNCTION_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "[?name=='OPENEMR_CLIENT_ID'].value" \
    --output tsv)

OPENEMR_CLIENT_SECRET=$(az functionapp config appsettings list \
    --name "$FUNCTION_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "[?name=='OPENEMR_CLIENT_SECRET'].value" \
    --output tsv)

if [ "$OPENEMR_CLIENT_ID" == "placeholder-client-id" ]; then
    print_error "OpenEMR API client is not configured yet"
    print_error "Please configure the OpenEMR API client first:"
    print_error "1. Go to $OPENEMR_URL"
    print_error "2. Login with admin / openEMRonAzure!"
    print_error "3. Navigate to Administration > System > API Clients"
    print_error "4. Register new API client with client credentials flow and api:fhir scope"
    print_error "5. Update function app settings with the client ID and secret"
    exit 1
fi

# Get OAuth token from OpenEMR
OPENEMR_TOKEN_RESPONSE=$(curl -s -X POST "${OPENEMR_URL}/oauth2/default/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=client_credentials" \
    -d "client_id=${OPENEMR_CLIENT_ID}" \
    -d "client_secret=${OPENEMR_CLIENT_SECRET}" \
    -d "scope=api:fhir")

OPENEMR_ACCESS_TOKEN=$(echo "$OPENEMR_TOKEN_RESPONSE" | jq -r '.access_token')

if [ "$OPENEMR_ACCESS_TOKEN" == "null" ] || [ -z "$OPENEMR_ACCESS_TOKEN" ]; then
    print_error "Failed to get OpenEMR access token"
    print_error "Response: $OPENEMR_TOKEN_RESPONSE"
    exit 1
fi

print_info "Successfully authenticated with OpenEMR"

# Create test patient via FHIR API
print_info "Creating patient 'John Doe'..."

PATIENT_RESOURCE='{
  "resourceType": "Patient",
  "name": [
    {
      "use": "official",
      "family": "Doe",
      "given": ["John"]
    }
  ],
  "gender": "male",
  "birthDate": "1980-01-01",
  "identifier": [
    {
      "system": "urn:oid:1.2.36.146.595.217.0.1",
      "value": "JOHNDOE-TEST-001"
    }
  ]
}'

PATIENT_RESPONSE=$(curl -s -X POST "${OPENEMR_URL}/apis/default/fhir/Patient" \
    -H "Authorization: Bearer ${OPENEMR_ACCESS_TOKEN}" \
    -H "Content-Type: application/fhir+json" \
    -d "$PATIENT_RESOURCE")

PATIENT_ID=$(echo "$PATIENT_RESPONSE" | jq -r '.id')

if [ "$PATIENT_ID" == "null" ] || [ -z "$PATIENT_ID" ]; then
    print_error "Failed to create patient in OpenEMR"
    print_error "Response: $PATIENT_RESPONSE"
    exit 1
fi

print_success "Patient created in OpenEMR with ID: $PATIENT_ID"

# Create a test observation for the patient
print_info "Creating test observation for the patient..."

OBSERVATION_RESOURCE=$(cat <<EOF
{
  "resourceType": "Observation",
  "status": "final",
  "code": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "29463-7",
        "display": "Body Weight"
      }
    ]
  },
  "subject": {
    "reference": "Patient/${PATIENT_ID}"
  },
  "effectiveDateTime": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "valueQuantity": {
    "value": 185,
    "unit": "lbs",
    "system": "http://unitsofmeasure.org",
    "code": "[lb_av]"
  }
}
EOF
)

OBSERVATION_RESPONSE=$(curl -s -X POST "${OPENEMR_URL}/apis/default/fhir/Observation" \
    -H "Authorization: Bearer ${OPENEMR_ACCESS_TOKEN}" \
    -H "Content-Type: application/fhir+json" \
    -d "$OBSERVATION_RESOURCE")

OBSERVATION_ID=$(echo "$OBSERVATION_RESPONSE" | jq -r '.id')

if [ "$OBSERVATION_ID" == "null" ] || [ -z "$OBSERVATION_ID" ]; then
    print_warn "Failed to create observation (this is optional)"
    print_warn "Response: $OBSERVATION_RESPONSE"
else
    print_success "Observation created with ID: $OBSERVATION_ID"
fi

#############################################################################
# Step 2: Trigger Manual Sync (before waiting for auto-sync)
#############################################################################
print_info "Step 2: Triggering manual sync via Function App..."

# Get function key
FUNCTION_KEY=$(az functionapp keys list \
    --name "$FUNCTION_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query functionKeys.default \
    --output tsv)

FUNCTION_URL="https://${FUNCTION_APP_NAME}.azurewebsites.net"

# Trigger sync-patient function
print_info "Syncing patient $PATIENT_ID..."

SYNC_RESPONSE=$(curl -s -X POST "${FUNCTION_URL}/api/syncPatient?code=${FUNCTION_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"patientId\": \"${PATIENT_ID}\"}")

print_info "Sync response: $SYNC_RESPONSE"

if echo "$SYNC_RESPONSE" | jq -e '.result.success' > /dev/null 2>&1; then
    print_success "Patient sync completed successfully"
else
    print_warn "Patient sync may have failed, but continuing with verification..."
fi

# If observation exists, sync it too
if [ "$OBSERVATION_ID" != "null" ] && [ -n "$OBSERVATION_ID" ]; then
    print_info "Syncing observation $OBSERVATION_ID..."
    
    OBS_SYNC_RESPONSE=$(curl -s -X POST "${FUNCTION_URL}/api/syncObservation?code=${FUNCTION_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"observationId\": \"${OBSERVATION_ID}\"}")
    
    if echo "$OBS_SYNC_RESPONSE" | jq -e '.result.success' > /dev/null 2>&1; then
        print_success "Observation sync completed successfully"
    else
        print_warn "Observation sync may have failed"
    fi
fi

#############################################################################
# Step 3: Wait for Auto-Sync (1 minute)
#############################################################################
print_info "Step 3: Waiting 60 seconds for auto-sync to process any changes..."

for i in {60..1}; do
    echo -ne "\rWaiting ${i} seconds...  "
    sleep 1
done
echo ""

#############################################################################
# Step 4: Verify Patient in AHDS FHIR
#############################################################################
print_info "Step 4: Verifying patient exists in AHDS FHIR..."

# Get Azure AD token for AHDS
AHDS_TOKEN=$(az account get-access-token \
    --resource "$FHIR_ENDPOINT" \
    --query accessToken \
    --output tsv)

# Search for patient in AHDS
print_info "Searching for patient with identifier JOHNDOE-TEST-001..."

AHDS_SEARCH_RESPONSE=$(curl -s -X GET "${FHIR_ENDPOINT}/Patient?identifier=JOHNDOE-TEST-001" \
    -H "Authorization: Bearer ${AHDS_TOKEN}" \
    -H "Accept: application/fhir+json")

TOTAL_RESULTS=$(echo "$AHDS_SEARCH_RESPONSE" | jq -r '.total // 0')

if [ "$TOTAL_RESULTS" -gt 0 ]; then
    print_success "========================================="
    print_success "VERIFICATION PASSED!"
    print_success "========================================="
    print_success "Patient 'John Doe' was successfully:"
    print_success "  1. Created in OpenEMR (Patient/${PATIENT_ID})"
    print_success "  2. Synced via FHIR Connector"
    print_success "  3. Verified in AHDS FHIR"
    print_success ""
    print_success "Found $TOTAL_RESULTS patient(s) in AHDS"
    
    if [ "$OBSERVATION_ID" != "null" ] && [ -n "$OBSERVATION_ID" ]; then
        # Check for observation too
        OBS_SEARCH=$(curl -s -X GET "${FHIR_ENDPOINT}/Observation?subject=Patient/${PATIENT_ID}" \
            -H "Authorization: Bearer ${AHDS_TOKEN}" \
            -H "Accept: application/fhir+json")
        
        OBS_TOTAL=$(echo "$OBS_SEARCH" | jq -r '.total // 0')
        print_success "Found $OBS_TOTAL observation(s) in AHDS for this patient"
    fi
    
    print_success "========================================="
    exit 0
else
    print_error "========================================="
    print_error "VERIFICATION FAILED!"
    print_error "========================================="
    print_error "Patient was created in OpenEMR but NOT found in AHDS"
    print_error ""
    print_error "Troubleshooting steps:"
    print_error "1. Check Function App logs: az webapp log tail --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP"
    print_error "2. Verify function app settings are correct"
    print_error "3. Check that FHIR Data Contributor role is assigned to the app registration"
    print_error "4. Manually trigger sync again: curl -X POST ${FUNCTION_URL}/api/syncPatient?code=${FUNCTION_KEY} -d '{\"patientId\":\"${PATIENT_ID}\"}'"
    print_error "========================================="
    exit 1
fi
