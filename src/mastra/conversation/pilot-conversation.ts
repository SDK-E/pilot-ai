import { Agent } from '@mastra/core/agent';
import {
  TokenLimiterProcessor,
  UnicodeNormalizer,
} from '@mastra/core/processors';
import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';

import {
  createConversationResourceId,
  generateConversationReplySchema,
  type GenerateConversationReply,
} from './command';
import { conversationRuntimeConfig } from './config';
import { conversationCoreInstructions } from './instructions/core';
import {
  processNarrationGateProcessor,
  qualityGateProcessor,
  responseVerbosityProcessor,
} from './processors';

export {
  createConversationResourceId,
  generateConversationReplySchema,
} from './command';

export type { GenerateConversationReply } from './command';

function createConversationAgent(
  command: GenerateConversationReply,
  memory: Memory,
): Agent {
  return new Agent({
    id: 'pilot-conversation',
    name: 'Pilot Conversation',
    description:
      'A capability-controlled conversational runtime for one Pilot Worker.',
    instructions: [conversationCoreInstructions, command.worker.instructions].join(
      '\n\n',
    ),
    model: [
      {
        model: command.worker.modelId,
        maxRetries: conversationRuntimeConfig.maxRetries,
      },
    ],
    memory,
    defaultOptions: {
      maxSteps: conversationRuntimeConfig.maxSteps,
      maxProcessorRetries: 0,
    },
    inputProcessors: [
      new UnicodeNormalizer({
        stripControlChars: true,
        collapseWhitespace: true,
      }),
      new TokenLimiterProcessor({
        limit: conversationRuntimeConfig.tokenLimit,
        strategy: 'truncate',
      }),
      responseVerbosityProcessor,
      processNarrationGateProcessor,
      qualityGateProcessor,
    ],
    tools: {},
  });
}

export function createPilotConversationRuntime(databaseUrl: string) {
  if (!databaseUrl.trim()) {
    throw new Error(
      'PILOT_MASTRA_DATABASE_URL is required for Pilot Conversation runtime.',
    );
  }

  const storage = new PostgresStore({
    id: 'pilot-conversation-storage',
    connectionString: databaseUrl,
    schemaName: 'pilot_ai',
  });

  const memory = new Memory({
    storage,
    options: {
      lastMessages: conversationRuntimeConfig.lastMessages,
    },
  });

  return {
    async generate(rawCommand: unknown) {
      const command = generateConversationReplySchema.parse(rawCommand);
      const agent = createConversationAgent(command, memory);
      const result = await agent.generate(command.message, {
        memory: {
          resource: createConversationResourceId(
            command.organizationId,
            command.worker.id,
          ),
          thread: command.conversationId,
        },
        maxSteps: conversationRuntimeConfig.maxSteps,
        toolChoice: 'none',
      });

      return {
        text: result.text,
        finishReason: result.finishReason,
        modelId: command.worker.modelId,
        runId: result.runId,
        usage: result.totalUsage,
      };
    },
    async close() {
      await memory.settled();
      await storage.close();
    },

    async deleteConversation(rawCommand: unknown) {
      const command = generateConversationReplySchema.parse(rawCommand);
      const resourceId = createConversationResourceId(
        command.organizationId,
        command.worker.id,
      );
      const thread = await memory.getThreadById({
        threadId: command.conversationId,
        resourceId,
      });

      if (!thread) return;

      if (thread.resourceId !== resourceId) {
        throw new Error('Conversation thread has an unexpected resource owner.');
      }

      await memory.deleteThread(command.conversationId);
    },
  };
}
