import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { performUrlFetch, setUrlFetchConfig } from "./url-fetch";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  setUrlFetchConfig({
    fetchTimeoutMs: 1_000,
    fetchTtlMs: 1_000,
    canRequestDomain: () => true,
    recordDomainFailure: vi.fn(),
    recordDomainSuccess: vi.fn(),
    getCachedValue: vi.fn().mockResolvedValue(undefined),
    setCachedValue: vi.fn().mockResolvedValue(undefined),
    makeCacheKey: (_type, input) => JSON.stringify(input),
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("url-fetch network boundary", () => {
  it("does not follow a public URL redirect into a private address", async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "http://127.0.0.1/internal" },
      }),
    );

    await expect(
      performUrlFetch("https://93.184.216.34/start"),
    ).rejects.toThrow("publicly routable");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not issue a request to a private initial address", async () => {
    await expect(
      performUrlFetch("http://169.254.169.254/latest"),
    ).rejects.toThrow("publicly routable");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
