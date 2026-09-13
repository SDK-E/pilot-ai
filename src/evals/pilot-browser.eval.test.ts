import { checks } from "@mastra/evals/checks";
import { beforeAll, describe, expect, it } from "vitest";

import { pilotConfig } from "../mastra/agents/base/config/index.js";
import {
  buildAnswerRelevancyScorer,
  completenessScorer,
  sourceCoverageScorer,
  taskCompletionScorer,
} from "../mastra/scorers/index.js";

import { runPilotEvals } from "./run-with-memory.js";
import { assertEvalEnvironment } from "./test-env.js";

const basicResearchData = [
  {
    input:
      "What is Mastra Observational Memory? Use current official sources and keep the answer concise.",
  },

  {
    input:
      "What are Mastra Experiments used for? Use current official sources and keep the answer concise.",
  },
];

const timeout = pilotConfig.eval.timeoutMs;

const thresholds = pilotConfig.eval.thresholds;

describe("Pilot Research Agent regression gates", () => {
  beforeAll(() => {
    assertEvalEnvironment();
  });

  it(
    "returns usable research without tool errors",
    async () => {
      const result = await runPilotEvals({
        data: basicResearchData,

        gates: [checks.noToolErrors()],
      });

      expect(result.verdict).not.toBe("failed");
    },
    timeout,
  );

  it(
    "uses web research tools",
    async () => {
      const result = await runPilotEvals({
        data: [
          {
            input:
              "Research the current Mastra Experiments API using current public sources.",
          },
        ],

        gates: [checks.calledTool("lang-search"), checks.noToolErrors()],
      });

      expect(result.verdict).not.toBe("failed");
    },
    timeout,
  );

  it(
    "meets minimum quality thresholds",
    async () => {
      const result = await runPilotEvals({
        data: basicResearchData,

        scorers: [
          {
            scorer: buildAnswerRelevancyScorer(),

            threshold: thresholds.answerRelevancy,
          },

          {
            scorer: completenessScorer,

            threshold: thresholds.completeness,
          },

          {
            scorer: sourceCoverageScorer,

            threshold: thresholds.sourceCoverage,
          },

          {
            scorer: taskCompletionScorer,

            threshold: thresholds.taskCompletion,
          },
        ],
      });

      expect(result.verdict).not.toBe("failed");
    },
    timeout,
  );
});
