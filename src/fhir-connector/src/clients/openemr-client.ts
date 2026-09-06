import type { AuthService } from '../services/auth-service.js';
import type { FhirBundle, SupportedResourceType } from '../types/index.js';

export class OpenEmrClient {
  constructor(
    private readonly baseUrl: string,
    private readonly authService: AuthService,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async fetchChangedResources<T = unknown>(
    resourceType: SupportedResourceType,
    sinceIso?: string
  ): Promise<readonly T[]> {
    const token = await this.authService.getAccessToken(this.fetchImpl);
    const results: T[] = [];

    let nextUrl: string | null = `${this.baseUrl.replace(/\/$/, '')}/${resourceType}?_count=100`;
    if (sinceIso) {
      nextUrl += `&_lastUpdated=gt${encodeURIComponent(sinceIso)}`;
    }

    let pageCount = 0;
    const maxPages = 50;

    while (nextUrl && pageCount < maxPages) {
      pageCount++;
      const response = await this.fetchImpl(nextUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/fhir+json'
        }
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenEMR FHIR query failed for ${resourceType} (${response.status}): ${text}`);
      }

      const bundle = (await response.json()) as FhirBundle<T>;
      if (bundle.entry) {
        for (const entry of bundle.entry) {
          if (entry.resource) {
            results.push(entry.resource);
          }
        }
      }

      const nextLink = bundle.link?.find((l) => l.relation === 'next');
      nextUrl = nextLink?.url && nextLink.url !== nextUrl ? nextLink.url : null;
    }

    return results;
  }
}
