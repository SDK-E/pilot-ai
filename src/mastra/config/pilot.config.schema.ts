import { z } from 'zod';

export const pilotProfileSchema = z.enum([
  'fast',
  'balanced',
  'deep',
  'test',
]);

export type PilotProfile =
  z.infer<typeof pilotProfileSchema>;

export const pilotConfigSchema = z.object({
  profile: pilotProfileSchema,

  model: z.object({
    id: z.string().min(1),
    maxRetries: z.number().int().min(0),
  }),

  agent: z.object({
    main: z.object({
      maxSteps: z.number().int().positive(),
      tokenLimit: z.number().int().positive(),

      stepBudget: z.object({
        warningAt: z.number().int().nonnegative(),
        finalAt: z.number().int().nonnegative(),
      }),
    }),

    subagent: z.object({
      maxSteps: z.number().int().positive(),
      tokenLimit: z.number().int().positive(),

      stepBudget: z.object({
        warningAt: z.number().int().nonnegative(),
        finalAt: z.number().int().nonnegative(),
      }),
    }),
  }),

  memory: z.object({
    lastMessages: z.number().int().positive(),

    semanticRecall: z.object({
      enabled: z.boolean(),
      topK: z.number().int().positive(),

      messageRange: z.object({
        before: z.number().int().nonnegative(),
        after: z.number().int().nonnegative(),
      }),
    }),

    workingMemory: z.object({
      enabled: z.boolean(),
    }),

    observational: z.object({
      enabled: z.boolean(),

      observation: z.object({
        messageTokens: z.number().int().positive(),
        previousObserverTokens:
          z.number().int().nonnegative(),
        bufferTokens: z.number().min(0),
        bufferActivation:
          z.number().min(0).max(1),
        bufferOnIdle: z.boolean(),
      }),

      reflection: z.object({
        bufferActivation:
          z.number().min(0).max(1),
      }),
    }),
  }),

  cache: z.object({
    searchTtlMs:
      z.number().int().nonnegative(),

    fetchTtlMs:
      z.number().int().nonnegative(),
  }),

  network: z.object({
    fetchTimeoutMs:
      z.number().int().positive(),

    circuitBreaker: z.object({
      failureThreshold:
        z.number().int().positive(),

      blockDurationMs:
        z.number().int().positive(),
    }),
  }),

  research: z.object({
    sourceConfidenceEvery:
      z.number().int().positive(),

    taskDependencyEvery:
      z.number().int().positive(),

    entityResolutionEvery:
      z.number().int().positive(),

    recencyCheckEvery:
      z.number().int().positive(),

    contradictionCheckEvery:
      z.number().int().positive(),

    sourceDiversityEvery:
      z.number().int().positive(),

    challengeClaimEvery:
      z.number().int().positive(),

    memoryHygieneEvery:
      z.number().int().positive(),
  }),

  eval: z.object({
    concurrency:
      z.number().int().positive(),

    timeoutMs:
      z.number().int().positive(),

    maxRetries:
      z.number().int().nonnegative(),

    thresholds: z.object({
      answerRelevancy:
        z.number().min(0).max(1),

      completeness:
        z.number().min(0).max(1),

      sourceCoverage:
        z.number().min(0).max(1),

      taskCompletion:
        z.number().min(0).max(1),
    }),
  }),
});

export type PilotConfig =
  z.infer<typeof pilotConfigSchema>;