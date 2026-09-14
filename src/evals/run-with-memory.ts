import { randomUUID } from "node:crypto";

import {
  runEvals,
  type ScorerEntry,
  type MastraScorer,
} from "@mastra/core/evals";

import { pilotConfig } from "../mastra/agents/base/profiles/index.js";
import { developmentAgent } from "../mastra/development/agent.js";

const EVAL_RESOURCE_ID = "pilot-research-evals";

interface PilotEvalDataItem {
  input: string;
  groundTruth?: unknown;
}

interface PilotEvalOptions {
  data: PilotEvalDataItem[];

  gates?: MastraScorer<any, any, any, any>[];

  scorers?: ScorerEntry[];

  concurrency?: number;

  onItemComplete?: (params: {
    item: unknown;
    targetResult: unknown;

    scorerResults: Record<string, unknown>;
  }) => void | Promise<void>;
}

export async function runPilotEvals(options: PilotEvalOptions) {
  const threadId = `pilot-eval-${randomUUID()}`;

  const memory = await developmentAgent.getMemory();

  if (!memory) {
    throw new Error("Pilot Research Agent memory is not configured.");
  }

  await memory.createThread({
    threadId,

    resourceId: EVAL_RESOURCE_ID,

    title: `Pilot eval ${threadId}`,
  });

  const targetOptions = {
    memory: {
      thread: threadId,

      resource: EVAL_RESOURCE_ID,
    },
  };

  const concurrency = options.concurrency ?? pilotConfig.eval.concurrency;

  if (options.gates && options.gates.length > 0) {
    return runEvals({
      data: options.data,

      target: developmentAgent,

      targetOptions,

      gates: options.gates,

      scorers: options.scorers,

      concurrency,

      onItemComplete: options.onItemComplete as any,
    });
  }

  if (options.scorers && options.scorers.length > 0) {
    return runEvals({
      data: options.data,

      target: developmentAgent,

      targetOptions,

      scorers: options.scorers,

      concurrency,

      onItemComplete: options.onItemComplete as any,
    });
  }

  throw new Error("Pilot eval requires at least one scorer or gate.");
}
