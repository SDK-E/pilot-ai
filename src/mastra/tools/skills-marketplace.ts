import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import {
  getCachedValue,
  getSkillFeedbackMap,
  makeCacheKey,
  recordSkillFeedback,
  recordSkillUse,
  setCachedValue,
  type SkillFeedbackStats,
} from '../cache';

const SKILLS_API =
  'https://skills.sh/api/v1';

const SEARCH_TTL_MS =
  15 * 60_000;

const CURATED_TTL_MS =
  60 * 60_000;

const DETAIL_TTL_MS =
  60 * 60_000;

const AUDIT_TTL_MS =
  30 * 60_000;

const skillSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  source: z.string(),
  installs: z.number().int(),
  sourceType: z.string(),
  installUrl: z
    .string()
    .nullable()
    .optional(),
  url: z.string(),
  isDuplicate: z
    .boolean()
    .optional(),
});

const rankedSkillSchema =
  skillSummarySchema.extend({
    official: z.boolean(),
    score: z.number(),
    learnedScore: z.number(),
    uses: z.number().int(),
    helpful: z.number().int(),
    unhelpful: z.number().int(),
  });

const auditSchema = z.object({
  provider: z.string(),
  status: z.string(),
  summary: z
    .string()
    .optional(),
  auditedAt: z
    .string()
    .optional(),
  riskLevel: z
    .string()
    .optional(),
});

const loadedFileSchema = z.object({
  path: z.string(),
  contents: z.string(),
});

const feedbackStatsSchema = z.object({
  skillId: z.string(),
  uses: z.number().int(),
  helpful: z.number().int(),
  unhelpful: z.number().int(),
  learnedScore: z.number(),
});

type SkillSummary =
  z.infer<typeof skillSummarySchema>;

type RankedSkill =
  z.infer<typeof rankedSkillSchema>;

type SkillsSearchResponse = {
  data?: unknown;
};

type SkillsCuratedResponse = {
  data?: unknown;
};

type SkillDetailResponse = {
  id?: unknown;
  source?: unknown;
  slug?: unknown;
  installs?: unknown;
  hash?: unknown;
  files?: unknown;
};

type SkillAuditResponse = {
  audits?: unknown;
};

async function skillsRequest<T>(
  path: string,
  abortSignal?: AbortSignal,
): Promise<T> {
  const token =
    process.env.VERCEL_OIDC_TOKEN;

  const headers: Record<string, string> = {
    accept: 'application/json',
    'user-agent':
      'SDK-Pilot-Agent/1.0 (+https://sdk.enterprises; autonomous research agent)',
    'x-agent-name':
      'SDK Pilot',
    'x-agent-purpose':
      'runtime-skill-discovery',
  };

  if (token) {
    headers.authorization =
      `Bearer ${token}`;
  }

  const response =
    await fetch(
      `${SKILLS_API}${path}`,
      {
        signal:
          abortSignal,
        headers,
      },
    );

  if (!response.ok) {
    throw new Error(
      `skills.sh ${response.status}: ${await response.text()}`,
    );
  }

  return (
    await response.json()
  ) as T;
}

async function cachedSkillsRequest<T>(
  cacheType: string,
  cacheInput: unknown,
  path: string,
  ttlMs: number,
  abortSignal?: AbortSignal,
): Promise<T> {
  const key =
    makeCacheKey(
      cacheType,
      cacheInput,
    );

  const cached =
    await getCachedValue<T>(key);

  if (cached) {
    return cached;
  }

  const value =
    await skillsRequest<T>(
      path,
      abortSignal,
    );

  await setCachedValue(
    key,
    cacheType,
    value,
    ttlMs,
  );

  return value;
}

function parseSearchResults(
  value: unknown,
): SkillSummary[] {
  const parsed =
    z.array(
      skillSummarySchema,
    ).safeParse(value);

  if (!parsed.success) {
    return [];
  }

  return parsed.data;
}

function parseCuratedIds(
  value: unknown,
): Set<string> {
  if (!Array.isArray(value)) {
    return new Set();
  }

  const ids = new Set<string>();

  for (const entry of value) {
    if (
      !entry ||
      typeof entry !== 'object'
    ) {
      continue;
    }

    const skills =
      (entry as Record<string, unknown>)
        .skills;

    if (!Array.isArray(skills)) {
      continue;
    }

    for (const skill of skills) {
      const parsed =
        skillSummarySchema.safeParse(
          skill,
        );

      if (parsed.success) {
        ids.add(parsed.data.id);
      }
    }
  }

  return ids;
}

function emptyFeedback(
  skillId: string,
): SkillFeedbackStats {
  return {
    skillId,
    uses: 0,
    helpful: 0,
    unhelpful: 0,
    learnedScore: 0,
  };
}

