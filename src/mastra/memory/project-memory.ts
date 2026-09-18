import { Memory } from "@mastra/memory";

import { PILOT_CONVERSATION_MODEL_ID } from "../../contracts/conversation.js";
import { baseAgentLimits } from "../agents/base/limits.js";

import type { PostgresStore } from "@mastra/pg";

export function createConversationMemory(storage: PostgresStore) {
  return new Memory({
    storage,
    options: { lastMessages: baseAgentLimits.lastMessages },
  });
}

/**
 * Keeps each conversation in its own thread while observations are shared
 * across the project resource. This only becomes reachable when Pilot sends a
 * server-authorized project command with shared memory enabled.
 */
export function createProjectMemory(storage: PostgresStore) {
  return new Memory({
    storage,
    options: {
      lastMessages: baseAgentLimits.lastMessages,
      observationalMemory: {
        model: PILOT_CONVERSATION_MODEL_ID,
        scope: "resource",
        observation: { bufferOnIdle: true },
      },
    },
  });
}
