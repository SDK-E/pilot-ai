import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const githubActionSchema = z.enum([
  'repository',
  'releases',
  'issues',
  'contributors',
  'contents',
  'search-repositories',
  'search-code',
]);

function githubHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'SDK-Pilot',
  };

  if (process.env.GITHUB_TOKEN) {
    headers.authorization =
      `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

async function githubFetch(
  path: string,
  abortSignal?: AbortSignal,
): Promise<unknown> {
  const response = await fetch(
    `https://api.github.com${path}`,
    {
      headers: githubHeaders(),
      signal: abortSignal,
    },
  );

  if (!response.ok) {
    throw new Error(
      `GitHub API ${response.status}: ${await response.text()}`,
    );
  }

  return response.json();
}

export const githubPublic = createTool({
  id: 'github-public',

  description:
    'Read public GitHub repositories, releases, issues, contributors, files, repository search, and code search. Read-only.',

  inputSchema: z.object({
    action: githubActionSchema,

    owner: z.string().optional(),
    repo: z.string().optional(),

    path: z.string().optional(),
    query: z.string().optional(),

    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20),
  }),

  outputSchema: z.object({
    data: z.unknown(),
  }),

  execute: async (
    {
      action,
      owner,
      repo,
      path,
      query,
      limit,
    },
    { abortSignal },
  ) => {
    const requireRepository = () => {
      if (!owner || !repo) {
        throw new Error(
          'owner and repo are required for this action',
        );
      }

      return {
        owner,
        repo,
      };
    };

    let data: unknown;

    switch (action) {
      case 'repository': {
        const repository = requireRepository();

        data = await githubFetch(
          `/repos/${repository.owner}/${repository.repo}`,
          abortSignal,
        );

        break;
      }

      case 'releases': {
        const repository = requireRepository();

        data = await githubFetch(
          `/repos/${repository.owner}/${repository.repo}/releases?per_page=${limit}`,
          abortSignal,
        );

        break;
      }

      case 'issues': {
        const repository = requireRepository();

        data = await githubFetch(
          `/repos/${repository.owner}/${repository.repo}/issues?state=all&per_page=${limit}`,
          abortSignal,
        );

        break;
      }

      case 'contributors': {
        const repository = requireRepository();

        data = await githubFetch(
          `/repos/${repository.owner}/${repository.repo}/contributors?per_page=${limit}`,
          abortSignal,
        );

        break;
      }

      case 'contents': {
        const repository = requireRepository();

        const encodedPath = (path ?? '')
          .split('/')
          .filter(Boolean)
          .map(encodeURIComponent)
          .join('/');

        data = await githubFetch(
          `/repos/${repository.owner}/${repository.repo}/contents/${encodedPath}`,
          abortSignal,
        );

        break;
      }

      case 'search-repositories': {
        if (!query) {
          throw new Error(
            'query is required for repository search',
          );
        }

        data = await githubFetch(
          `/search/repositories?q=${encodeURIComponent(query)}&per_page=${limit}`,
          abortSignal,
        );

        break;
      }

      case 'search-code': {
        if (!query) {
          throw new Error(
            'query is required for code search',
          );
        }

        data = await githubFetch(
          `/search/code?q=${encodeURIComponent(query)}&per_page=${limit}`,
          abortSignal,
        );

        break;
      }
    }

    return { data };
  },

  toModelOutput: (output) => ({
    type: 'text',
    value: JSON.stringify(
      output.data,
      null,
      2,
    ).slice(0, 60_000),
  }),
});