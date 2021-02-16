# OpenEMR on Azure
This repository contains automation to deploy OpenEMR on Azure. 

## All-in-one:
### OpenEMR+MySQL Containers with Docker Compose on an Azure IaaS Virtual Machine

[![Deploy To Azure](https://raw.githubusercontent.com/Azure/azure-quickstart-templates/master/1-CONTRIBUTION-GUIDE/images/deploytoazure.svg?sanitize=true)](https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fmatthansen0%2Fazure-openemr%2Fmain%2Fall-in-one%2Fazuredeploy.json)
[![Visualize](https://raw.githubusercontent.com/Azure/azure-quickstart-templates/master/1-CONTRIBUTION-GUIDE/images/visualizebutton.svg?sanitize=true)](http://armviz.io/#/?load=https%3A%2F%2Fraw.githubusercontent.com%2Fmatthansen0%2Fazure-openemr%2Fmain%2Fall-in-one%2Fazuredeploy.json)
	

This template allows you to deploy an Ubuntu Server 18.04-LTS VM with Docker
and starts an OpenEMR container listening an port 80 which uses MySQL database running
in a separate but linked Docker container, which are created using Docker Compose.

This deployment will listen on HTTP/80 and HTTPS/443 (with a self-signed cert) by default and has a public IP resources associated with it, if this is for an internal deployment please [dissociate the public IP address](https://docs.microsoft.com/en-us/azure/virtual-network/remove-public-ip-address-vm) from the VM.

The ***default credentials*** for this deployment are in the [docker-compose.yml file](all-in-one/docker-compose.yml) and by default the login for OpenEMR is ``admin/openEMRonAzure!``. You can change these credentials using the steps below.


``go to administration->Users and you need to provide "Your Password:" - The password of the current user logged in. "User`s New Password:" - The new password to be changed.`` 

You may also want to [change the MySQL Credentials](https://www.mysqltutorial.org/mysql-changing-password.aspx) and update them in OpenEMR ``In order to change the mysql user and password you need to provide the correct credentials in the file sqlconf.php, which can be found under /sites/default/sqlconf.php``.

## IaaS Web & PaaS DB:
### Deployment of OpenEMR Docker Container to an Azure IaaS Virtual Machine + Azure MySQL

This section has yet to be developed, feel free to submit a PR!


## ACI + PaaS DB:
###  Deployment of OpenEMR Docker on ACI + Azure MySQL

This section has yet to be developed, feel free to submit a PR!

## Other Deployment Options

OpenEMR can be deployed directly on a WAMP or LAMP stack in IaaS, on Azure App Services, in ACI, or even AKS. It can use a local DB or one hosted by a VM directly, a container or Azure MySQL. There are many combinations of how to deploy this solution. Please feel free to submit a PR or an issue if you would like to see an alternative deployment method.

## Contributing: 

PRs and issues welcome! 