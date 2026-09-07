import { lookup } from "node:dns/promises";
import * as ipaddr from "ipaddr.js";

type ResolveAddresses = (
  hostname: string,
) => Promise<Array<{ address: string }>>;

const resolveAddresses: ResolveAddresses = (hostname) =>
  lookup(hostname, { all: true, verbatim: true });

function normalizedHostname(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "").toLowerCase();
}

export function isPublicIpAddress(address: string): boolean {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
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
  const url = value instanceof URL ? new URL(value) : new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only public HTTP(S) URLs are supported.");
  }
  if (url.username || url.password) {
    throw new Error("URLs with credentials are not supported.");
  }

  const hostname = normalizedHostname(url.hostname);
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".test") ||
    (!hostname.includes(".") && !ipaddr.isValid(hostname))
  ) {
    throw new Error("Only publicly routable hosts are supported.");
  }

  if (ipaddr.isValid(hostname)) {
    if (!isPublicIpAddress(hostname)) {
      throw new Error("Only publicly routable hosts are supported.");
    }
    return url;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await resolve(hostname);
  } catch {
    throw new Error("Could not resolve the requested public host.");
  }
  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => !isPublicIpAddress(address))
  ) {
    throw new Error("Only publicly routable hosts are supported.");
  }

  return url;
}
