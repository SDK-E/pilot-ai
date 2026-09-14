import { lookup } from "node:dns/promises";

import * as ipaddr from "ipaddr.js";

type ResolveAddresses = (hostname: string) => Promise<{ address: string }[]>;

const resolveAddresses: ResolveAddresses = (hostname) =>
  lookup(hostname, { all: true, verbatim: true });

const LOCAL_SUFFIXES = [".localhost", ".local", ".internal", ".test"];

function normalizedHostname(hostname: string): string {
  return hostname.replaceAll(/^\[|\]$/g, "").toLowerCase();
}

export function isPublicIpAddress(address: string): boolean {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
  }
}

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    LOCAL_SUFFIXES.some((suffix) => hostname.endsWith(suffix)) ||
    (!hostname.includes(".") && !ipaddr.isValid(hostname))
  );
}

function assertSupportedUrl(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only public HTTP(S) URLs are supported.");
  }
  if (url.username || url.password) {
    throw new Error("URLs with credentials are not supported.");
  }
}

async function assertPublicAddresses(
  hostname: string,
  resolve: ResolveAddresses,
): Promise<void> {
  let addresses: { address: string }[];
  try {
    addresses = await resolve(hostname);
  } catch (error) {
    throw new Error("Could not resolve the requested public host.", {
      cause: error,
    });
  }
  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => !isPublicIpAddress(address))
  ) {
    throw new Error("Only publicly routable hosts are supported.");
  }
}

/**
 * Rejects local and non-public network targets before an agent fetches them.
 * Every DNS answer must be public so mixed DNS responses cannot bypass the
 * boundary. Call this again for each redirect target.
 */
export async function assertPublicHttpUrl(
  value: string | URL,
  resolve: ResolveAddresses = resolveAddresses,
): Promise<URL> {
  const url = new URL(value);
  assertSupportedUrl(url);

  const hostname = normalizedHostname(url.hostname);
  if (!hostname || isLocalHostname(hostname)) {
    throw new Error("Only publicly routable hosts are supported.");
  }
  if (ipaddr.isValid(hostname)) {
    if (!isPublicIpAddress(hostname)) {
      throw new Error("Only publicly routable hosts are supported.");
    }
    return url;
  }
  await assertPublicAddresses(hostname, resolve);
  return url;
}
