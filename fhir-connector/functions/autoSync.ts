import { app, InvocationContext, Timer } from '@azure/functions';
import { OpenEMRClient } from '../src/openemr-client';
import { AHDSClient } from '../src/ahds-client';
import { FHIRSyncService } from '../src/sync-service';

/**
 * Timer-triggered Azure Function that automatically syncs FHIR resources every minute
 * This function searches for all patients modified in the last 2 minutes and syncs them with their observations
 */
export async function autoSync(myTimer: Timer, context: InvocationContext): Promise<void> {
  context.log('Auto-sync timer trigger function started at:', new Date().toISOString());

  try {
    // Initialize clients
    const openemrClient = new OpenEMRClient({
      baseUrl: process.env.OPENEMR_BASE_URL || '',
      clientId: process.env.OPENEMR_CLIENT_ID || '',
      clientSecret: process.env.OPENEMR_CLIENT_SECRET || '',
    });

    const ahdsClient = new AHDSClient({
      fhirEndpoint: process.env.AHDS_FHIR_ENDPOINT || '',
      tenantId: process.env.AHDS_TENANT_ID || '',
      clientId: process.env.AHDS_CLIENT_ID || '',
      clientSecret: process.env.AHDS_CLIENT_SECRET || '',
    });

    // Create sync service
    const syncService = new FHIRSyncService(openemrClient, ahdsClient);

    // Sync all patients (in a real production scenario, you'd filter by _lastUpdated)
    // For POC, we sync all patients every minute
    context.log('Searching for patients to sync...');
    const results = await syncService.syncPatients({});

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    context.log(`Auto-sync completed: ${successCount} succeeded, ${failureCount} failed`);

    // For each successfully synced patient, sync their observations
    for (const result of results) {
      if (result.success && result.resourceId) {
        try {
          const obsResults = await syncService.syncObservationsForPatient(result.resourceId);
          const obsSuccess = obsResults.filter(r => r.success).length;
          const obsFailed = obsResults.filter(r => !r.success).length;
          context.log(`Synced observations for Patient/${result.resourceId}: ${obsSuccess} succeeded, ${obsFailed} failed`);
        } catch (error) {
          context.error(`Failed to sync observations for Patient/${result.resourceId}:`, error);
        }
      }
    }

    context.log('Auto-sync completed successfully');
  } catch (error) {
    context.error('Auto-sync failed:', error);
    throw error;
  }
}

app.timer('autoSync', {
  schedule: '0 */1 * * * *', // Every minute
  handler: autoSync,
});
