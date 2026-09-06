import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import {
  canRequestDomain,
  getCachedValue,
  makeCacheKey,
  recordDomainFailure,
  recordDomainSuccess,
  setCachedValue,
} from '../cache';

import { pilotConfig } from '../config';

export type UrlFetchResult = {
  url: string;
  title?: string;
  content: string;
};

const AGENT_USER_AGENT =
  'SDK-Pilot-Agent/1.0 (+https://sdk.enterprises; autonomous research agent)';

function extractTitle(
  html: string,
): string | undefined {
  const match =
    html.match(
      /<title[^>]*>([\s\S]*?)<\/title>/i,
    );

  return match?.[1]
    ?.replace(
      /<[^>]+>/g,
      ' ',
    )
    .replace(
      /\s+/g,
      ' ',
    )
    .trim();
}

function decodeHtmlEntities(
  value: string,
): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(
      /&#(\d+);/g,
      (_, code: string) =>
        String.fromCodePoint(
          Number(code),
        ),
    )
    .replace(
      /&#x([0-9a-f]+);/gi,
      (_, code: string) =>
        String.fromCodePoint(
          Number.parseInt(
            code,
            16,
          ),
        ),
    );
}

function resolveHref(
  href: string,
  baseUrl: string,
): string {
  const value =
    decodeHtmlEntities(
      href,
    ).trim();

  if (
    !value ||
    value.startsWith('#') ||
    value.startsWith('mailto:') ||
    value.startsWith('tel:')
  ) {
    return value;
  }

  try {
    return new URL(
      value,
      baseUrl,
    ).toString();
  } catch {
    return value;
  }
}

