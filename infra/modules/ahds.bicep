@description('AHDS workspace name.')
param workspaceName string

@description('FHIR service name.')
param fhirServiceName string

@description('Azure region.')
param location string

@description('Common tags.')
param tags object

@description('Private endpoint subnet ID.')
param privateEndpointSubnetId string

@description('Private DNS zone ID for FHIR.')
param dnsZoneFhirId string

resource ahdsWorkspace 'Microsoft.HealthcareApis/workspaces@2023-11-01' = {
  name: workspaceName
  location: location
  tags: tags
  properties: {}
}

resource fhirService 'Microsoft.HealthcareApis/workspaces/fhirservices@2023-11-01' = {
  name: fhirServiceName
  parent: ahdsWorkspace
  location: location
  kind: 'fhir-R4'
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    authenticationConfiguration: {
      authority: '${environment().authentication.loginEndpoint}${subscription().tenantId}'
      audience: 'https://${workspaceName}-${fhirServiceName}.fhir.azurehealthcareapis.com'
      smartProxyEnabled: false
    }
    publicNetworkAccess: 'Disabled'
  }
}

resource peFhir 'Microsoft.Network/privateEndpoints@2023-09-01' = {
  name: 'pe-fhir-${fhirServiceName}'
  location: location
  tags: tags
  properties: {
    subnet: { id: privateEndpointSubnetId }
    privateLinkServiceConnections: [
      {
        name: 'plsc-fhir'
        properties: {
          privateLinkServiceId: ahdsWorkspace.id
          groupIds: [ fhirServiceName ]
        }
      }
    ]
  }
}

resource dnsGroupFhir 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-09-01' = {
  name: 'default'
  parent: peFhir
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'config-fhir'
        properties: {
          privateDnsZoneId: dnsZoneFhirId
        }
      }
    ]
  }
}

output workspaceId string = ahdsWorkspace.id
output fhirServiceId string = fhirService.id
output fhirServiceUrl string = 'https://${workspaceName}-${fhirServiceName}.fhir.azurehealthcareapis.com'
