import { describe, expect, it, vi } from 'vitest';
import { AhdsReaderClient } from '../src/clients/ahds-reader-client.js';

describe('AhdsReaderClient', () => {
  it('queries Patient summary and strips non-whitelisted fields', async () => {
    const credentialMock = {
      getToken: vi.fn().mockResolvedValue({ token: 'mock-reader-token' })
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'patient-123',
        gender: 'female',
        birthDate: '1980-01-01',
        name: [{ text: 'Jane Doe' }]
      })
    });

    const client = new AhdsReaderClient('https://ahds.example.test/fhir', credentialMock as unknown as never, fetchMock as unknown as typeof fetch);
    const summary = await client.getPatientSummary('patient-123');

    expect(summary).toEqual({
      id: 'patient-123',
      name: 'Jane Doe',
      gender: 'female',
      birthDate: '1980-01-01'
    });
  });
});
