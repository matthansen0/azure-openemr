@description('Function app name.')
param name string

@description('Azure region.')
param location string

@description('Common tags.')
param tags object

@description('Subnet ID for Flex VNet integration.')
param vnetSubnetId string

@description('Storage Account ID.')
param storageAccountId string

@description('Storage Blob primary endpoint URI.')
param storageBlobEndpoint string

@description('Storage Queue primary endpoint URI.')
param storageQueueEndpoint string

@description('Storage Table primary endpoint URI.')
param storageTableEndpoint string

@description('Application Insights connection string.')
param appInsightsConnectionString string

@description('Additional app settings.')
param customAppSettings array = []

resource hostingPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: 'plan-${name}'
  location: location
  kind: 'linux'
  tags: tags
  sku: {
    name: 'FC1'
    tier: 'FlexConsumption'
  }
  properties: {
    reserved: true
  }
}

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: name
  location: location
  kind: 'functionapp,linux'
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: hostingPlan.id
    httpsOnly: true
    virtualNetworkSubnetId: vnetSubnetId
    siteConfig: {
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      appSettings: concat([
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'AzureWebJobsStorage__credential'
          value: 'managedidentity'
        }
        {
          name: 'AzureWebJobsStorage__blobServiceUri'
          value: storageBlobEndpoint
        }
        {
          name: 'AzureWebJobsStorage__queueServiceUri'
          value: storageQueueEndpoint
        }
        {
          name: 'AzureWebJobsStorage__tableServiceUri'
          value: storageTableEndpoint
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
      ], customAppSettings)
    }
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storageBlobEndpoint}function-releases'
          authentication: {
            type: 'SystemAssigned'
          }
        }
      }
      scaleAndConcurrency: {
        maximumInstanceCount: 4
        instanceMemoryMB: 2048
      }
      runtime: {
        name: 'node'
        version: '22'
      }
    }
  }
}

resource targetStorage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: last(split(storageAccountId, '/'))
}

resource roleBlob 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccountId, functionApp.id, 'blob-contributor')
  scope: targetStorage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource roleQueue 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccountId, functionApp.id, 'queue-contributor')
  scope: targetStorage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '97475e7b-c17c-4c9b-8b5d-4f1d28383f98')
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource roleTable 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccountId, functionApp.id, 'table-contributor')
  scope: targetStorage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '0a9a7e1f-a917-4e3a-99a2-2b22584e12fb')
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output id string = functionApp.id
output name string = functionApp.name
output principalId string = functionApp.identity.principalId
output defaultHostName string = functionApp.properties.defaultHostName
