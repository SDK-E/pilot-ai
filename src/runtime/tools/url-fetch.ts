import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { assertPublicHttpUrl } from "../security-public-url.js";

export type UrlFetchResult = {
  url: string;
  title?: string;
  content: string;
};

export type UrlFetchConfig = {
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
};

let urlFetchConfig: UrlFetchConfig | undefined;

export function setUrlFetchConfig(config: UrlFetchConfig): void {
  urlFetchConfig = config;
}

function requireConfig(): UrlFetchConfig {
  if (!urlFetchConfig) {
    throw new Error(
      "UrlFetch config is not set. Call setUrlFetchConfig() before using performUrlFetch.",
    );
  }

  return urlFetchConfig;
}

const AGENT_USER_AGENT =
  "SDK-Pilot-Agent/1.0 (+https://sdk.enterprises; autonomous research agent)";

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  if (!match) {
    return undefined;
  }

  return match[1]
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toMarkdown(html: string, maxCharacters: number): string {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<form[\s\S]*?<\/form>/gi, "")
    .replace(/<button[\s\S]*?<\/button>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<img[^>]*>/gi, "[image]")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, " | ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/(^|\n)-\s*\n/g, "$1")
    .trim();

  if (text.length <= maxCharacters) {
    return text;
  }

  return text.slice(0, maxCharacters);
}

export async function performUrlFetch(
  value: string,
  maxCharacters = 12_000,
  abortSignal?: AbortSignal,
): Promise<UrlFetchResult> {
  const config = requireConfig();

  let url = await assertPublicHttpUrl(value);

  if (!config.canRequestDomain(url.hostname)) {
    throw new Error(`Domain temporarily circuit-broken: ${url.hostname}`);
  }

  const cacheKey = config.makeCacheKey("url-fetch-markdown-v2", {
    url: url.toString(),
    maxCharacters,
  });

  const cached = await config.getCachedValue<UrlFetchResult>(cacheKey);

  if (cached) {
    return cached;
  }

  const timeoutController = new AbortController();

  const timeout = setTimeout(
    () => timeoutController.abort(),
    config.fetchTimeoutMs,
  );

  const onAbort = () => timeoutController.abort();

  abortSignal?.addEventListener("abort", onAbort, {
    once: true,
  });

  let failureRecorded = false;

  try {
    let response: Response | undefined;
    for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
      if (!config.canRequestDomain(url.hostname)) {
        throw new Error(`Domain temporarily circuit-broken: ${url.hostname}`);
      }
      response = await fetch(url.toString(), {
        signal: timeoutController.signal,
        redirect: "manual",
        headers: {
          "User-Agent": AGENT_USER_AGENT,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      if (response.status < 300 || response.status >= 400) break;
      const location = response.headers.get("location");
      if (!location)
        throw new Error("Redirect response did not include a location.");
      url = await assertPublicHttpUrl(new URL(location, url));
      if (redirectCount === 5) throw new Error("Too many redirects.");
    }

    if (!response || !response.ok) {
      throw new Error(`HTTP ${response?.status}: ${response?.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";

    let html: string;

    if (
      contentType.includes("text/") ||
      contentType.includes("json") ||
      contentType.includes("xml")
    ) {
      html = await response.text();
    } else {
      html = await response.text();
    }

    config.recordDomainSuccess(url.hostname);

    const title = extractTitle(html);
    const content = toMarkdown(html, maxCharacters);

    const result: UrlFetchResult = {
      url: url.toString(),
      title,
      content,
    };

    await config.setCachedValue(
      cacheKey,
      "url-fetch",
      result,
      config.fetchTtlMs,
    );

    return result;
  } catch (error) {
    if (!failureRecorded && !timeoutController.signal.aborted) {
      config.recordDomainFailure(url.hostname);
    }

    throw error;
  } finally {
    clearTimeout(timeout);

    abortSignal?.removeEventListener("abort", onAbort);
  }
}

let failureRecorded = false;

const urlFetch = createTool({
  id: "url-fetch",

  description:
    "Read a public HTTP(S) URL as Markdown using an explicit SDK Pilot agent identity.",

  inputSchema: z.object({
    url: z.string().url(),

    maxCharacters: z.number().int().min(1_000).max(50_000).default(12_000),
  }),

  outputSchema: z.object({
    url: z.string(),

    title: z.string().optional(),

    content: z.string(),
  }),

  execute: async ({ url, maxCharacters }, { abortSignal }) =>
    performUrlFetch(url, maxCharacters, abortSignal),
});
