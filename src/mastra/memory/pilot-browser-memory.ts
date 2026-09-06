import { fastembed } from '@mastra/fastembed';
import { Memory } from '@mastra/memory';

import {
  memoryStorage,
  memoryVector,
} from './pilot-browser-storage';

import { memoryTemplate } from './templates/memory-template';

export const pilotBrowserMemory = new Memory({
  storage: memoryStorage,
  vector: memoryVector,
  embedder: fastembed,

  options: {
    lastMessages: 30,

    semanticRecall: {
      scope: 'thread',
      topK: 8,

      messageRange: {
        before: 2,
        after: 2,
      },
    },

    workingMemory: {
      enabled: true,
      scope: 'thread',
      template: memoryTemplate,
    },

    observationalMemory: {
      model: 'kilo/kilo-auto/free',

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
});