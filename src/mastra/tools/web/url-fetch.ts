import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { assertPublicHttpUrl } from "../../security/public-url.js";

export interface UrlFetchResult {
  url: string;
  title?: string;
  content: string;
}

export interface UrlFetchConfig {
  fetchTimeoutMs: number;
  fetchTtlMs: number;
  canRequestDomain: (hostname: string) => boolean;
  recordDomainFailure: (hostname: string) => void;
  recordDomainSuccess: (hostname: string) => void;
  getCachedValue: <T>(key: string) => Promise<T | undefined>;
  setCachedValue: (
    key: string,
    type: string,
    value: unknown,
    ttlMs: number,
  ) => Promise<void>;
  makeCacheKey: (type: string, input: unknown) => string;
}

const configured: { config?: UrlFetchConfig } = {};

export function setUrlFetchConfig(config: UrlFetchConfig): void {
  configured.config = config;
}

function requireConfig(): UrlFetchConfig {
  if (!configured.config) {
    throw new Error(
      "UrlFetch config is not set. Call setUrlFetchConfig() before using performUrlFetch.",
    );
  }
  return configured.config;
}

export const AGENT_USER_AGENT =
  "SDK-Pilot-Agent/1.0 (+https://sdk.enterprises; Pilot agent)";

const MAX_REDIRECTS = 5;

const DROPPED_ELEMENTS = [
  "script",
  "style",
  "nav",
  "footer",
  "header",
  "aside",
  "form",
  "button",
  "svg",
];

function extractTitle(html: string): string | undefined {
  const match = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  return match
    ? decodeEntities(match[1]).replaceAll(/\s+/g, " ").trim()
    : undefined;
}

function decodeEntities(value: string): string {
  return value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function toMarkdown(html: string, maxCharacters: number): string {
  let text = html;
  for (const element of DROPPED_ELEMENTS) {
    text = text.replaceAll(
      new RegExp(`<${element}[^>]*>[^]*?</${element}>`, "gi"),
      "",
    );
  }
  text = text
    .replaceAll(/<img[^>]*>/gi, "[image]")
    .replaceAll(/<br\s*\/?>/gi, "\n")
    .replaceAll(/<\/p>/gi, "\n\n")
    .replaceAll(/<\/(?:li|tr)>/gi, "\n")
    .replaceAll(/<\/td>/gi, " | ")
    .replaceAll(/<[^<>]*>/g, " ");
  return decodeEntities(text)
    .replaceAll(/\n{3,}/g, "\n\n")
    .replaceAll(/(^|\n)-\s*\n/g, "$1")
    .trim()
    .slice(0, maxCharacters);
}

/**
 * Fetches with manual redirects so every hop passes the public-URL boundary.
 */
async function fetchFollowingRedirects(
  start: URL,
  config: UrlFetchConfig,
  signal: AbortSignal,
): Promise<{ response: Response; url: URL }> {
  let url = start;
  for (let redirectCount = 0; ; redirectCount += 1) {
    if (!config.canRequestDomain(url.hostname)) {
      throw new Error(`Domain temporarily circuit-broken: ${url.hostname}`);
    }
    const response = await fetch(url.href, {
      signal,
      redirect: "manual",
      headers: {
        "User-Agent": AGENT_USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    const isRedirect = response.status >= 300 && response.status < 400;
    if (!isRedirect) return { response, url };
    const location = response.headers.get("location");
    if (!location) {
      throw new Error("Redirect response did not include a location.");
    }
    if (redirectCount === MAX_REDIRECTS) throw new Error("Too many redirects.");
    url = await assertPublicHttpUrl(new URL(location, url));
  }
}

async function fetchPage(
  url: URL,
  maxCharacters: number,
  config: UrlFetchConfig,
  abortSignal?: AbortSignal,
): Promise<UrlFetchResult> {
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => {
    timeoutController.abort();
  }, config.fetchTimeoutMs);
  const onAbort = () => {
    timeoutController.abort();
  };
  abortSignal?.addEventListener("abort", onAbort, { once: true });

  try {
    const fetched = await fetchFollowingRedirects(
      url,
      config,
      timeoutController.signal,
    );
    if (!fetched.response.ok) {
      throw new Error(
        `HTTP ${fetched.response.status}: ${fetched.response.statusText}`,
      );
    }
    const html = await fetched.response.text();
    config.recordDomainSuccess(fetched.url.hostname);
    return {
      url: fetched.url.href,
      title: extractTitle(html),
      content: toMarkdown(html, maxCharacters),
    };
  } catch (error) {
    if (!timeoutController.signal.aborted) {
      config.recordDomainFailure(url.hostname);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    abortSignal?.removeEventListener("abort", onAbort);
  }
}

export async function performUrlFetch(
  value: string,
  maxCharacters = 12_000,
  abortSignal?: AbortSignal,
): Promise<UrlFetchResult> {
  const config = requireConfig();
  const url = await assertPublicHttpUrl(value);
  const cacheKey = config.makeCacheKey("url-fetch-markdown-v2", {
    url: url.href,
    maxCharacters,
  });
  const cached = await config.getCachedValue<UrlFetchResult>(cacheKey);
  if (cached) return cached;

  const result = await fetchPage(url, maxCharacters, config, abortSignal);
  await config.setCachedValue(cacheKey, "url-fetch", result, config.fetchTtlMs);
  return result;
}

export const urlFetch = createTool({
  id: "url-fetch",

  description:
    "Read a public HTTP(S) URL as Markdown using an explicit SDK Pilot agent identity.",

  inputSchema: z.object({
    url: z.url(),
    maxCharacters: z.number().int().min(1000).max(50_000).default(12_000),
  }),

  outputSchema: z.object({
    url: z.string(),
    title: z.string().optional(),
    content: z.string(),
  }),

  execute: async ({ url, maxCharacters }, { abortSignal }) =>
    performUrlFetch(url, maxCharacters, abortSignal),
});
