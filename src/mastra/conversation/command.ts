import { z } from 'zod';

import { conversationRuntimeConfig } from './config';

const resourcePrefix = 'pilot-conversation';

export const generateConversationReplySchema = z
  .object({
    organizationId: z.string().min(1).max(255),
    worker: z.object({
      id: z.uuid(),
      instructions: z.string().min(1).max(20_000),
      modelId: z.literal(conversationRuntimeConfig.modelId),
    }),
    conversationId: z.uuid(),
    message: z.string().min(1).max(10_000),
    allowedToolIds: z.array(z.string()).max(0).default([]),
  })
  .strict();

export type GenerateConversationReply = z.infer<
  typeof generateConversationReplySchema
>;

export function createConversationResourceId(
  organizationId: string,
  workerId: string,
): string {
  return [resourcePrefix, organizationId, workerId].join(':');
}
