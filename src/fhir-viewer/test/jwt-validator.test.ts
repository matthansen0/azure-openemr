import { describe, expect, it } from 'vitest';
import { JwtValidator } from '../src/services/jwt-validator.js';

describe('JwtValidator', () => {
  it('validates a well-formed JWT token', () => {
    const validator = new JwtValidator();
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const payload = Buffer.from(JSON.stringify({ sub: 'user-oid-123', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64');
    const mockJwt = `${header}.${payload}.signature`;

    const session = validator.validateToken(`Bearer ${mockJwt}`);
    expect(session.sub).toBe('user-oid-123');
  });

  it('rejects an expired JWT token', () => {
    const validator = new JwtValidator();
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const payload = Buffer.from(JSON.stringify({ sub: 'user-oid-123', exp: Math.floor(Date.now() / 1000) - 10 })).toString('base64');
    const mockJwt = `${header}.${payload}.signature`;

    expect(() => validator.validateToken(`Bearer ${mockJwt}`)).toThrow('JWT token has expired');
  });
});
