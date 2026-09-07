import {
  pilotConfigSchema,
  pilotProfileSchema,
  type PilotConfig,
  type PilotProfile,
} from './pilot.config.schema.js';

const DEFAULT_MODEL =
  'kilo/kilo-auto/free';

const profiles: Record<
  PilotProfile,
  PilotConfig
> = {
  fast: {
    profile: 'fast',

    model: {
      id: DEFAULT_MODEL,
      maxRetries: 4,
    },

    agent: {
      main: {
        maxSteps: 45,
        tokenLimit: 90_000,

        stepBudget: {
          warningAt: 32,
          finalAt: 40,
        },
      },

      subagent: {
        maxSteps: 20,
        tokenLimit: 70_000,

        stepBudget: {
          warningAt: 14,
          finalAt: 18,
        },
      },
    },

    memory: {
      lastMessages: 20,

      semanticRecall: {
        enabled: true,
        topK: 5,

        messageRange: {
          before: 1,
          after: 1,
        },
      },

      workingMemory: {
        enabled: true,
      },

      observational: {
        enabled: true,

        observation: {
          messageTokens: 18_000,
          previousObserverTokens: 3_000,
          bufferTokens: 0.15,
          bufferActivation: 0.75,
          bufferOnIdle: true,
        },

        reflection: {
          bufferActivation: 0.6,
        },
      },
    },

    cache: {
      searchTtlMs: 10 * 60 * 1000,
      fetchTtlMs: 10 * 60 * 1000,
    },

    network: {
      fetchTimeoutMs: 15_000,

      circuitBreaker: {
        failureThreshold: 3,
        blockDurationMs: 60_000,
      },
    },

    research: {
      sourceConfidenceEvery: 3,
      taskDependencyEvery: 5,
      entityResolutionEvery: 5,
      recencyCheckEvery: 6,
      contradictionCheckEvery: 6,
      sourceDiversityEvery: 8,
      challengeClaimEvery: 12,
      memoryHygieneEvery: 8,
    },

    eval: {
      concurrency: 1,
      timeoutMs: 5 * 60 * 1000,
      maxRetries: 0,

      thresholds: {
        answerRelevancy: 0.6,
        completeness: 0.6,
        sourceCoverage: 0.4,
        taskCompletion: 0.7,
      },
    },
  },

  balanced: {
    profile: 'balanced',

    model: {
      id: DEFAULT_MODEL,
      maxRetries: 6,
    },

    agent: {
      main: {
        maxSteps: 100,
        tokenLimit: 120_000,

        stepBudget: {
          warningAt: 80,
          finalAt: 92,
        },
      },

      subagent: {
        maxSteps: 45,
        tokenLimit: 100_000,

        stepBudget: {
          warningAt: 34,
          finalAt: 40,
        },
      },
    },

    memory: {
      lastMessages: 25,

      semanticRecall: {
        enabled: true,
        topK: 6,

        messageRange: {
          before: 2,
          after: 2,
        },
      },

      workingMemory: {
        enabled: true,
      },

      observational: {
        enabled: true,

        observation: {
          messageTokens: 22_000,
          previousObserverTokens: 4_000,
          bufferTokens: 0.2,
          bufferActivation: 0.8,
          bufferOnIdle: true,
        },

        reflection: {
          bufferActivation: 0.55,
        },
      },
    },

    cache: {
      searchTtlMs: 5 * 60 * 1000,
      fetchTtlMs: 5 * 60 * 1000,
    },

    network: {
      fetchTimeoutMs: 20_000,

      circuitBreaker: {
        failureThreshold: 3,
        blockDurationMs: 60_000,
      },
    },

    research: {
      sourceConfidenceEvery: 2,
      taskDependencyEvery: 4,
      entityResolutionEvery: 4,
      recencyCheckEvery: 5,
      contradictionCheckEvery: 5,
      sourceDiversityEvery: 6,
      challengeClaimEvery: 8,
      memoryHygieneEvery: 6,
    },

    eval: {
      concurrency: 1,
      timeoutMs: 8 * 60 * 1000,
      maxRetries: 1,

      thresholds: {
        answerRelevancy: 0.65,
        completeness: 0.65,
        sourceCoverage: 0.5,
        taskCompletion: 0.75,
      },
    },
  },

  deep: {
    profile: 'deep',

    model: {
      id: DEFAULT_MODEL,
      maxRetries: 8,
    },

    agent: {
      main: {
        maxSteps: 180,
        tokenLimit: 140_000,

        stepBudget: {
          warningAt: 150,
          finalAt: 170,
        },
      },

      subagent: {
        maxSteps: 75,
        tokenLimit: 120_000,

        stepBudget: {
          warningAt: 60,
          finalAt: 70,
        },
      },
    },

    memory: {
      lastMessages: 30,

      semanticRecall: {
        enabled: true,
        topK: 8,

        messageRange: {
          before: 2,
          after: 2,
        },
      },

      workingMemory: {
        enabled: true,
      },

      observational: {
        enabled: true,

        observation: {
          messageTokens: 24_000,
          previousObserverTokens: 4_000,
          bufferTokens: 0.2,
          bufferActivation: 0.8,
          bufferOnIdle: true,
        },

        reflection: {
          bufferActivation: 0.5,
        },
      },
    },

    cache: {
      searchTtlMs: 5 * 60 * 1000,
      fetchTtlMs: 5 * 60 * 1000,
    },

    network: {
      fetchTimeoutMs: 20_000,

      circuitBreaker: {
        failureThreshold: 3,
        blockDurationMs: 60_000,
      },
    },

    research: {
      sourceConfidenceEvery: 1,
      taskDependencyEvery: 4,
      entityResolutionEvery: 4,
      recencyCheckEvery: 5,
      contradictionCheckEvery: 5,
      sourceDiversityEvery: 6,
      challengeClaimEvery: 8,
      memoryHygieneEvery: 6,
    },

    eval: {
      concurrency: 1,
      timeoutMs: 10 * 60 * 1000,
      maxRetries: 1,

      thresholds: {
        answerRelevancy: 0.65,
        completeness: 0.65,
        sourceCoverage: 0.5,
        taskCompletion: 0.75,
      },
    },
  },

  test: {
    profile: 'test',

    model: {
      id: DEFAULT_MODEL,
      maxRetries: 2,
    },

    agent: {
      main: {
        maxSteps: 25,
        tokenLimit: 70_000,

        stepBudget: {
          warningAt: 18,
          finalAt: 22,
        },
      },

      subagent: {
        maxSteps: 12,
        tokenLimit: 50_000,

        stepBudget: {
          warningAt: 8,
          finalAt: 10,
        },
      },
    },

    memory: {
      lastMessages: 15,

      semanticRecall: {
        enabled: true,
        topK: 4,

        messageRange: {
          before: 1,
          after: 1,
        },
      },

      workingMemory: {
        enabled: true,
      },

      observational: {
        enabled: true,

        observation: {
          messageTokens: 12_000,
          previousObserverTokens: 2_000,
          bufferTokens: 0.1,
          bufferActivation: 0.7,
          bufferOnIdle: true,
        },

        reflection: {
          bufferActivation: 0.7,
        },
      },
    },

    cache: {
      searchTtlMs: 30 * 60 * 1000,
      fetchTtlMs: 30 * 60 * 1000,
    },

    network: {
      fetchTimeoutMs: 10_000,

      circuitBreaker: {
        failureThreshold: 2,
        blockDurationMs: 30_000,
      },
    },

    research: {
      sourceConfidenceEvery: 4,
      taskDependencyEvery: 6,
      entityResolutionEvery: 6,
      recencyCheckEvery: 8,
      contradictionCheckEvery: 8,
      sourceDiversityEvery: 10,
      challengeClaimEvery: 14,
      memoryHygieneEvery: 10,
    },

    eval: {
      concurrency: 1,
      timeoutMs: 3 * 60 * 1000,
      maxRetries: 0,

      thresholds: {
        answerRelevancy: 0.55,
        completeness: 0.55,
        sourceCoverage: 0.35,
        taskCompletion: 0.65,
      },
    },
  },
};

