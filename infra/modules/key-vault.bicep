@description('Key Vault resource name.')
param name string

@description('Azure region.')
param location string

@description('Common tags.')
param tags object

@description('Subnet ID for private endpoint.')
param privateEndpointSubnetId string

@description('Private DNS zone ID for Key Vault.')
param dnsZoneVaultId string

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    publicNetworkAccess: 'Disabled'
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'None'
    }
  }
}

resource peVault 'Microsoft.Network/privateEndpoints@2023-09-01' = {
  name: 'pe-kv-${name}'
  location: location
  tags: tags
  properties: {
    subnet: { id: privateEndpointSubnetId }
    privateLinkServiceConnections: [
      {
        name: 'plsc-kv'
        properties: {
          privateLinkServiceId: keyVault.id
          groupIds: ['vault']
        }
      }
    ]
  }
}

resource dnsGroupVault 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-09-01' = {
  name: 'default'
  parent: peVault
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'config-vault'
        properties: {
          privateDnsZoneId: dnsZoneVaultId
        }
      }
    ]
  }
}

output id string = keyVault.id
output name string = keyVault.name
output vaultUri string = keyVault.properties.vaultUri
