import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const sitePageSchema = z.object({
  url: z.string(),
  source: z.enum([
    'robots',
    'sitemap',
    'homepage',
  ]),
});

function normalizeBaseUrl(value: string): URL {
  const url = new URL(value);

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only HTTP(S) URLs are supported');
  }

  return new URL(url.origin);
}

async function fetchText(
  url: string,
  timeoutMs = 15_000,
): Promise<string | undefined> {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs,
  );

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent':
          'Mozilla/5.0 (compatible; PilotResearch/1.0)',
      },
    });

    if (!response.ok) {
      return undefined;
    }

    return await response.text();
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

function sitemapLocations(
  robots: string,
): string[] {
  return robots
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) =>
      line.toLowerCase().startsWith('sitemap:'),
    )
    .map((line) =>
      line.slice(line.indexOf(':') + 1).trim(),
    )
    .filter(Boolean);
}

function xmlLocations(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)]
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));
}

function homepageLinks(
  html: string,
  base: URL,
): string[] {
  const results = new Set<string>();

  for (const match of html.matchAll(
    /href=["']([^"'#]+)["']/gi,
  )) {
    const href = match[1];

    if (!href) continue;

    try {
      const url = new URL(href, base);

      if (
        url.origin === base.origin &&
        ['http:', 'https:'].includes(url.protocol)
      ) {
        url.hash = '';
        results.add(url.toString());
      }
    } catch {
      // Ignore malformed links.
    }
  }

  return [...results];
}

export const siteDiscovery = createTool({
  id: 'site-discovery',

  description:
    'Discover useful pages on a public website through robots.txt, sitemaps, and same-origin homepage links.',

  inputSchema: z.object({
    url: z.string().url(),
    maxPages: z.number().int().min(1).max(200).default(50),
  }),

  outputSchema: z.object({
    origin: z.string(),
    pages: z.array(sitePageSchema),
  }),

  execute: async (inputData) => {
    const base = normalizeBaseUrl(inputData.url);

    const robotsUrl = new URL(
      '/robots.txt',
      base,
    ).toString();

    const robots =
      (await fetchText(robotsUrl)) ?? '';

    let sitemaps = sitemapLocations(robots);

    if (sitemaps.length === 0) {
      sitemaps = [
        new URL('/sitemap.xml', base).toString(),
      ];
    }

    const pages = new Map<
      string,
      z.infer<typeof sitePageSchema>
    >();

    if (robots) {
      pages.set(robotsUrl, {
        url: robotsUrl,
        source: 'robots',
      });
    }

    for (const sitemapUrl of sitemaps.slice(0, 10)) {
      const xml = await fetchText(sitemapUrl);

      if (!xml) continue;

      for (const location of xmlLocations(xml)) {
        if (pages.size >= inputData.maxPages) {
          break;
        }

        try {
          const url = new URL(location);

          pages.set(url.toString(), {
            url: url.toString(),
            source: 'sitemap',
          });
        } catch {
          // Ignore malformed sitemap entries.
        }
      }

      if (pages.size >= inputData.maxPages) {
        break;
      }
    }

    if (pages.size < inputData.maxPages) {
      const homepage =
        await fetchText(base.toString());

      if (homepage) {
        for (const url of homepageLinks(
          homepage,
          base,
        )) {
          if (pages.size >= inputData.maxPages) {
            break;
          }

          if (!pages.has(url)) {
            pages.set(url, {
              url,
              source: 'homepage',
            });
          }
        }
      }
    }

    return {
      origin: base.origin,
      pages: [...pages.values()].slice(
        0,
        inputData.maxPages,
      ),
    };
  },
});