function htmlToMarkdown(
  html: string,
  baseUrl: string,
): string {
  let markdown = html
    .replace(
      /<!--([\s\S]*?)-->/g,
      '',
    )
    .replace(
      /<(script|style|noscript|svg|canvas|iframe|template)[^>]*>[\s\S]*?<\/\1>/gi,
      '',
    )
    .replace(
      /<br\s*\/?\s*>/gi,
      '\n',
    )
    .replace(
      /<hr\s*\/?\s*>/gi,
      '\n\n---\n\n',
    );

  for (
    let level = 6;
    level >= 1;
    level -= 1
  ) {
    const headingPattern =
      new RegExp(
        `<h${level}[^>]*>([\\s\\S]*?)<\\/h${level}>`,
        'gi',
      );

    markdown =
      markdown.replace(
        headingPattern,
        (_, body: string) =>
          `\n\n${'#'.repeat(level)} ${body}\n\n`,
      );
  }

  markdown = markdown
    .replace(
      /<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi,
      '**$2**',
    )
    .replace(
      /<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi,
      '*$2*',
    )
    .replace(
      /<code[^>]*>([\s\S]*?)<\/code>/gi,
      '`$1`',
    )
    .replace(
      /<pre[^>]*>([\s\S]*?)<\/pre>/gi,
      (_, body: string) =>
        `\n\n\`\`\`\n${body.replace(/<[^>]+>/g, '')}\n\`\`\`\n\n`,
    )
    .replace(
      /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
      (_, href: string, body: string) => {
        const label =
          body
            .replace(
              /<[^>]+>/g,
              ' ',
            )
            .replace(
              /\s+/g,
              ' ',
            )
            .trim();

        const url =
          resolveHref(
            href,
            baseUrl,
          );

        if (!label) {
          return url;
        }

        if (!url) {
          return label;
        }

        return `[${label}](${url})`;
      },
    )
    .replace(
      /<li[^>]*>([\s\S]*?)<\/li>/gi,
      '\n- $1',
    )
    .replace(
      /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi,
      (_, body: string) =>
        `\n\n> ${body}\n\n`,
    )
    .replace(
      /<(p|article|section|main|header|footer|nav|div|ul|ol|table|tr)[^>]*>/gi,
      '\n',
    )
    .replace(
      /<\/(p|article|section|main|header|footer|nav|div|ul|ol|table|tr)>/gi,
      '\n',
    )
    .replace(
      /<[^>]+>/g,
      ' ');

  return decodeHtmlEntities(
    markdown,
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(
      /(^|\n)-\s*\n/g,
      '$1',
    )
    .trim();
}

export async function performUrlFetch(
  value: string,
  maxCharacters = 12_000,
  abortSignal?: AbortSignal,
): Promise<UrlFetchResult> {
  const url =
    new URL(value);

  if (
    ![
      'http:',
      'https:',
    ].includes(
      url.protocol,
    )
  ) {
    throw new Error(
      'Only HTTP(S) URLs are supported',
    );
  }

  if (
    !canRequestDomain(
      url.hostname,
    )
  ) {
    throw new Error(
      `Domain temporarily circuit-broken: ${url.hostname}`,
    );
  }

  const cacheKey =
    makeCacheKey(
      'url-fetch-markdown-v2',
      {
        url:
          url.toString(),

        maxCharacters,
      },
    );

  const cached =
    await getCachedValue<UrlFetchResult>(
      cacheKey,
    );

  if (cached) {
    return cached;
  }

  const timeoutController =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        timeoutController.abort(),

      pilotConfig.network
        .fetchTimeoutMs,
    );

  const onAbort = () =>
    timeoutController.abort();

  abortSignal?.addEventListener(
    'abort',
    onAbort,
    {
      once: true,
    },
  );

  let failureRecorded =
    false;

  try {
    const response =
      await fetch(
        url.toString(),
        {
          redirect:
            'follow',

          signal:
            timeoutController
              .signal,

          headers: {
            'user-agent':
              AGENT_USER_AGENT,
            accept:
              'text/html, text/markdown, application/xhtml+xml, application/json, text/plain;q=0.9, */*;q=0.5',
            'x-agent-name':
              'SDK Pilot',
            'x-agent-purpose':
              'public-web-research',
          },
        },
      );

    if (!response.ok) {
      recordDomainFailure(
        url.hostname,
      );

      failureRecorded =
        true;

      throw new Error(
        `Fetch failed ${response.status}: ${url}`,
      );
    }

    recordDomainSuccess(
      url.hostname,
    );

    const contentType =
      response.headers.get(
        'content-type',
      ) ?? '';

    const raw =
      await response.text();

    let content: string;

    if (
      contentType.includes(
        'application/json',
      )
    ) {
      try {
        content =
          `\`\`\`json\n${JSON.stringify(
            JSON.parse(raw),
            null,
            2,
          )}\n\`\`\``;
      } catch {
        content = raw;
      }
    } else if (
      contentType.includes(
        'text/markdown',
      )
    ) {
      content = raw;
    } else if (
      contentType.includes(
        'html',
      ) ||
      /<html[\s>]/i.test(raw)
    ) {
      content =
        htmlToMarkdown(
          raw,
          response.url ||
            url.toString(),
        );
    } else {
      content = raw;
    }

    const result: UrlFetchResult = {
      url:
        response.url ||
        url.toString(),

      title:
        contentType.includes(
          'html',
        )
          ? extractTitle(raw)
          : undefined,

      content:
        content.slice(
          0,
          maxCharacters,
        ),
    };

    await setCachedValue(
      cacheKey,
      'url-fetch',
      result,

      pilotConfig.cache
        .fetchTtlMs,
    );

    return result;
  } catch (error) {
    if (
      !failureRecorded &&
      !timeoutController
        .signal.aborted
    ) {
      recordDomainFailure(
        url.hostname,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);

    abortSignal
      ?.removeEventListener(
        'abort',
        onAbort,
      );
  }
}

const urlFetch =
  createTool({
    id: 'url-fetch',

    description:
      'Read a public HTTP(S) URL as Markdown using an explicit SDK Pilot agent identity.',

    inputSchema: z.object({
      url:
        z.string().url(),

      maxCharacters:
        z
          .number()
          .int()
          .min(1_000)
          .max(50_000)
          .default(12_000),
    }),

    outputSchema: z.object({
      url: z.string(),

      title:
        z.string().optional(),

      content:
        z.string(),
    }),

    execute: async (
      {
        url,
        maxCharacters,
      },
      {
        abortSignal,
      },
    ) =>
      performUrlFetch(
        url,
        maxCharacters,
        abortSignal,
      ),
  });
