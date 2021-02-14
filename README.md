# OpenEMR on Azure
This repository contains automation to deploy OpenEMR on Azure. 

## All-in-one:
### OpenEMR+MySQL Containers with Docker Compose on an Azure IaaS Virtual Machine

[![Deploy To Azure](https://raw.githubusercontent.com/Azure/azure-quickstart-templates/master/1-CONTRIBUTION-GUIDE/images/deploytoazure.svg?sanitize=true)](https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fmatthansen0%2Fazure-openemr%2Fmain%2Fall-in-one%2Fazuredeploy.json)
[![Visualize](https://raw.githubusercontent.com/Azure/azure-quickstart-templates/master/1-CONTRIBUTION-GUIDE/images/visualizebutton.svg?sanitize=true)](http://armviz.io/#/?load=https%3A%2F%2Fraw.githubusercontent.com%2Fmatthansen0%2Fazure-openemr%2Fmain%2Fall-in-one%2Fazuredeploy.json)
	

This template allows you to deploy an Ubuntu Server 18.04-LTS VM with Docker (using the [Docker Extension][ext])
and starts an OpenEMR container listening an port 80 which uses MySQL database running
in a separate but linked Docker container, which are created using [Docker Compose][compose]
capabilities of the [Azure Docker Extension][ext].

[ext]: https://github.com/Azure/azure-docker-extension
[compose]: https://docs.docker.com/compose

## IaaS Web & PaaS DB:
### Deployment of OpenEMR Docker Container to an Azure IaaS Virtual Machine + Azure MySQL

This section has yet to be developed, feel free to submit a PR!


## ACI + PaaS DB:
###  Deployment of OpenEMR Docker on ACI + Azure MySQL

This section has yet to be developed, feel free to submit a PR!

## Other Deployment Options

OpenEMR can be deployed directly on a WAMP or LAMP stack in IaaS, on Azure App Services, in ACI, or even AKS. It can use a local DB or one hosted by a VM directly, a container or Azure MySQL. There are many combinations of how to deploy this solution. Please feel free to submit a PR or an issue if you would like to see an alternative deployment method.