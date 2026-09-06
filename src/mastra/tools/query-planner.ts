import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const attemptSchema = z.object({
  query: z.string().min(1),
  resultCount: z.number().int().min(0),
  usefulCount: z.number().int().min(0).default(0),
});

const strategySchema = z.object({
  kind: z.enum(['broad', 'intent', 'primary', 'dork', 'recency']),
  query: z.string(),
  rationale: z.string(),
  score: z.number(),
});

const STOP = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'for', 'from',
  'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'please', 'the',
  'to', 'use', 'want', 'with', 'you', 'your', 'find', 'give', 'show',
]);

function keywords(value: string): string[] {
  return [...new Set(
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9+#.\-/\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOP.has(word)),
  )].slice(0, 10);
}

function compact(value: string): string {
  return keywords(value).join(' ');
}

function buildStrategies(
  objective: string,
  signals: string[],
  sites: string[],
  currentDate?: string,
) {
  const base = compact(objective);
  const signalText = signals.slice(0, 4).join(' ');
  const primarySite = sites[0];
  const year = currentDate?.slice(0, 4);

  const raw = [
    {
      kind: 'broad' as const,
      query: base,
      rationale: 'Broad discovery with only the strongest objective terms.',
      score: 1,
    },
    {
      kind: 'intent' as const,
      query: [base, signalText].filter(Boolean).join(' '),
      rationale: 'Search for explicit evidence or intent signals instead of topic similarity.',
      score: 0.95,
    },
    {
      kind: 'primary' as const,
      query: [base, primarySite ? `site:${primarySite}` : 'official'].filter(Boolean).join(' '),
      rationale: 'Bias discovery toward primary or canonical evidence.',
      score: 0.9,
    },
    {
      kind: 'dork' as const,
      query: signals.length > 0
        ? `${base} (${signals.slice(0, 3).map((item) => `"${item}"`).join(' OR ')})`
        : `"${base}"`,
      rationale: 'Use a narrow exact-signal query without over-constraining every dimension at once.',
      score: 0.85,
    },
    {
      kind: 'recency' as const,
      query: [base, year ? `after:${Number(year) - 1}-01-01` : undefined]
        .filter(Boolean)
        .join(' '),
      rationale: 'Prefer recent evidence when the objective is current or time-sensitive.',
      score: 0.8,
    },
  ];

  return raw.filter((item, index, all) =>
    item.query && all.findIndex((other) => other.query === item.query) === index,
  );
}

function adapt(
  objective: string,
  attempts: Array<z.infer<typeof attemptSchema>>,
  signals: string[],
  sites: string[],
  currentDate?: string,
) {
  const attempted = new Set(attempts.map((item) => item.query));
  const successes = attempts.filter((item) => item.usefulCount > 0 || item.resultCount > 2);

  const base = buildStrategies(objective, signals, sites, currentDate)
    .filter((item) => !attempted.has(item.query));

  if (successes.length === 0) {
    return base.map((item, index) => ({
      ...item,
      query: index === 0 ? compact(objective) : item.query,
      score: Number((item.score + 0.1).toFixed(2)),
    }));
  }

  const best = successes
    .slice()
    .sort((a, b) =>
      (b.usefulCount * 3 + b.resultCount) -
      (a.usefulCount * 3 + a.resultCount),
    )[0];

  return base.map((item) => ({
    ...item,
    rationale: `${item.rationale} Adapted after the strongest previous query: ${best.query}`,
  }));
}

export const queryPlanner = createTool({
  id: 'query-planner',
  description:
    'Plan 3-5 distinct public-web search strategies and adapt them from observed result quality. Use before broad or difficult research instead of composing one giant over-constrained query.',
  inputSchema: z.object({
    action: z.enum(['plan', 'adapt']).default('plan'),
    objective: z.string().min(3),
    signals: z.array(z.string().min(1)).default([]),
    sites: z.array(z.string().min(1)).default([]),
    currentDate: z.string().optional(),
    attempts: z.array(attemptSchema).default([]),
  }),
  outputSchema: z.object({
    strategies: z.array(strategySchema).min(1).max(5),
  }),
  execute: async (input) => ({
    strategies: (
      input.action === 'adapt'
        ? adapt(
            input.objective,
            input.attempts,
            input.signals,
            input.sites,
            input.currentDate,
          )
        : buildStrategies(
            input.objective,
            input.signals,
            input.sites,
            input.currentDate,
          )
    ).slice(0, 5),
  }),
});
