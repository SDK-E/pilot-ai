import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createRemoteJWKSet: vi.fn((url: URL) => url.href),
  jwtVerify: vi.fn(),
}));

vi.mock("jose", () => mocks);

import { isVerifiedPilotRuntimeRequest } from "./workos-m2m.js";

const request = new Request("https://ai.pilot.test/v1/chat/completions", {
  headers: { "x-pilot-runtime-token": "signed-token" },
});

describe("isVerifiedPilotRuntimeRequest", () => {
  beforeEach(() => {
    vi.stubEnv("WORKOS_M2M_AUTHKIT_DOMAIN", "https://example.authkit.app");
    vi.stubEnv("WORKOS_M2M_CLIENT_ID", "client_expected");
    mocks.jwtVerify.mockReset();
  });

  it("accepts a token whose subject matches Pilot's client ID", async () => {
    mocks.jwtVerify.mockResolvedValue({ payload: { sub: "client_expected" } });

    await expect(isVerifiedPilotRuntimeRequest(request)).resolves.toBe(true);
    expect(mocks.jwtVerify).toHaveBeenCalledWith(
      "signed-token",
      "https://example.authkit.app/oauth2/jwks",
      { issuer: "https://example.authkit.app" },
    );
  });

  it("rejects a token whose subject is a different client", async () => {
    mocks.jwtVerify.mockResolvedValue({ payload: { sub: "client_other" } });

    await expect(isVerifiedPilotRuntimeRequest(request)).resolves.toBe(false);
  });

  it("rejects when signature verification throws", async () => {
    mocks.jwtVerify.mockRejectedValue(new Error("signature mismatch"));

    await expect(isVerifiedPilotRuntimeRequest(request)).resolves.toBe(false);
  });

  it("rejects a request with no token header", async () => {
    const bare = new Request("https://ai.pilot.test/v1/chat/completions");

    await expect(isVerifiedPilotRuntimeRequest(bare)).resolves.toBe(false);
    expect(mocks.jwtVerify).not.toHaveBeenCalled();
  });

  it("fails closed when not configured", async () => {
    vi.stubEnv("WORKOS_M2M_AUTHKIT_DOMAIN", "");

    await expect(isVerifiedPilotRuntimeRequest(request)).resolves.toBe(false);
    expect(mocks.jwtVerify).not.toHaveBeenCalled();
  });
});
