import { app, type InvocationContext, type Timer } from '@azure/functions';
import { AhdsClient } from '../clients/ahds-client.js';
import { KeyVaultClient } from '../clients/key-vault-client.js';
import { OpenEmrClient } from '../clients/openemr-client.js';
import { AuthService } from '../services/auth-service.js';
import { FhirSyncService } from '../services/fhir-sync-service.js';
import { WatermarkManager } from '../services/watermark-manager.js';

export async function syncTimerHandler(myTimer: Timer, context: InvocationContext): Promise<void> {
  context.log(`syncTimer triggered, scheduleStatus: ${JSON.stringify(myTimer.scheduleStatus)}`);

  const timerEnabled = process.env['TIMER_ENABLED'] === 'true';
  if (!timerEnabled) {
    context.log('syncTimer execution skipped: TIMER_ENABLED is false');
    return;
  }

  const openemrBaseUrl = process.env['OPENEMR_BASE_URL'];
  const keyVaultUri = process.env['KEY_VAULT_URI'];
  const ahdsFhirUrl = process.env['AHDS_FHIR_URL'];

  if (!openemrBaseUrl || !keyVaultUri || !ahdsFhirUrl) {
    context.error('syncTimer misconfigured: required environment variables missing');
    return;
  }

  try {
    const kv = new KeyVaultClient(keyVaultUri);
    const clientId = await kv.getSecret('openemr-client-id');
    const privateKey = await kv.getSecret('openemr-private-key');

    const authService = new AuthService(`${openemrBaseUrl.replace(/\/$/, '')}/oauth2/default/token`, clientId, privateKey);
    const openEmrClient = new OpenEmrClient(`${openemrBaseUrl.replace(/\/$/, '')}/fhir`, authService);
    const ahdsClient = new AhdsClient(ahdsFhirUrl);
    const storageAccountUrl = process.env['AzureWebJobsStorage__tableServiceUri'] ?? '';
    const watermarkManager = new WatermarkManager(storageAccountUrl);

    const syncService = new FhirSyncService(openemrBaseUrl, openEmrClient, ahdsClient, watermarkManager);
    const statsList = await syncService.syncAll();

    for (const stats of statsList) {
      context.log(`Synced ${stats.count} ${stats.resourceType}s in ${stats.durationMs}ms`);
    }
  } catch (error) {
    context.error('syncTimer error during synchronization', error);
  }
}

app.timer('syncTimer', {
  schedule: '0 */1 * * * *',
  handler: syncTimerHandler
});
