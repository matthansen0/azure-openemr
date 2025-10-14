# Sample FHIR Resources for Testing

This directory contains sample FHIR R4 resources that can be used for testing the connector.

## Sample Patient

```json
{
  "resourceType": "Patient",
  "id": "example-patient-1",
  "identifier": [
    {
      "use": "official",
      "system": "http://openemr.example.com/fhir/Patient",
      "value": "12345"
    }
  ],
  "active": true,
  "name": [
    {
      "use": "official",
      "family": "Doe",
      "given": ["John", "Michael"]
    }
  ],
  "telecom": [
    {
      "system": "phone",
      "value": "555-123-4567",
      "use": "home"
    },
    {
      "system": "email",
      "value": "john.doe@example.com"
    }
  ],
  "gender": "male",
  "birthDate": "1980-01-15",
  "address": [
    {
      "use": "home",
      "line": ["123 Main St"],
      "city": "Seattle",
      "state": "WA",
      "postalCode": "98101",
      "country": "USA"
    }
  ]
}
```

## Sample Observation (Blood Pressure)

```json
{
  "resourceType": "Observation",
  "id": "example-observation-1",
  "status": "final",
  "category": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/observation-category",
          "code": "vital-signs",
          "display": "Vital Signs"
        }
      ]
    }
  ],
  "code": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "85354-9",
        "display": "Blood pressure panel"
      }
    ]
  },
  "subject": {
    "reference": "Patient/example-patient-1"
  },
  "effectiveDateTime": "2024-01-15T10:30:00Z",
  "component": [
    {
      "code": {
        "coding": [
          {
            "system": "http://loinc.org",
            "code": "8480-6",
            "display": "Systolic blood pressure"
          }
        ]
      },
      "valueQuantity": {
        "value": 120,
        "unit": "mmHg",
        "system": "http://unitsofmeasure.org",
        "code": "mm[Hg]"
      }
    },
    {
      "code": {
        "coding": [
          {
            "system": "http://loinc.org",
            "code": "8462-4",
            "display": "Diastolic blood pressure"
          }
        ]
      },
      "valueQuantity": {
        "value": 80,
        "unit": "mmHg",
        "system": "http://unitsofmeasure.org",
        "code": "mm[Hg]"
      }
    }
  ]
}
```

## Sample Observation (Body Temperature)

```json
{
  "resourceType": "Observation",
  "id": "example-observation-2",
  "status": "final",
  "category": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/observation-category",
          "code": "vital-signs",
          "display": "Vital Signs"
        }
      ]
    }
  ],
  "code": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "8310-5",
        "display": "Body temperature"
      }
    ]
  },
  "subject": {
    "reference": "Patient/example-patient-1"
  },
  "effectiveDateTime": "2024-01-15T10:30:00Z",
  "valueQuantity": {
    "value": 98.6,
    "unit": "degF",
    "system": "http://unitsofmeasure.org",
    "code": "[degF]"
  }
}
```

## How to Add Test Data to OpenEMR

### Option 1: Through OpenEMR UI

1. Login to OpenEMR admin panel
2. Navigate to **Patient/Client** → **New/Search**
3. Click **New Patient**
4. Fill in patient details matching the sample above
5. After creating patient, add observations through **Encounter** → **Vitals**

### Option 2: Using FHIR API (requires authentication)

```bash
# Get access token from OpenEMR
TOKEN=$(curl -X POST https://your-openemr-url.com/oauth2/default/token \
  -d "grant_type=client_credentials" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "scope=api:fhir" \
  | jq -r .access_token)

# Create patient
curl -X POST https://your-openemr-url.com/apis/default/fhir/Patient \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/fhir+json" \
  -d @patient-sample.json

# Create observation
curl -X POST https://your-openemr-url.com/apis/default/fhir/Observation \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/fhir+json" \
  -d @observation-sample.json
```

### Option 3: Load Demo Data

OpenEMR includes demo data that can be loaded during initial setup:
1. During OpenEMR setup, select **Load Demo Data**
2. This will create sample patients and observations
3. Use these for testing the connector

## Testing the Connector with Sample Data

After adding test data to OpenEMR:

```bash
# Sync a specific patient (use the actual ID from OpenEMR)
curl -X POST https://your-function-url/api/sync-patient \
  -H "Content-Type: application/json" \
  -d '{"patientId": "1"}'

# Sync patient with all observations
curl -X POST https://your-function-url/api/sync-patient-with-observations \
  -H "Content-Type: application/json" \
  -d '{"patientId": "1"}'

# Sync a specific observation
curl -X POST https://your-function-url/api/sync-observation \
  -H "Content-Type: application/json" \
  -d '{"observationId": "1"}'
```

## Verifying Data in Azure Health Data Services

After syncing, verify the data was transferred:

```bash
# Get Azure AD token
TOKEN=$(az account get-access-token \
  --resource=https://your-workspace-fhir.fhir.azurehealthcareapis.com \
  --query accessToken \
  --output tsv)

# Query all patients
curl -X GET https://your-workspace-fhir.fhir.azurehealthcareapis.com/Patient \
  -H "Authorization: Bearer $TOKEN"

# Query observations for a patient
curl -X GET "https://your-workspace-fhir.fhir.azurehealthcareapis.com/Observation?patient=1" \
  -H "Authorization: Bearer $TOKEN"

# Get specific patient
curl -X GET https://your-workspace-fhir.fhir.azurehealthcareapis.com/Patient/1 \
  -H "Authorization: Bearer $TOKEN"
```

## Expected Results

After successful sync, you should see:
- Patient resource in AHDS with same ID as OpenEMR
- Observation resources linked to the patient
- All data fields properly mapped
- Timestamps preserved from OpenEMR

## Troubleshooting

**Patient Not Found in OpenEMR**
- Check patient exists in OpenEMR database
- Verify patient ID is correct
- Ensure FHIR API is enabled

**Sync Fails**
- Review Application Insights logs
- Check network connectivity
- Verify authentication credentials
- Ensure patient data is valid FHIR R4

**Data Mismatch**
- Compare source and target resources
- Check field mappings
- Review terminology systems
- Verify data types match FHIR specification
