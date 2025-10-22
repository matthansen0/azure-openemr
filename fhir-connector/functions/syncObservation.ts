import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { OpenEMRClient } from '../src/openemr-client';
import { AHDSClient } from '../src/ahds-client';
import { FHIRSyncService } from '../src/sync-service';

/**
 * HTTP-triggered Azure Function to sync an observation by ID
 * Usage: POST /api/sync-observation with body: { "observationId": "1" }
 */
export async function syncObservation(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('HTTP trigger function syncObservation processed a request.');

  try {
    // Parse request body
    const body = await request.json() as { observationId?: string };
    
    if (!body || !body.observationId) {
      return {
        status: 400,
        jsonBody: {
          error: 'Missing required parameter: observationId',
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

    // Create sync service and sync observation
    const syncService = new FHIRSyncService(openemrClient, ahdsClient);
    const result = await syncService.syncObservation(body.observationId);

    if (result.success) {
      return {
        status: 200,
        jsonBody: {
          message: `Successfully synced Observation/${result.resourceId}`,
          result,
        },
      };
    } else {
      return {
        status: 500,
        jsonBody: {
          error: `Failed to sync Observation/${result.resourceId}`,
          details: result.error,
        },
      };
    }
  } catch (error) {
    context.error('Error syncing observation:', error);
    return {
      status: 500,
      jsonBody: {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

app.http('syncObservation', {
  methods: ['POST'],
  authLevel: 'function',
  handler: syncObservation,
});
