export const conversationRuntimeConfig = {
  modelId:
    process.env.PILOT_CONVERSATION_MODEL_ID?.trim() ||
    'kilo/kilo-auto/free',
  maxRetries: 4,
  maxSteps: 4,
  tokenLimit: 24_000,
  lastMessages: 20,
} as const;
