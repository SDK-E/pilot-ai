import { entityResolutionProcessor } from "./context/entity-resolution.js";
import { memoryHygieneProcessor } from "./context/memory-hygiene.js";
import { taskDependencyProcessor } from "./context/task-dependency.js";
import { challengeClaimProcessor } from "./quality/challenge-claim.js";
import { contradictionCheckProcessor } from "./quality/contradiction-check.js";
import { negativeClaimVerificationProcessor } from "./quality/negative-claim-verification.js";
import { recencyCheckProcessor } from "./quality/recency-check.js";
import { sourceConfidenceProcessor } from "./quality/source-confidence.js";
import { sourceDiversityProcessor } from "./quality/source-diversity.js";

import type { InputProcessorOrWorkflow } from "@mastra/core/processors";

/**
 * Processors that keep a tool-using run honest about its evidence: what a
 * source supports, whether sources disagree, how fresh they are, and which
 * entity a fact belongs to. They add nothing to a plain chat turn, so the
 * base agent attaches them only when web tools are granted.
 */
export const evidenceProcessors: readonly InputProcessorOrWorkflow[] = [
  entityResolutionProcessor,
  taskDependencyProcessor,
  sourceConfidenceProcessor,
  recencyCheckProcessor,
  contradictionCheckProcessor,
  sourceDiversityProcessor,
  challengeClaimProcessor,
  negativeClaimVerificationProcessor,
  memoryHygieneProcessor,
];