async function rankSkills(
  skills: SkillSummary[],
  officialIds: Set<string>,
): Promise<RankedSkill[]> {
  const maxInstalls =
    Math.max(
      ...skills.map(
        (skill) =>
          skill.installs,
      ),
      1,
    );

  const feedback =
    await getSkillFeedbackMap(
      skills.map(
        (skill) => skill.id,
      ),
    );

  return skills
    .map((skill, index) => {
      const relevance =
        1 -
        index /
          Math.max(
            skills.length,
            1,
          );

      const popularity =
        Math.log1p(
          skill.installs,
        ) /
        Math.log1p(
          maxInstalls,
        );

      const official =
        officialIds.has(
          skill.id,
        );

      const history =
        feedback.get(skill.id) ??
        emptyFeedback(skill.id);

      const score =
        relevance * 0.65 +
        popularity * 0.15 +
        (official ? 0.1 : 0) +
        history.learnedScore * 0.25;

      return {
        ...skill,
        official,
        score:
          Number(
            score.toFixed(4),
          ),
        learnedScore:
          Number(
            history.learnedScore.toFixed(4),
          ),
        uses:
          history.uses,
        helpful:
          history.helpful,
        unhelpful:
          history.unhelpful,
      };
    })
    .sort(
      (left, right) =>
        right.score -
        left.score,
    );
}

function isInstructionFile(
  path: string,
): boolean {
  const normalized =
    path.toLowerCase();

  return (
    normalized === 'skill.md' ||
    normalized.endsWith('.md') ||
    normalized.endsWith('.mdx') ||
    normalized.endsWith('.txt') ||
    normalized.endsWith('.json') ||
    normalized.endsWith('.yaml') ||
    normalized.endsWith('.yml')
  );
}

function parseLoadedFiles(
  value: unknown,
): {
  loadedFiles: Array<{
    path: string;
    contents: string;
  }>;
  skippedFiles: string[];
} {
  if (!Array.isArray(value)) {
    return {
      loadedFiles: [],
      skippedFiles: [],
    };
  }

  const loadedFiles: Array<{
    path: string;
    contents: string;
  }> = [];

  const skippedFiles: string[] = [];

  for (const item of value) {
    if (
      !item ||
      typeof item !== 'object'
    ) {
      continue;
    }

    const record =
      item as Record<
        string,
        unknown
      >;

    const path =
      typeof record.path ===
      'string'
        ? record.path
        : undefined;

    if (!path) {
      continue;
    }

    if (!isInstructionFile(path)) {
      skippedFiles.push(path);
      continue;
    }

    if (
      typeof record.contents !==
      'string'
    ) {
      continue;
    }

    loadedFiles.push({
      path,
      contents:
        record.contents,
    });
  }

  return {
    loadedFiles,
    skippedFiles,
  };
}

function parseAudits(
  value: unknown,
) {
  const parsed =
    z.array(
      auditSchema,
    ).safeParse(value);

  return parsed.success
    ? parsed.data
    : [];
}

function unsafeAudit(
  audits: Array<
    z.infer<typeof auditSchema>
  >,
): boolean {
  return audits.some(
    (audit) => {
      const status =
        audit.status
          .toLowerCase();

      const risk =
        audit.riskLevel
          ?.toLowerCase();

      return (
        status === 'fail' ||
        status === 'blocked' ||
        risk === 'critical' ||
        risk === 'high'
      );
    },
  );
}

async function getCuratedIds(
  abortSignal?: AbortSignal,
): Promise<Set<string>> {
  try {
    const response =
      await cachedSkillsRequest<SkillsCuratedResponse>(
        'skills-curated',
        'official',
        '/skills/curated',
        CURATED_TTL_MS,
        abortSignal,
      );

    return parseCuratedIds(
      response.data,
    );
  } catch {
    return new Set();
  }
}

