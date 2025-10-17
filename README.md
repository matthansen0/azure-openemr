# OpenEMR on Azure
<img src="https://www.prlog.org/12704630-openemr-logo.png">

This repository contains automation to deploy [OpenEMR](https://www.open-emr.org/) on Azure. Great work being done on this project on the [OpenEMR Repo](https://github.com/openemr/openemr).

## All-in-one:
### OpenEMR+MySQL Containers with Docker Compose on an Azure IaaS Virtual Machine

[//]: # (The short URLs below are to show impact of this solution by tracking number of deployments. You can use the direct link if you wish - https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fmatthansen0%2Fazure-openemr%2Fmain%2Fall-in-one%2Fazuredeploy.json)

[![Deploy To Azure](https://raw.githubusercontent.com/Azure/azure-quickstart-templates/master/1-CONTRIBUTION-GUIDE/images/deploytoazure.svg?sanitize=true)](https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fmatthansen0%2Fazure-openemr%2Fmain%2Fall-in-one%2Fazuredeploy.json)
[![Visualize](https://raw.githubusercontent.com/Azure/azure-quickstart-templates/master/1-CONTRIBUTION-GUIDE/images/visualizebutton.svg?sanitize=true)](http://armviz.io/#/?load=https%3A%2F%2Fraw.githubusercontent.com%2Fmatthansen0%2Fazure-openemr%2Fmain%2Fall-in-one%2Fazuredeploy.json)
	

This template allows you to deploy an Ubuntu Server 22.04-LTS VM with Docker
and starts an OpenEMR container listening an port 80 which uses MySQL database running
in a separate but linked Docker container, which are created using Docker Compose. The shell script validates service functionality before finishing; the deployment typically takes about 15 minutes.

**Optional FHIR Connector and Azure Health Data Services**: This deployment template now includes optional support for deploying the FHIR connector and Azure Health Data Services (AHDS). Set the `deployFhirConnector` parameter to `true` to enable FHIR synchronization between OpenEMR and AHDS. This will deploy:
- Azure Health Data Services workspace and FHIR R4 service
- Azure Function App for the FHIR connector
- Storage Account and Application Insights for monitoring

If you don't need FHIR integration, leave `deployFhirConnector` set to `false` (default) and only the OpenEMR VM will be deployed.

This deployment will listen on HTTP/80 and HTTPS/443 (with a self-signed cert) by default and has a public IP resources associated with it, if this is for an internal deployment please [dissociate the public IP address](https://docs.microsoft.com/en-us/azure/virtual-network/remove-public-ip-address-vm) from the VM.

The ***default credentials*** for this deployment are in the [docker-compose.yml file](all-in-one/docker-compose.yml) and by default the login for OpenEMR is ``admin/openEMRonAzure!``. You can change these credentials using the steps below.

``go to administration->Users and you need to provide "Your Password:" - The password of the current user logged in. "User`s New Password:" - The new password to be changed.`` 

You may also want to [change the MySQL Credentials](https://www.mysqltutorial.org/mysql-changing-password.aspx) and update them in OpenEMR ``In order to change the mysql user and password you need to provide the correct credentials in the file sqlconf.php, which can be found under /sites/default/sqlconf.php``.

## Deploying with a Custom Branch

When using the **Deploy to Azure** button, you will be prompted for a `branch` parameter. Enter `main` to deploy the production branch, or `dev` to deploy the development branch. This allows you to deploy from any branch without modifying the code or template files.

If you do not see the prompt for `branch`, ensure that the `branch` parameter is not set in the `azuredeploy.parameters.json` file (this is the default in this repository).

## IaaS Web & PaaS DB:
### Deployment of OpenEMR Docker Container to an Azure IaaS Virtual Machine + Azure MySQL

This section has yet to be developed, feel free to submit a PR!


## ACI + PaaS DB:
###  Deployment of OpenEMR Docker on ACI + Azure MySQL

This section has yet to be developed, feel free to submit a PR!

## Other Deployment Options

OpenEMR can be deployed directly on a WAMP or LAMP stack in IaaS, on Azure App Services, in ACI, or even AKS. It can use a local DB or one hosted by a VM directly, a container or Azure MySQL. There are many combinations of how to deploy this solution. Please feel free to submit a PR or an issue if you would like to see an alternative deployment method.

## FHIR Connector for Azure Health Data Services:
### Integration between OpenEMR FHIR API and Azure Health Data Services (AHDS)

The FHIR connector enables synchronization of FHIR R4 resources from OpenEMR to Azure Health Data Services. This POC implementation demonstrates:
- OAuth2 authentication with OpenEMR FHIR API
- Azure AD authentication with AHDS
- Patient and Observation resource synchronization
- Retry logic for transient failures
- Comprehensive logging and monitoring

**Key Features:**
- Azure Function-based connector (serverless, scalable)
- Secure credential management (supports managed identity and Key Vault)
- Production-ready ARM templates for deployment
- Extensible architecture for additional FHIR resources

**Quick Start:**

The FHIR Connector can now be deployed as part of the unified "Deploy to Azure" deployment (see [All-in-one](#all-in-one) section above). Simply set the `deployFhirConnector` parameter to `true` when deploying.

Alternatively, you can deploy the FHIR connector standalone. See the [FHIR Connector README](fhir-connector/README.md) for detailed setup and configuration instructions.

**Standalone Deployment:**

Deploy the connector using Azure Resource Manager templates:

```bash
cd fhir-connector/deployment
az group create --name openemr-fhir-rg --location eastus
az deployment group create \
  --resource-group openemr-fhir-rg \
  --template-file function-app.json \
  --parameters function-app.parameters.json
```

See [deployment guide](fhir-connector/deployment/README.md) for complete deployment instructions.

**Post-Deployment Configuration:**

After deploying with the FHIR connector enabled, you'll need to:
1. Configure OpenEMR API client credentials (see [FHIR Connector README](fhir-connector/README.md))
2. Configure Azure AD app registration for AHDS authentication
3. Set the required environment variables in the Function App
4. Deploy the function code using Azure Functions Core Tools

See the [FHIR Connector README](fhir-connector/README.md) for detailed configuration steps.

## Contributing:

PRs and issues welcome!