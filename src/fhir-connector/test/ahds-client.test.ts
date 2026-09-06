import { describe, expect, it, vi } from 'vitest';
import { AhdsClient } from '../src/clients/ahds-client.js';

describe('AhdsClient', () => {
  it('retries on 429 throttling status and succeeds on retry', async () => {
    const credentialMock = {
      getToken: vi.fn().mockResolvedValue({ token: 'mock-ahds-token' })
    };

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        status: 429,
        headers: new Headers({ 'Retry-After': '0' }),
        text: async () => 'Rate limit exceeded'
      })
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({ resourceType: 'Patient', id: 'mapped-1' })
      });

    const ahds = new AhdsClient('https://ahds.example.test/fhir', credentialMock as unknown as never, fetchMock as unknown as typeof fetch);
    await ahds.upsertResource({
      resourceType: 'Patient',
      id: 'mapped-1',
      meta: { source: 'https://openemr.example.test/fhir/Patient/p1' }
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
