import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../src/services/auth-service.js';

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

describe('AuthService', () => {
  it('creates valid RS384 client assertions with required claims', () => {
    const authService = new AuthService('https://openemr.example.test/token', 'client-id-123', privateKey);
    const assertion = authService.createClientAssertion();

    const parts = assertion.split('.');
    expect(parts).toHaveLength(3);

    const header = JSON.parse(Buffer.from(parts[0]!, 'base64').toString('utf8')) as { alg: string };
    expect(header.alg).toBe('RS384');

    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64').toString('utf8')) as { iss: string; aud: string };
    expect(payload.iss).toBe('client-id-123');
    expect(payload.aud).toBe('https://openemr.example.test/token');
  });

  it('fetches and caches tokens', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'mock-access-token',
        token_type: 'Bearer',
        expires_in: 3600
      })
    });

    const authService = new AuthService('https://openemr.example.test/token', 'client-id-123', privateKey);
    const token1 = await authService.getAccessToken(fetchMock as unknown as typeof fetch);
    const token2 = await authService.getAccessToken(fetchMock as unknown as typeof fetch);

    expect(token1).toBe('mock-access-token');
    expect(token2).toBe('mock-access-token');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
