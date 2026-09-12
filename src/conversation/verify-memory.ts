import "dotenv/config";

import { randomUUID } from "node:crypto";

import { createPilotConversationRuntime } from "./pilot-conversation";
import { PILOT_CONVERSATION_MODEL_ID } from "./contract";
import { getPilotRuntimeStorageConfig } from "#runtime/storage/pilot-runtime";

const storageConfig = getPilotRuntimeStorageConfig();

if (!storageConfig) {
  throw new Error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required.");
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
};

const firstRuntime = createPilotConversationRuntime(storageConfig);

try {
  await firstRuntime.generate(command);
} finally {
  await firstRuntime.close();
}

const secondRuntime = createPilotConversationRuntime(storageConfig);

try {
  const response = await secondRuntime.generate({
    ...command,
    message: "What exact verification code did I ask you to remember?",
  });

  if (!response.text.includes(memoryCode)) {
    throw new Error("The second runtime did not recall the first message.");
  }

  console.log("Two-process Pilot Conversation memory verification passed.");
} finally {
  await secondRuntime.deleteConversation(command);
  await secondRuntime.close();
}
