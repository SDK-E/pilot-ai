import { fastembed } from '@mastra/fastembed';
import { Memory } from '@mastra/memory';

import { pilotConfig } from '../config';

import {
  memoryStorage,
  memoryVector,
} from './pilot-browser-storage';

import { memoryTemplate } from './templates/memory-template';

const semanticRecall =
  pilotConfig.memory.semanticRecall;

const workingMemory =
  pilotConfig.memory.workingMemory;

const observationalMemory =
  pilotConfig.memory.observational;

const observationalMemoryEnabled =
  observationalMemory.enabled &&
  process.env.PILOT_OBSERVATIONAL_MEMORY === 'true';

export const pilotBrowserMemory =
  new Memory({
    storage: memoryStorage,
    vector: memoryVector,
    embedder: fastembed,

    options: {
      lastMessages:
        pilotConfig.memory.lastMessages,

      ...(semanticRecall.enabled
        ? {
            semanticRecall: {
              scope:
                'thread' as const,

              topK:
                semanticRecall.topK,

              messageRange: {
                before:
                  semanticRecall
                    .messageRange.before,

                after:
                  semanticRecall
                    .messageRange.after,
              },
            },
          }
        : {}),

      ...(workingMemory.enabled
        ? {
            workingMemory: {
              enabled: true,

              scope:
                'thread' as const,

              template:
                memoryTemplate,
            },
          }
        : {}),

      ...(observationalMemoryEnabled
        ? {
            observationalMemory: {
              model:
                pilotConfig.model.id,

              observation: {
                messageTokens:
                  observationalMemory
                    .observation
                    .messageTokens,

                previousObserverTokens:
                  observationalMemory
                    .observation
                    .previousObserverTokens,

                bufferTokens:
                  observationalMemory
                    .observation
                    .bufferTokens,

                bufferActivation:
                  observationalMemory
                    .observation
                    .bufferActivation,

                bufferOnIdle:
                  observationalMemory
                    .observation
                    .bufferOnIdle,
              },

              reflection: {
                bufferActivation:
                  observationalMemory
                    .reflection
                    .bufferActivation,
              },
            },
          }
        : {}),
    },
  });