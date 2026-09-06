import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';

export async function statusEndpointHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`statusEndpoint triggered by ${request.method}`);

  return {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    jsonBody: {
      status: 'healthy',
      component: 'fhir-connector',
      timestamp: new Date().toISOString(),
      timerEnabled: process.env['TIMER_ENABLED'] === 'true'
    }
  };
}

app.http('statusEndpoint', {
  methods: ['GET'],
  authLevel: 'function',
  handler: statusEndpointHandler
});
