import type { LibSQLStore } from "@mastra/libsql";
import { Memory } from "@mastra/memory";

import { PILOT_CONVERSATION_MODEL_ID } from "../../conversation/contract.js";
import { conversationRuntimeConfig } from "../../conversation/config.js";

export function createConversationMemory(storage: LibSQLStore) {
  return new Memory({
    storage,
    options: { lastMessages: conversationRuntimeConfig.lastMessages },
  });
}

/**
 * Keeps each conversation in its own thread while observations are shared
 * across the project resource. This only becomes reachable when Pilot sends a
 * server-authorized project command with shared memory enabled.
 */
export function createProjectMemory(storage: LibSQLStore) {
  return new Memory({
    storage,
    options: {
      lastMessages: conversationRuntimeConfig.lastMessages,
      observationalMemory: {
        model: PILOT_CONVERSATION_MODEL_ID,
        scope: "resource",
        observation: { bufferOnIdle: true },
      },
    },
  });
}
