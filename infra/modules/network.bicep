@description('Azure region for network resources.')
param location string

@description('Common resource tags.')
param tags object

@description('VNet address prefix.')
param vnetAddressPrefix string = '10.0.0.0/16'

@description('OpenEMR VM subnet prefix.')
param vmSubnetPrefix string = '10.0.1.0/24'

@description('Connector Flex integration subnet prefix (min /27).')
param connectorSubnetPrefix string = '10.0.2.0/27'

@description('Viewer Flex integration subnet prefix (min /27).')
param viewerSubnetPrefix string = '10.0.3.0/27'

@description('Private endpoint subnet prefix.')
param privateEndpointSubnetPrefix string = '10.0.4.0/24'

resource nsgVm 'Microsoft.Network/networkSecurityGroups@2023-09-01' = {
  name: 'nsg-openemr-vm'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'Allow-HTTP'
        properties: {
          priority: 100
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourcePortRange: '*'
          destinationPortRange: '80'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: '*'
        }
      }
      {
        name: 'Allow-HTTPS'
        properties: {
          priority: 110
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourcePortRange: '*'
          destinationPortRange: '443'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: '*'
        }
      }
    ]
  }
}

resource nsgEndpoints 'Microsoft.Network/networkSecurityGroups@2023-09-01' = {
  name: 'nsg-private-endpoints'
  location: location
  tags: tags
  properties: {
    securityRules: []
  }
}

resource vnet 'Microsoft.Network/virtualNetworks@2023-09-01' = {
  name: 'vnet-openemr-ahds'
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [
        vnetAddressPrefix
      ]
    }
    subnets: [
      {
        name: 'snet-openemr-vm'
        properties: {
          addressPrefix: vmSubnetPrefix
          networkSecurityGroup: {
            id: nsgVm.id
          }
        }
      }
      {
        name: 'snet-connector-flex'
        properties: {
          addressPrefix: connectorSubnetPrefix
          delegations: [
            {
              name: 'Microsoft.App.environments'
              properties: {
                serviceName: 'Microsoft.App/environments'
              }
            }
          ]
        }
      }
      {
        name: 'snet-viewer-flex'
        properties: {
          addressPrefix: viewerSubnetPrefix
          delegations: [
            {
              name: 'Microsoft.App.environments'
              properties: {
                serviceName: 'Microsoft.App/environments'
              }
            }
          ]
        }
      }
      {
        name: 'snet-private-endpoints'
        properties: {
          addressPrefix: privateEndpointSubnetPrefix
          networkSecurityGroup: {
            id: nsgEndpoints.id
          }
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
    ]
  }
}

resource dnsZoneBlob 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.blob.${environment().suffixes.storage}'
  location: 'global'
  tags: tags
}

resource dnsZoneQueue 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.queue.${environment().suffixes.storage}'
  location: 'global'
  tags: tags
}

resource dnsZoneTable 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.table.${environment().suffixes.storage}'
  location: 'global'
  tags: tags
}

resource dnsZoneVault 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.vaultcore.azure.net'
  location: 'global'
  tags: tags
}

resource dnsZoneFhir 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.fhir.azurehealthcareapis.com'
  location: 'global'
  tags: tags
}

resource linkDnsBlob 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  name: 'link-blob-vnet'
  parent: dnsZoneBlob
  location: 'global'
  properties: {
    virtualNetwork: { id: vnet.id }
    registrationEnabled: false
  }
}

resource linkDnsQueue 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  name: 'link-queue-vnet'
  parent: dnsZoneQueue
  location: 'global'
  properties: {
    virtualNetwork: { id: vnet.id }
    registrationEnabled: false
  }
}

resource linkDnsTable 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  name: 'link-table-vnet'
  parent: dnsZoneTable
  location: 'global'
  properties: {
    virtualNetwork: { id: vnet.id }
    registrationEnabled: false
  }
}

resource linkDnsVault 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  name: 'link-vault-vnet'
  parent: dnsZoneVault
  location: 'global'
  properties: {
    virtualNetwork: { id: vnet.id }
    registrationEnabled: false
  }
}

resource linkDnsFhir 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  name: 'link-fhir-vnet'
  parent: dnsZoneFhir
  location: 'global'
  properties: {
    virtualNetwork: { id: vnet.id }
    registrationEnabled: false
  }
}

output vnetId string = vnet.id
output vmSubnetId string = '${vnet.id}/subnets/snet-openemr-vm'
output connectorSubnetId string = '${vnet.id}/subnets/snet-connector-flex'
output viewerSubnetId string = '${vnet.id}/subnets/snet-viewer-flex'
output privateEndpointSubnetId string = '${vnet.id}/subnets/snet-private-endpoints'
output dnsZoneBlobId string = dnsZoneBlob.id
output dnsZoneQueueId string = dnsZoneQueue.id
output dnsZoneTableId string = dnsZoneTable.id
output dnsZoneVaultId string = dnsZoneVault.id
output dnsZoneFhirId string = dnsZoneFhir.id
