import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { AhdsReaderClient } from '../clients/ahds-reader-client.js';

export async function patientApiHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const patientId = request.params['id'];
  if (!patientId || !/^[A-Za-z0-9.-]{1,128}$/.test(patientId)) {
    return { status: 400, jsonBody: { success: false, error: 'Invalid or missing patient ID' } };
  }

  const ahdsUrl = process.env['AHDS_FHIR_URL'];
  if (!ahdsUrl) {
    return { status: 500, jsonBody: { success: false, error: 'Viewer misconfigured: AHDS URL missing' } };
  }

  try {
    const client = new AhdsReaderClient(ahdsUrl);
    const summary = await client.getPatientSummary(patientId);
    if (!summary) {
      return { status: 404, jsonBody: { success: false, error: 'Patient not found' } };
    }

    return { status: 200, jsonBody: { success: true, data: summary } };
  } catch (error) {
    context.error('patientApiHandler error', error);
    return { status: 500, jsonBody: { success: false, error: 'Internal viewer error' } };
  }
}

export async function observationsApiHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const patientId = request.params['id'];
  if (!patientId || !/^[A-Za-z0-9.-]{1,128}$/.test(patientId)) {
    return { status: 400, jsonBody: { success: false, error: 'Invalid or missing patient ID' } };
  }

  const ahdsUrl = process.env['AHDS_FHIR_URL'];
  if (!ahdsUrl) {
    return { status: 500, jsonBody: { success: false, error: 'Viewer misconfigured: AHDS URL missing' } };
  }

  try {
    const client = new AhdsReaderClient(ahdsUrl);
    const list = await client.getPatientObservations(patientId);

    return { status: 200, jsonBody: { success: true, data: list } };
  } catch (error) {
    context.error('observationsApiHandler error', error);
    return { status: 500, jsonBody: { success: false, error: 'Internal viewer error' } };
  }
}

export async function viewerStatusHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  return {
    status: 200,
    jsonBody: {
      status: 'healthy',
      component: 'fhir-viewer',
      timestamp: new Date().toISOString()
    }
  };
}

app.http('getPatient', {
  methods: ['GET'],
  route: 'patient/{id}',
  authLevel: 'anonymous',
  handler: patientApiHandler
});

app.http('getObservations', {
  methods: ['GET'],
  route: 'patient/{id}/observations',
  authLevel: 'anonymous',
  handler: observationsApiHandler
});

app.http('viewerStatus', {
  methods: ['GET'],
  route: 'status',
  authLevel: 'function',
  handler: viewerStatusHandler
});
