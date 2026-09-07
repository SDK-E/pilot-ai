import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createRemoteJWKSet: vi.fn((url: URL) => url.toString()),
  decodeJwt: vi.fn(),
  jwtVerify: vi.fn(),
}));

vi.mock('jose', () => mocks);

import { verifyPilotRuntimeRequest } from './vercel-oidc.js';

const request = new Request('https://ai.pilot.test/v1/chat/completions', {
  headers: { 'x-pilot-runtime-oidc-token': 'signed-token' },
});

describe('verifyPilotRuntimeRequest', () => {
  beforeEach(() => {
    vi.stubEnv('VERCEL_ENV', 'production');
    mocks.decodeJwt.mockReset();
    mocks.jwtVerify.mockReset();
    mocks.jwtVerify.mockResolvedValue({});
  });

  it('accepts a verified team-issued Pilot production token', async () => {
    mocks.decodeJwt.mockReturnValue({
      iss: 'https://oidc.vercel.com/sdk-enterprises',
    });

    await expect(verifyPilotRuntimeRequest(request)).resolves.toBe(true);
    expect(mocks.jwtVerify).toHaveBeenCalledWith(
      'signed-token',
      'https://oidc.vercel.com/sdk-enterprises/.well-known/jwks',
      {
        issuer: 'https://oidc.vercel.com/sdk-enterprises',
        audience: 'https://vercel.com/sdk-enterprises',
        subject: 'owner:sdk-enterprises:project:pilot:environment:production',
      },
    );
  });

  it('accepts the legacy global issuer only with the same strict claims', async () => {
    mocks.decodeJwt.mockReturnValue({ iss: 'https://oidc.vercel.com' });

    await expect(verifyPilotRuntimeRequest(request)).resolves.toBe(true);
    expect(mocks.jwtVerify).toHaveBeenCalledWith(
      'signed-token',
      'https://oidc.vercel.com/.well-known/jwks',
      expect.objectContaining({
        issuer: 'https://oidc.vercel.com',
        audience: 'https://vercel.com/sdk-enterprises',
        subject: 'owner:sdk-enterprises:project:pilot:environment:production',
      }),
    );
  });

  it('fails closed for an unknown issuer before signature verification', async () => {
    mocks.decodeJwt.mockReturnValue({ iss: 'https://attacker.example' });

    await expect(verifyPilotRuntimeRequest(request)).resolves.toBe(false);
    expect(mocks.jwtVerify).not.toHaveBeenCalled();
  });
});
