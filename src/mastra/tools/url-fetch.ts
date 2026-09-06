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

function extractTitle(
  html: string,
): string | undefined {
  const match =
    html.match(
      /<title[^>]*>([\s\S]*?)<\/title>/i,
    );

  return match?.[1]
    ?.replace(
      /\s+/g,
      ' ',
    )
    .trim();
}

function htmlToText(
  html: string,
): string {
  return html
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      ' ',
    )
    .replace(
      /<style[\s\S]*?<\/style>/gi,
      ' ',
    )
    .replace(
      /<[^>]+>/g,
      ' ',
    )
    .replace(
      /&nbsp;/gi,
      ' ',
    )
    .replace(
      /&amp;/gi,
      '&',
    )
    .replace(
      /&lt;/gi,
      '<',
    )
    .replace(
      /&gt;/gi,
      '>',
    )
    .replace(
      /&quot;/gi,
      '"',
    )
    .replace(
      /&#39;/gi,
      "'",
    )
    .replace(
      /\s+/g,
      ' ',
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
      'url-fetch',
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
              'Mozilla/5.0 (compatible; PilotResearch/1.0)',
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
          JSON.stringify(
            JSON.parse(raw),
            null,
            2,
          );
      } catch {
        content = raw;
      }
    } else if (
      contentType.includes(
        'html',
      )
    ) {
      content =
        htmlToText(raw);
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

export const urlFetch =
  createTool({
    id: 'url-fetch',

    description:
      'Fetch and extract readable content from a public HTTP(S) URL.',

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