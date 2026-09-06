import { describe, expect, it, vi } from 'vitest';
import { OpenEmrClient } from '../src/clients/openemr-client.js';
import type { AuthService } from '../src/services/auth-service.js';

describe('OpenEmrClient', () => {
  it('queries FHIR bundle and follows pagination next links', async () => {
    const authServiceMock = {
      getAccessToken: vi.fn().mockResolvedValue('mock-token')
    } as unknown as AuthService;

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          resourceType: 'Bundle',
          type: 'searchset',
          entry: [{ resource: { resourceType: 'Patient', id: 'p1' } }],
          link: [{ relation: 'next', url: 'https://openemr.example.test/fhir/Patient?_count=100&page=2' }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          resourceType: 'Bundle',
          type: 'searchset',
          entry: [{ resource: { resourceType: 'Patient', id: 'p2' } }]
        })
      });

    const client = new OpenEmrClient('https://openemr.example.test/fhir', authServiceMock, fetchMock as unknown as typeof fetch);
    const results = await client.fetchChangedResources<{ id: string }>('Patient');

    expect(results).toHaveLength(2);
    expect(results[0]?.id).toBe('p1');
    expect(results[1]?.id).toBe('p2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