function numberFromEnv(
  name: string,
  fallback: number,
): number {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(
      `${name} must be a number. Received: ${value}`,
    );
  }

  return parsed;
}

function booleanFromEnv(
  name: string,
  fallback: boolean,
): boolean {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  if (
    value === 'true' ||
    value === '1'
  ) {
    return true;
  }

  if (
    value === 'false' ||
    value === '0'
  ) {
    return false;
  }

  throw new Error(
    `${name} must be true, false, 1, or 0. Received: ${value}`,
  );
}

function resolveProfile(): PilotProfile {
  return pilotProfileSchema.parse(
    process.env.PILOT_PROFILE ??
      'balanced',
  );
}

function resolveConfig(): PilotConfig {
  const profile =
    resolveProfile();

  const base =
    structuredClone(
      profiles[profile],
    );

  return pilotConfigSchema.parse({
    ...base,

    model: {
      ...base.model,

      id:
        process.env
          .PILOT_MODEL ??
        base.model.id,

      maxRetries:
        numberFromEnv(
          'PILOT_MODEL_MAX_RETRIES',
          base.model.maxRetries,
        ),
    },

    agent: {
      main: {
        ...base.agent.main,

        maxSteps:
          numberFromEnv(
            'PILOT_MAIN_MAX_STEPS',
            base.agent.main.maxSteps,
          ),

        tokenLimit:
          numberFromEnv(
            'PILOT_MAIN_TOKEN_LIMIT',
            base.agent.main.tokenLimit,
          ),

        stepBudget: {
          warningAt:
            numberFromEnv(
              'PILOT_MAIN_STEP_WARNING_AT',
              base.agent.main.stepBudget
                .warningAt,
            ),

          finalAt:
            numberFromEnv(
              'PILOT_MAIN_STEP_FINAL_AT',
              base.agent.main.stepBudget
                .finalAt,
            ),
        },
      },

      subagent: {
        ...base.agent.subagent,

        maxSteps:
          numberFromEnv(
            'PILOT_SUBAGENT_MAX_STEPS',
            base.agent.subagent.maxSteps,
          ),

        tokenLimit:
          numberFromEnv(
            'PILOT_SUBAGENT_TOKEN_LIMIT',
            base.agent.subagent.tokenLimit,
          ),

        stepBudget: {
          warningAt:
            numberFromEnv(
              'PILOT_SUBAGENT_STEP_WARNING_AT',
              base.agent.subagent.stepBudget
                .warningAt,
            ),

          finalAt:
            numberFromEnv(
              'PILOT_SUBAGENT_STEP_FINAL_AT',
              base.agent.subagent.stepBudget
                .finalAt,
            ),
        },
      },
    },

    memory: {
      ...base.memory,

      lastMessages:
        numberFromEnv(
          'PILOT_MEMORY_LAST_MESSAGES',
          base.memory.lastMessages,
        ),

      semanticRecall: {
        ...base.memory.semanticRecall,

        enabled:
          booleanFromEnv(
            'PILOT_SEMANTIC_RECALL',
            base.memory.semanticRecall
              .enabled,
          ),

        topK:
          numberFromEnv(
            'PILOT_SEMANTIC_RECALL_TOP_K',
            base.memory.semanticRecall
              .topK,
          ),
      },

      workingMemory: {
        enabled:
          booleanFromEnv(
            'PILOT_WORKING_MEMORY',
            base.memory.workingMemory
              .enabled,
          ),
      },

      observational: {
        ...base.memory.observational,

        enabled:
          booleanFromEnv(
            'PILOT_OBSERVATIONAL_MEMORY',
            base.memory.observational
              .enabled,
          ),

        observation: {
          ...base.memory.observational
            .observation,

          messageTokens:
            numberFromEnv(
              'PILOT_OBSERVATION_MESSAGE_TOKENS',
              base.memory.observational
                .observation.messageTokens,
            ),

          previousObserverTokens:
            numberFromEnv(
              'PILOT_OBSERVATION_PREVIOUS_TOKENS',
              base.memory.observational
                .observation
                .previousObserverTokens,
            ),

          bufferActivation:
            numberFromEnv(
              'PILOT_OBSERVATION_BUFFER_ACTIVATION',
              base.memory.observational
                .observation
                .bufferActivation,
            ),
        },

        reflection: {
          ...base.memory.observational
            .reflection,

          bufferActivation:
            numberFromEnv(
              'PILOT_REFLECTION_BUFFER_ACTIVATION',
              base.memory.observational
                .reflection
                .bufferActivation,
            ),
        },
      },
    },

    cache: {
      searchTtlMs:
        numberFromEnv(
          'PILOT_SEARCH_CACHE_TTL_MS',
          base.cache.searchTtlMs,
        ),

      fetchTtlMs:
        numberFromEnv(
          'PILOT_FETCH_CACHE_TTL_MS',
          base.cache.fetchTtlMs,
        ),
    },

    network: {
      fetchTimeoutMs:
        numberFromEnv(
          'PILOT_FETCH_TIMEOUT_MS',
          base.network.fetchTimeoutMs,
        ),

      circuitBreaker: {
        failureThreshold:
          numberFromEnv(
            'PILOT_CIRCUIT_BREAKER_FAILURES',
            base.network.circuitBreaker
              .failureThreshold,
          ),

        blockDurationMs:
          numberFromEnv(
            'PILOT_CIRCUIT_BREAKER_BLOCK_MS',
            base.network.circuitBreaker
              .blockDurationMs,
          ),
      },
    },

    eval: {
      ...base.eval,

      concurrency:
        numberFromEnv(
          'PILOT_EVAL_CONCURRENCY',
          base.eval.concurrency,
        ),

      timeoutMs:
        numberFromEnv(
          'PILOT_EVAL_TIMEOUT_MS',
          base.eval.timeoutMs,
        ),

      maxRetries:
        numberFromEnv(
          'PILOT_EVAL_MAX_RETRIES',
          base.eval.maxRetries,
        ),
    },
  });
}

export const pilotConfig =
  resolveConfig();
