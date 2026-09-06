$ErrorActionPreference = 'Stop'

Write-Host "preprovision: validating the azd environment contract"
if (-not $env:AZURE_ENV_NAME) {
    throw 'AZURE_ENV_NAME is required'
}

Write-Host "preprovision: environment $env:AZURE_ENV_NAME"