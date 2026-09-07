import { z } from 'zod';

import { conversationRuntimeConfig } from './config.js';

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
    baseAgentId: z.enum(['conversational', 'research']),
    allowedToolIds: z.array(z.literal('web-search')).max(1).default([]),
    executionId: z.uuid(),
  })
  .strict()
  .superRefine((command, context) => {
    if (command.baseAgentId === 'conversational' && command.allowedToolIds.length > 0) {
      context.addIssue({
        code: 'custom',
        message: 'Conversational requests cannot use tools.',
        path: ['allowedToolIds'],
      });
    }
  });

export type GenerateConversationReply = z.infer<
  typeof generateConversationReplySchema
>;

export function createConversationResourceId(
  organizationId: string,
  workerId: string,
): string {
  return [resourcePrefix, organizationId, workerId].join(':');
}
