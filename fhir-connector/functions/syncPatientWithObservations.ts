import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { OpenEMRClient } from '../src/openemr-client';
import { AHDSClient } from '../src/ahds-client';
import { FHIRSyncService } from '../src/sync-service';

/**
 * HTTP-triggered Azure Function to sync a patient and their observations
 * Usage: POST /api/sync-patient-with-observations with body: { "patientId": "1" }
 */
export async function syncPatientWithObservations(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('HTTP trigger function syncPatientWithObservations processed a request.');

  try {
    // Parse request body
    const body = await request.json() as { patientId?: string };
    
    if (!body || !body.patientId) {
      return {
        status: 400,
        jsonBody: {
          error: 'Missing required parameter: patientId',
        },
      };
    }

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
    
    // Sync patient first
    const patientResult = await syncService.syncPatient(body.patientId);
    
    // Then sync observations
    const observationResults = await syncService.syncObservationsForPatient(body.patientId);

    const allResults = [patientResult, ...observationResults];
    const successCount = allResults.filter(r => r.success).length;
    const failureCount = allResults.filter(r => !r.success).length;

    return {
      status: 200,
      jsonBody: {
        message: `Sync completed: ${successCount} succeeded, ${failureCount} failed`,
        results: allResults,
        summary: {
          total: allResults.length,
          succeeded: successCount,
          failed: failureCount,
        },
      },
    };
  } catch (error) {
    context.error('Error syncing patient with observations:', error);
    return {
      status: 500,
      jsonBody: {
        error: 'Internal server error',
        message: error.message,
      },
    };
  }
}

app.http('syncPatientWithObservations', {
  methods: ['POST'],
  authLevel: 'function',
  handler: syncPatientWithObservations,
});
