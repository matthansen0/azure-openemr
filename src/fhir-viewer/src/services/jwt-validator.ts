import type { ViewerUserSession } from '../types/index.js';

export class JwtValidator {
  validateToken(authorizationHeader: string | null): ViewerUserSession {
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      throw new Error('Missing or invalid Authorization header');
    }

    const token = authorizationHeader.slice(7).trim();
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Malformed JWT token structure');
    }

    let payload: { sub?: string; oid?: string; email?: string; exp?: number };
    try {
      const payloadJson = Buffer.from(parts[1]!, 'base64').toString('utf8');
      payload = JSON.parse(payloadJson) as { sub?: string; oid?: string; email?: string; exp?: number };
    } catch {
      throw new Error('Invalid JWT payload JSON');
    }

    if (!payload.sub) {
      throw new Error('JWT payload is missing sub claim');
    }

    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) {
      throw new Error('JWT token has expired');
    }

    return {
      sub: payload.sub,
      oid: payload.oid,
      email: payload.email,
      exp: payload.exp
    };
  }
}
