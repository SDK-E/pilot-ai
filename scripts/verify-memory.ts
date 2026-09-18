import "dotenv/config";

import { randomUUID } from "node:crypto";

import { PILOT_CONVERSATION_MODEL_ID } from "../src/contracts/conversation.js";
import { createPilotRuntime } from "../src/mastra/agents/runtime/runtime.js";
import { getPilotRuntimeStorageConfig } from "../src/mastra/storage/runtime.js";

const storageConfig = getPilotRuntimeStorageConfig();

if (!storageConfig) {
  throw new Error("DATABASE_URL is required.");
}

const memoryCode = `pilot-memory-${randomUUID()}`;
const command = {
  organizationId: "org_runtime_verification",
  worker: {
    id: randomUUID(),
    instructions:
      "Answer concisely. Follow direct user requests about this conversation.",
    modelId: PILOT_CONVERSATION_MODEL_ID,
  },
  conversationId: randomUUID(),
  message: `Remember this exact verification code for this conversation: ${memoryCode}.`,
  baseAgentId: "chat" as const,
  allowedToolIds: [],
  executionId: randomUUID(),
};

const firstRuntime = createPilotRuntime(storageConfig);

try {
  await firstRuntime.generate(command);
} finally {
  await firstRuntime.close();
}

const secondRuntime = createPilotRuntime(storageConfig);

try {
  const response = await secondRuntime.generate({
    ...command,
    message: "What exact verification code did I ask you to remember?",
  });

  if (response.kind !== "completed" || !response.text.includes(memoryCode)) {
    throw new Error("The second runtime did not recall the first message.");
  }

  console.log("Two-process Pilot Conversation memory verification passed.");
} finally {
  await secondRuntime.deleteConversation({
    organizationId: command.organizationId,
    workerId: command.worker.id,
    conversationId: command.conversationId,
  });
  await secondRuntime.close();
}
