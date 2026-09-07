import { describe, expect, it } from "vitest";

import { assertPublicHttpUrl, isPublicIpAddress } from "./security-public-url";

const publicResolver = async () => [{ address: "93.184.216.34" }];

describe("public URL boundary", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "0.0.0.0",
    "::1",
    "fc00::1",
    "fe80::1",
  ])("rejects non-public IP %s", (address) => {
    expect(isPublicIpAddress(address)).toBe(false);
  });

  it("accepts a public IP", () => {
    expect(isPublicIpAddress("93.184.216.34")).toBe(true);
  });

  it("rejects local names and credential-bearing URLs before resolution", async () => {
    await expect(
      assertPublicHttpUrl("http://localhost:3000", publicResolver),
    ).rejects.toThrow("publicly routable");
    await expect(
      assertPublicHttpUrl("https://user:pass@example.com", publicResolver),
    ).rejects.toThrow("credentials");
  });

  it("rejects a hostname when any DNS answer is private", async () => {
    await expect(
      assertPublicHttpUrl("https://example.com", async () => [
        { address: "93.184.216.34" },
        { address: "10.0.0.5" },
      ]),
    ).rejects.toThrow("publicly routable");
  });

  it("accepts a publicly resolved HTTP URL", async () => {
    await expect(
      assertPublicHttpUrl("https://example.com/path", publicResolver),
    ).resolves.toMatchObject({ hostname: "example.com", pathname: "/path" });
  });
});
