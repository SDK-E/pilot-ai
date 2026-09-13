import { fastembed } from "@mastra/fastembed";
import { Memory } from "@mastra/memory";

import { pilotConfig } from "../../agents/base/config/index.js";
import { memoryStorage, memoryVector } from "../../storage/development.js";

import { memoryTemplate } from "./memory-template.js";

const semanticRecall = pilotConfig.memory.semanticRecall;

const workingMemory = pilotConfig.memory.workingMemory;

const observationalMemory = pilotConfig.memory.observational;

const isObservationalMemoryEnabled =
  observationalMemory.enabled &&
  process.env.PILOT_OBSERVATIONAL_MEMORY === "true";

export const developmentMemory = new Memory({
  storage: memoryStorage,
  vector: memoryVector,
  embedder: fastembed,

  options: {
    lastMessages: pilotConfig.memory.lastMessages,

    ...(semanticRecall.enabled && {
      semanticRecall: {
        scope: "thread" as const,

        topK: semanticRecall.topK,

        messageRange: {
          before: semanticRecall.messageRange.before,

          after: semanticRecall.messageRange.after,
        },
      },
    }),

    ...(workingMemory.enabled && {
      workingMemory: {
        enabled: true,

        scope: "thread" as const,

        template: memoryTemplate,
      },
    }),

    ...(isObservationalMemoryEnabled && {
      observationalMemory: {
        model: pilotConfig.model.id,

        observation: {
          messageTokens: observationalMemory.observation.messageTokens,

          previousObserverTokens:
            observationalMemory.observation.previousObserverTokens,

          bufferTokens: observationalMemory.observation.bufferTokens,

          bufferActivation: observationalMemory.observation.bufferActivation,

          bufferOnIdle: observationalMemory.observation.bufferOnIdle,
        },

        reflection: {
          bufferActivation: observationalMemory.reflection.bufferActivation,
        },
      },
    }),
  },
});
