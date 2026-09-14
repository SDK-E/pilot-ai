import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { assertPublicHttpUrl } from "../../security/public-url.js";

import { AGENT_USER_AGENT } from "./url-fetch.js";

const sitePageSchema = z.object({
  url: z.string(),
  source: z.enum(["robots", "sitemap", "homepage"]),
});

type SitePage = z.infer<typeof sitePageSchema>;

const FETCH_TIMEOUT_MS = 15_000;
const MAX_SITEMAPS = 10;

/**
 * Fetches a public URL as text; any failure (including a non-public target)
 * yields `undefined` because discovery is best-effort.
 */
async function fetchText(url: string): Promise<string | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, FETCH_TIMEOUT_MS);
  try {
    const target = await assertPublicHttpUrl(url);
    const response = await fetch(target.href, {
      signal: controller.signal,
      headers: { "user-agent": AGENT_USER_AGENT },
    });
    return response.ok ? await response.text() : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

function sitemapLocations(robots: string): string[] {
  return robots
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.toLowerCase().startsWith("sitemap:"))
    .map((line) => line.slice(line.indexOf(":") + 1).trim())
    .filter(Boolean);
}

function xmlLocations(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>([^<]*)<\/loc>/gi), (match) =>
    match[1].trim(),
  ).filter(Boolean);
}

function homepageLinks(html: string, base: URL): string[] {
  const results = new Set<string>();
  for (const match of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    try {
      const url = new URL(match[1], base);
      if (url.origin === base.origin) {
        url.hash = "";
        results.add(url.href);
      }
    } catch {
      // Ignore malformed links.
    }
  }
  return [...results];
}

/**
 * Collects unique pages up to a limit.
 */
class PageCollector {
  private readonly seen = new Set<string>();
  private readonly pages: SitePage[] = [];

  constructor(private readonly limit: number) {}

  get isFull(): boolean {
    return this.pages.length >= this.limit;
  }

  add(url: string, source: SitePage["source"]): void {
    if (this.isFull || this.seen.has(url)) return;
    this.seen.add(url);
    this.pages.push({ url, source });
  }

  addAll(urls: Iterable<string>, source: SitePage["source"]): void {
    for (const url of urls) {
      if (this.isFull) return;
      this.add(url, source);
    }
  }

  list(): SitePage[] {
    return [...this.pages];
  }
}

function validUrls(candidates: string[]): string[] {
  return candidates.flatMap((candidate) => {
    try {
      return [new URL(candidate).href];
    } catch {
      return [];
    }
  });
}

async function collectSitemapPages(
  collector: PageCollector,
  sitemaps: string[],
): Promise<void> {
  for (const sitemapUrl of sitemaps.slice(0, MAX_SITEMAPS)) {
    if (collector.isFull) return;
    const xml = await fetchText(sitemapUrl);
    if (xml) collector.addAll(validUrls(xmlLocations(xml)), "sitemap");
  }
}

async function collectHomepagePages(
  collector: PageCollector,
  base: URL,
): Promise<void> {
  if (collector.isFull) return;
  const homepage = await fetchText(base.href);
  if (homepage) collector.addAll(homepageLinks(homepage, base), "homepage");
}

export const siteDiscovery = createTool({
  id: "site-discovery",

  description:
    "Discover useful pages on a public website through robots.txt, sitemaps, and same-origin homepage links.",

  inputSchema: z.object({
    url: z.url(),
    maxPages: z.number().int().min(1).max(200).default(50),
  }),

  outputSchema: z.object({
    origin: z.string(),
    pages: z.array(sitePageSchema),
  }),

  execute: async (inputData) => {
    const target = await assertPublicHttpUrl(inputData.url);
    const base = new URL(target.origin);
    const collector = new PageCollector(inputData.maxPages);

    const robotsUrl = new URL("/robots.txt", base).href;
    const robots = (await fetchText(robotsUrl)) ?? "";
    if (robots) collector.add(robotsUrl, "robots");

    const sitemaps = sitemapLocations(robots);
    await collectSitemapPages(
      collector,
      sitemaps.length > 0 ? sitemaps : [new URL("/sitemap.xml", base).href],
    );
    await collectHomepagePages(collector, base);

    return { origin: base.origin, pages: collector.list() };
  },
});
