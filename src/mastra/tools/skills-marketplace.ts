import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const SKILLS_API =
  'https://skills.sh/api/v1';

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

type SkillSummary =
  z.infer<typeof skillSummarySchema>;

type SkillsSearchResponse = {
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

function getOidcToken(): string {
  const token =
    process.env.VERCEL_OIDC_TOKEN;

  if (!token) {
    throw new Error(
      'VERCEL_OIDC_TOKEN is not configured. Enable Vercel OIDC Federation for this project so Pilot can access the skills.sh API at runtime.',
    );
  }

  return token;
}

async function skillsRequest<T>(
  path: string,
  abortSignal?: AbortSignal,
): Promise<T> {
  const response =
    await fetch(
      `${SKILLS_API}${path}`,
      {
        signal:
          abortSignal,
        headers: {
          authorization:
            `Bearer ${getOidcToken()}`,
          accept:
            'application/json',
          'user-agent':
            'SDK-Pilot-Agent/1.0 (+https://sdk.enterprises; autonomous research agent)',
          'x-agent-name':
            'SDK Pilot',
          'x-agent-purpose':
            'runtime-skill-discovery',
        },
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

    if (
      !isInstructionFile(path)
    ) {
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

export const skillsMarketplace =
  createTool({
    id: 'skills-marketplace',

    description:
      'Search skills.sh and load relevant agent skills directly into the current run without installing them. Use when specialized procedural knowledge would materially improve the task. Only instruction/reference files are loaded; executable files are never installed or executed.',

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
        }),
      ],
    ),

    outputSchema: z.union([
      z.object({
        action:
          z.literal('search'),
        skills: z.array(
          skillSummarySchema,
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
        audits: z.array(
          auditSchema,
        ),
        loadedFiles: z.array(
          loadedFileSchema,
        ),
        skippedFiles:
          z.array(z.string()),
      }),
    ]),

    execute: async (
      input,
      {
        abortSignal,
      },
    ) => {
      if (
        input.action === 'search'
      ) {
        const params =
          new URLSearchParams({
            q: input.query,
            limit:
              String(input.limit),
          });

        const response =
          await skillsRequest<SkillsSearchResponse>(
            `/skills/search?${params.toString()}`,
            abortSignal,
          );

        const skills =
          parseSearchResults(
            response.data,
          )
            .filter(
              (skill) =>
                !skill.isDuplicate,
            )
            .slice(
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
      ] =
        await Promise.all([
          skillsRequest<SkillDetailResponse>(
            `/skills/${encodedId}`,
            abortSignal,
          ),
          skillsRequest<SkillAuditResponse>(
            `/skills/audit/${encodedId}`,
            abortSignal,
          ).catch(() => ({
            audits: [],
          })),
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

      return {
        action:
          'load' as const,
        id:
          typeof detail.id ===
          'string'
            ? detail.id
            : input.id,
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
        audits,
        loadedFiles,
        skippedFiles,
      };
    },

    toModelOutput: (output) => {
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
                      `${index + 1}. ${skill.name} — ${skill.id} — ${skill.installs} installs`,
                  )
                  .join('\n'),
        };
      }

      return {
        type: 'text',
        value: [
          `Loaded runtime skill ${output.id}.`,
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