export const skillsMarketplace =
  createTool({
    id: 'skills-marketplace',

    description:
      'Search skills.sh, load instruction-only runtime skills, and record whether a loaded skill helped. Search results are cached and reranked using marketplace relevance, official curated status, adoption, and Pilot\'s persistent skill feedback. Executable files are never installed or executed.',

    inputSchema: z.discriminatedUnion(
      'action',
      [
        z.object({
          action:
            z.literal('search'),
          query:
            z.string().min(2),
          limit:
            z
              .number()
              .int()
              .min(1)
              .max(20)
              .default(5),
        }),

        z.object({
          action:
            z.literal('load'),
          id:
            z.string().min(3),
          query:
            z.string()
              .min(2)
              .optional(),
        }),

        z.object({
          action:
            z.literal('feedback'),
          id:
            z.string().min(3),
          helpful:
            z.boolean(),
          query:
            z.string()
              .min(2)
              .optional(),
          reason:
            z.string()
              .max(500)
              .optional(),
        }),
      ],
    ),

    outputSchema: z.union([
      z.object({
        action:
          z.literal('search'),
        skills: z.array(
          rankedSkillSchema,
        ),
      }),

      z.object({
        action:
          z.literal('load'),
        id: z.string(),
        source:
          z.string().optional(),
        slug:
          z.string().optional(),
        hash:
          z.string().optional(),
        official: z.boolean(),
        audits: z.array(
          auditSchema,
        ),
        loadedFiles: z.array(
          loadedFileSchema,
        ),
        skippedFiles:
          z.array(z.string()),
      }),

      z.object({
        action:
          z.literal('feedback'),
        stats:
          feedbackStatsSchema,
      }),
    ]),

    execute: async (
      input,
      {
        abortSignal,
      },
    ) => {
      if (
        input.action === 'feedback'
      ) {
        const stats =
          await recordSkillFeedback(
            input.id,
            input.helpful,
            input.query,
            input.reason,
          );

        return {
          action:
            'feedback' as const,
          stats,
        };
      }

      if (
        input.action === 'search'
      ) {
        const normalizedQuery =
          input.query
            .trim()
            .toLowerCase();

        const candidateLimit =
          Math.min(
            Math.max(
              input.limit * 3,
              10,
            ),
            50,
          );

        const params =
          new URLSearchParams({
            q: input.query.trim(),
            limit:
              String(candidateLimit),
          });

        const [
          response,
          officialIds,
        ] =
          await Promise.all([
            cachedSkillsRequest<SkillsSearchResponse>(
              'skills-search',
              {
                query:
                  normalizedQuery,
                limit:
                  candidateLimit,
              },
              `/skills/search?${params.toString()}`,
              SEARCH_TTL_MS,
              abortSignal,
            ),
            getCuratedIds(
              abortSignal,
            ),
          ]);

        const skills =
          (
            await rankSkills(
              parseSearchResults(
                response.data,
              ).filter(
                (skill) =>
                  !skill.isDuplicate,
              ),
              officialIds,
            )
          ).slice(
            0,
            input.limit,
          );

        return {
          action:
            'search' as const,
          skills,
        };
      }

      const encodedId =
        input.id
          .split('/')
          .map(encodeURIComponent)
          .join('/');

      const [
        detail,
        auditResponse,
        officialIds,
      ] =
        await Promise.all([
          cachedSkillsRequest<SkillDetailResponse>(
            'skill-detail',
            input.id,
            `/skills/${encodedId}`,
            DETAIL_TTL_MS,
            abortSignal,
          ),
          cachedSkillsRequest<SkillAuditResponse>(
            'skill-audit',
            input.id,
            `/skills/audit/${encodedId}`,
            AUDIT_TTL_MS,
            abortSignal,
          ).catch(() => ({
            audits: [],
          })),
          getCuratedIds(
            abortSignal,
          ),
        ]);

      const audits =
        parseAudits(
          auditResponse.audits,
        );

      if (unsafeAudit(audits)) {
        throw new Error(
          `Skill ${input.id} failed marketplace security checks and was not loaded.`,
        );
      }

      const {
        loadedFiles,
        skippedFiles,
      } =
        parseLoadedFiles(
          detail.files,
        );

      if (
        !loadedFiles.some(
          (file) =>
            file.path
              .toLowerCase() ===
            'skill.md',
        )
      ) {
        throw new Error(
          `Skill ${input.id} does not expose a readable SKILL.md file.`,
        );
      }

      const id =
        typeof detail.id ===
        'string'
          ? detail.id
          : input.id;

      await recordSkillUse(
        id,
        input.query,
      );

      return {
        action:
          'load' as const,
        id,
        source:
          typeof detail.source ===
          'string'
            ? detail.source
            : undefined,
        slug:
          typeof detail.slug ===
          'string'
            ? detail.slug
            : undefined,
        hash:
          typeof detail.hash ===
          'string'
            ? detail.hash
            : undefined,
        official:
          officialIds.has(id),
        audits,
        loadedFiles,
        skippedFiles,
      };
    },

    toModelOutput: (output) => {
      if (
        output.action === 'feedback'
      ) {
        return {
          type: 'text',
          value:
            `Recorded runtime skill feedback for ${output.stats.skillId}. Learned score: ${output.stats.learnedScore.toFixed(4)}.`,
        };
      }

      if (
        output.action === 'search'
      ) {
        return {
          type: 'text',
          value:
            output.skills.length ===
            0
              ? 'No matching runtime skills were found.'
              : output.skills
                  .map(
                    (
                      skill,
                      index,
                    ) =>
                      [
                        `${index + 1}. ${skill.name}`,
                        `ID: ${skill.id}`,
                        `Score: ${skill.score}`,
                        `Learned: ${skill.learnedScore}`,
                        `Official: ${skill.official ? 'yes' : 'no'}`,
                        `Installs: ${skill.installs}`,
                        `Uses: ${skill.uses}`,
                        `Helpful: ${skill.helpful}`,
                        `Unhelpful: ${skill.unhelpful}`,
                      ].join(' — '),
                  )
                  .join('\n'),
        };
      }

      return {
        type: 'text',
        value: [
          `Loaded runtime skill ${output.id}.`,
          `Official curated skill: ${output.official ? 'yes' : 'no'}.`,
          output.loadedFiles
            .map(
              (file) =>
                `\n--- ${file.path} ---\n${file.contents}`,
            )
            .join('\n'),
          output.skippedFiles.length
            ? `\nSkipped executable/non-instruction files: ${output.skippedFiles.join(', ')}`
            : undefined,
        ]
          .filter(Boolean)
          .join('\n'),
      };
    },
  });