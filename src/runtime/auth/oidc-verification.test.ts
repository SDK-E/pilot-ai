import { describe, expect, test } from "vitest";
import { verifyPilotRuntimeRequest } from "./vercel-oidc";

describe("runtime OIDC", () => {
  test("rejects requests without a token", async () => {
    const response = new Request("https://pilot.test/api/runtime/activity");
    const verified = await verifyPilotRuntimeRequest(response);
    expect(verified).toBe(false);
  });

  test("rejects requests without environment", async () => {
    const response = new Request("https://pilot.test/api/runtime/activity", {
      headers: { "x-pilot-runtime-oidc-token": "dummy.token.value" },
    });
    const verified = await verifyPilotRuntimeRequest(response);
    expect(verified).toBe(false);
  });

  test("rejects token with unknown issuer", async () => {
    const response = new Request("https://pilot.test/api/runtime/activity", {
      headers: {
        "x-pilot-runtime-oidc-token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJkb25lIn0.sig",
      },
    });
    const verified = await verifyPilotRuntimeRequest(response);
    expect(verified).toBe(false);
  });

  test("rejects expired token", async () => {
    const payload = {
      iss: "https://oidc.vercel.com/sdk-enterprises",
      aud: "https://vercel.com/sdk-enterprises",
      sub: "owner:sdk-enterprises:project:pilot:environment:preview",
      exp: Math.floor(Date.now() / 1000) - 3600,
      iat: Math.floor(Date.now() / 1000) - 7200,
    };
    const token = buildUnsignedJWT(payload);
    const response = new Request("https://pilot.test/api/runtime/activity", {
      headers: {
        "x-pilot-runtime-oidc-token": token,
        "content-type": "application/json",
      },
    });
    const verified = await verifyPilotRuntimeRequest(response);
    expect(verified).toBe(false);
  });

  test("rejects token for wrong environment", async () => {
    const payload = {
      iss: "https://oidc.vercel.com/sdk-enterprises",
      aud: "https://vercel.com/sdk-enterprises",
      sub: "owner:sdk-enterprises:project:pilot:environment:development",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    };
    const token = buildUnsignedJWT(payload);
    const response = new Request("https://pilot.test/api/runtime/activity", {
      headers: {
        "x-pilot-runtime-oidc-token": token,
        "content-type": "application/json",
      },
    });
    const verified = await verifyPilotRuntimeRequest(response);
    expect(verified).toBe(false);
  });
});

function buildUnsignedJWT(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}
