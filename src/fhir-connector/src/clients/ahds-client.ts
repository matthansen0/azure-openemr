import { DefaultAzureCredential } from '@azure/identity';
import type { MappedResource } from '../services/resource-mapper.js';
import type { OperationOutcome } from '../types/index.js';

export class AhdsClient {
  private credential: DefaultAzureCredential;

  constructor(
    private readonly fhirUrl: string,
    credential?: DefaultAzureCredential,
    private readonly fetchImpl: typeof fetch = fetch
  ) {
    this.credential = credential ?? new DefaultAzureCredential();
  }

  private async getBearerToken(): Promise<string> {
    const tokenResponse = await this.credential.getToken('https://fhir.azurehealthcareapis.com/.default');
    if (!tokenResponse) {
      throw new Error('Failed to acquire Managed Identity token for AHDS FHIR service');
    }

    return tokenResponse.token;
  }

  async upsertResource(resource: MappedResource): Promise<void> {
    const bearerToken = await this.getBearerToken();
    const targetUrl = `${this.fhirUrl.replace(/\/$/, '')}/${resource.resourceType}/${resource.id}`;

    let attempts = 0;
    const maxAttempts = 4;
    let delayMs = 500;

    while (attempts < maxAttempts) {
      attempts++;
      const response = await this.fetchImpl(targetUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          'Content-Type': 'application/fhir+json',
          Accept: 'application/fhir+json'
        },
        body: JSON.stringify(resource)
      });

      if (response.status === 200 || response.status === 201) {
        return;
      }

      if (response.status === 408 || response.status === 429 || response.status >= 500) {
        if (attempts >= maxAttempts) {
          const bodyText = await response.text();
          throw new Error(`AHDS FHIR request failed after ${attempts} attempts (${response.status}): ${bodyText}`);
        }

        const retryAfterHeader = response.headers.get('Retry-After');
        if (retryAfterHeader) {
          const parsedSeconds = parseInt(retryAfterHeader, 10);
          if (!isNaN(parsedSeconds)) {
            delayMs = parsedSeconds * 1000;
          }
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2;
        continue;
      }

      let outcomeDiagnostics = '';
      try {
        const outcome = (await response.json()) as OperationOutcome;
        outcomeDiagnostics = outcome.issue.map((i) => `${i.severity}: ${i.code} ${i.diagnostics ?? ''}`).join('; ');
      } catch {
        outcomeDiagnostics = await response.text();
      }

      throw new Error(`AHDS FHIR upsert rejected (${response.status}): ${outcomeDiagnostics}`);
    }
  }
}
