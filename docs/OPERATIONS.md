# Operations Runbook

## Deployment

Deploy using the Azure Developer CLI from within the dev container:

```powershell
az login --use-device-code
azd auth login --use-device-code
azd up
```

## Health Checks and Probes

- **Connector Health Probe**: `GET /api/statusEndpoint?code=<function-key>` on connector app.
- **Viewer Health Probe**: `GET /api/status?code=<function-key>` on viewer app.

## Monitoring

- **Log Analytics**: Application Insights traces for `syncTimer` and `viewer-api`.
- **Metrics**: `PatientsProcessed`, `ObservationsProcessed`, `SyncDurationMs`.

## Teardown

```powershell
azd down --force --purge
```
