import { z } from "zod";

export const pilotProfileSchema = z.enum(["fast", "balanced", "deep", "test"]);

export type PilotProfile = z.infer<typeof pilotProfileSchema>;

const positiveInt = z.number().int().positive();

/**
 * Tuning that changes with the selected profile. Agent step limits live in
 * `agents/kinds.ts`; memory limits live in `agents/base/limits.ts`.
 */
export const pilotConfigSchema = z.object({
  profile: pilotProfileSchema,

  cache: z.object({
    searchTtlMs: z.number().int().nonnegative(),
    fetchTtlMs: z.number().int().nonnegative(),
  }),

  network: z.object({
    fetchTimeoutMs: positiveInt,
    circuitBreaker: z.object({
      failureThreshold: positiveInt,
      blockDurationMs: positiveInt,
    }),
  }),

  /**
   * How often (in agent steps) each evidence processor reminds the model.
   */
  pipeline: z.object({
    sourceConfidenceEvery: positiveInt,
    taskDependencyEvery: positiveInt,
    entityResolutionEvery: positiveInt,
    recencyCheckEvery: positiveInt,
    contradictionCheckEvery: positiveInt,
    sourceDiversityEvery: positiveInt,
    challengeClaimEvery: positiveInt,
    memoryHygieneEvery: positiveInt,
  }),
});

export type PilotConfig = z.infer<typeof pilotConfigSchema>;
