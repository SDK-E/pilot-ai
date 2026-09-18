import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const githubActionSchema = z.enum([
  "repository",
  "releases",
  "issues",
  "contributors",
  "contents",
  "search-repositories",
  "search-code",
]);

type GithubAction = z.infer<typeof githubActionSchema>;

interface GithubInput {
  action: GithubAction;
  owner?: string;
  repo?: string;
  path?: string;
  query?: string;
  limit: number;
}

const state: { token?: string } = {};

/**
 * Set from the `x-pilot-github-token` header on each request (see
 * setup/web-tools.ts) — pilot-ai is never run without Pilot in front of it,
 * so this is the only source; there is no environment-variable fallback.
 */
export function setGithubToken(token: string | undefined): void {
  state.token = token;
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "SDK-Pilot",
  };
  if (state.token) {
    headers.authorization = `Bearer ${state.token}`;
  }
  return headers;
}

async function githubFetch(
  path: string,
  abortSignal?: AbortSignal,
): Promise<unknown> {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: githubHeaders(),
    signal: abortSignal,
  });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

function repositoryPath({ owner, repo }: GithubInput): string {
  if (!owner || !repo) {
    throw new Error("owner and repo are required for this action");
  }
  return `/repos/${owner}/${repo}`;
}

function searchQuery({ query }: GithubInput, what: string): string {
  if (!query) throw new Error(`query is required for ${what}`);
  return encodeURIComponent(query);
}

/**
 * The GitHub REST path for each action.
 */
const API_PATHS: Record<GithubAction, (input: GithubInput) => string> = {
  repository: (input) => repositoryPath(input),
  releases: (input) =>
    `${repositoryPath(input)}/releases?per_page=${input.limit}`,
  issues: (input) =>
    `${repositoryPath(input)}/issues?state=all&per_page=${input.limit}`,
  contributors: (input) =>
    `${repositoryPath(input)}/contributors?per_page=${input.limit}`,
  contents: (input) => {
    const encodedPath = (input.path ?? "")
      .split("/")
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    return `${repositoryPath(input)}/contents/${encodedPath}`;
  },
  "search-repositories": (input) =>
    `/search/repositories?q=${searchQuery(input, "repository search")}&per_page=${input.limit}`,
  "search-code": (input) =>
    `/search/code?q=${searchQuery(input, "code search")}&per_page=${input.limit}`,
};

export const githubPublic = createTool({
  id: "github-public",

  description:
    "Read public GitHub repositories, releases, issues, contributors, files, repository search, and code search. Read-only.",

  inputSchema: z.object({
    action: githubActionSchema,
    owner: z.string().optional(),
    repo: z.string().optional(),
    path: z.string().optional(),
    query: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(20),
  }),

  outputSchema: z.object({ data: z.unknown() }),

  execute: async (input, { abortSignal }) => ({
    data: await githubFetch(API_PATHS[input.action](input), abortSignal),
  }),

  toModelOutput: (output) => ({
    type: "text",
    value: JSON.stringify(output.data, null, 2).slice(0, 60_000),
  }),
});
