import { createSign, randomUUID } from 'node:crypto';
import type { TokenResponse } from '../types/index.js';

export class AuthService {
  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    private readonly tokenEndpoint: string,
    private readonly clientId: string,
    private readonly privateKeyPem: string
  ) {}

  private base64UrlEncode(data: string | Buffer): string {
    const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    return buf
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  createClientAssertion(): string {
    const now = Math.floor(Date.now() / 1000);
    const header = {
      alg: 'RS384',
      typ: 'JWT'
    };

    const payload = {
      iss: this.clientId,
      sub: this.clientId,
      aud: this.tokenEndpoint,
      jti: randomUUID(),
      exp: now + 300,
      iat: now
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    const signer = createSign('SHA384');
    signer.update(signingInput);
    signer.end();

    const signature = signer.sign(this.privateKeyPem);
    const encodedSignature = this.base64UrlEncode(signature);

    return `${signingInput}.${encodedSignature}`;
  }

  async getAccessToken(fetchImpl: typeof fetch = fetch): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && now < this.tokenExpiresAt - 10_000) {
      return this.cachedToken;
    }

    const assertion = this.createClientAssertion();
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: assertion,
      scope: 'system/Patient.rs system/Observation.rs'
    });

    const response = await fetchImpl(this.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenEMR OAuth token request failed (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as TokenResponse;
    this.cachedToken = data.access_token;
    this.tokenExpiresAt = now + (data.expires_in ?? 60) * 1000;

    return this.cachedToken;
  }
}
