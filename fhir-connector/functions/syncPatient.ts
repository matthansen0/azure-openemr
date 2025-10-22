import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { OpenEMRClient } from '../src/openemr-client';
import { AHDSClient } from '../src/ahds-client';
import { FHIRSyncService } from '../src/sync-service';

/**
 * HTTP-triggered Azure Function to sync a patient by ID
 * Usage: POST /api/sync-patient with body: { "patientId": "1" }
 */
export async function syncPatient(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('HTTP trigger function syncPatient processed a request.');

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

    // Create sync service and sync patient
    const syncService = new FHIRSyncService(openemrClient, ahdsClient);
    const result = await syncService.syncPatient(body.patientId);

    if (result.success) {
      return {
        status: 200,
        jsonBody: {
          message: `Successfully synced Patient/${result.resourceId}`,
          result,
        },
      };
    } else {
      return {
        status: 500,
        jsonBody: {
          error: `Failed to sync Patient/${result.resourceId}`,
          details: result.error,
        },
      };
    }
  } catch (error) {
    context.error('Error syncing patient:', error);
    return {
      status: 500,
      jsonBody: {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

app.http('syncPatient', {
  methods: ['POST'],
  authLevel: 'function',
  handler: syncPatient,
});
