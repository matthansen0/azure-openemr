targetScope = 'resourceGroup'

@description('Deployment environment name.')
param environmentName string = 'dev'

@description('Azure region for the deployment.')
param location string = resourceGroup().location

@description('Deployment tags.')
param tags object = {
  workload: 'openemr-ahds-poc'
  environment: environmentName
  managedBy: 'azd-bicep'
}

var uniqueSuffix = uniqueString(resourceGroup().id, environmentName)
var keyVaultName = take('kv-${uniqueSuffix}', 24)
var ahdsWorkspaceName = 'ahds-${uniqueSuffix}'
var fhirServiceName = 'fhir'
var openemrVmName = 'vm-openemr-${uniqueSuffix}'
var connectorAppName = 'func-connector-${uniqueSuffix}'
var viewerAppName = 'func-viewer-${uniqueSuffix}'

module network 'modules/network.bicep' = {
  name: 'network-deployment'
  params: {
    location: location
    tags: tags
  }
}

module connectorStorage 'modules/storage.bicep' = {
  name: 'connector-storage'
  params: {
    name: take('stconn${uniqueSuffix}', 24)
    location: location
    tags: tags
  }
}

module viewerStorage 'modules/storage.bicep' = {
  name: 'viewer-storage'
  params: {
    name: take('stview${uniqueSuffix}', 24)
    location: location
    tags: tags
  }
}

module keyVault 'modules/key-vault.bicep' = {
  name: 'keyvault-deployment'
  params: {
    name: keyVaultName
    location: location
    tags: tags
    privateEndpointSubnetId: network.outputs.privateEndpointSubnetId
    dnsZoneVaultId: network.outputs.dnsZoneVaultId
  }
}

module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring-deployment'
  params: {
    namePrefix: uniqueSuffix
    location: location
    tags: tags
  }
}

module ahds 'modules/ahds.bicep' = {
  name: 'ahds-deployment'
  params: {
    workspaceName: ahdsWorkspaceName
    fhirServiceName: fhirServiceName
    location: location
    tags: tags
    privateEndpointSubnetId: network.outputs.privateEndpointSubnetId
    dnsZoneFhirId: network.outputs.dnsZoneFhirId
  }
}

module openemrVm 'modules/openemr-vm.bicep' = {
  name: 'openemr-vm-deployment'
  params: {
    name: openemrVmName
    location: location
    tags: tags
    subnetId: network.outputs.vmSubnetId
  }
}

module connectorApp 'modules/function-app.bicep' = {
  name: 'connector-app-deployment'
  params: {
    name: connectorAppName
    location: location
    tags: tags
    vnetSubnetId: network.outputs.connectorSubnetId
    storageAccountId: connectorStorage.outputs.id
    storageBlobEndpoint: connectorStorage.outputs.blobEndpoint
    storageQueueEndpoint: connectorStorage.outputs.queueEndpoint
    storageTableEndpoint: connectorStorage.outputs.tableEndpoint
    appInsightsConnectionString: monitoring.outputs.appInsightsConnectionString
    customAppSettings: [
      {
        name: 'OPENEMR_BASE_URL'
        value: 'https://${openemrVm.outputs.fqdn}'
      }
      {
        name: 'KEY_VAULT_URI'
        value: keyVault.outputs.vaultUri
      }
      {
        name: 'AHDS_FHIR_URL'
        value: ahds.outputs.fhirServiceUrl
      }
      {
        name: 'TIMER_ENABLED'
        value: 'false'
      }
    ]
  }
}

module viewerApp 'modules/function-app.bicep' = {
  name: 'viewer-app-deployment'
  params: {
    name: viewerAppName
    location: location
    tags: tags
    vnetSubnetId: network.outputs.viewerSubnetId
    storageAccountId: viewerStorage.outputs.id
    storageBlobEndpoint: viewerStorage.outputs.blobEndpoint
    storageQueueEndpoint: viewerStorage.outputs.queueEndpoint
    storageTableEndpoint: viewerStorage.outputs.tableEndpoint
    appInsightsConnectionString: monitoring.outputs.appInsightsConnectionString
    customAppSettings: [
      {
        name: 'AHDS_FHIR_URL'
        value: ahds.outputs.fhirServiceUrl
      }
    ]
  }
}

resource ahdsFhirResource 'Microsoft.HealthcareApis/workspaces/fhirservices@2023-11-01' existing = {
  name: '${ahdsWorkspaceName}/${fhirServiceName}'
}

resource keyVaultResource 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource roleConnectorFhirContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(ahds.outputs.fhirServiceId, connectorApp.outputs.id, 'fhir-contributor')
  scope: ahdsFhirResource
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '5a1fc7df-4bf1-4951-a576-89034ee01acd')
    principalId: connectorApp.outputs.principalId
    principalType: 'ServicePrincipal'
  }
}

resource roleViewerFhirReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(ahds.outputs.fhirServiceId, viewerApp.outputs.id, 'fhir-reader')
  scope: ahdsFhirResource
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '44144438-e5cd-4d57-8250-023a85361099')
    principalId: viewerApp.outputs.principalId
    principalType: 'ServicePrincipal'
  }
}

resource roleConnectorKvUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.outputs.id, connectorApp.outputs.id, 'kv-secrets-user')
  scope: keyVaultResource
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '46330053-87a7-4b93-872d-0630c63705c1')
    principalId: connectorApp.outputs.principalId
    principalType: 'ServicePrincipal'
  }
}

resource roleVmKvUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.outputs.id, openemrVm.outputs.id, 'kv-secrets-user')
  scope: keyVaultResource
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '46330053-87a7-4b93-872d-0630c63705c1')
    principalId: openemrVm.outputs.principalId
    principalType: 'ServicePrincipal'
  }
}

output environmentName string = environmentName
output location string = location
output openemrFqdn string = openemrVm.outputs.fqdn
output fhirServiceUrl string = ahds.outputs.fhirServiceUrl
output keyVaultUri string = keyVault.outputs.vaultUri
output connectorAppName string = connectorApp.outputs.name
output viewerAppName string = viewerApp.outputs.name
output viewerHostName string = viewerApp.outputs.defaultHostName