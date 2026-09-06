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
import { conversationAgentIdentity } from './identity';
import { conversationCoreInstructions } from './instructions/core';
import {
  currentContextProcessor,
  failureRecoveryProcessor,
  processNarrationGateProcessor,
  qualityGateProcessor,
  responseVerbosityProcessor,
  staleObjectiveResetProcessor,
} from '#runtime/processors';

import {
  buildAnswerRelevancyScorer,
} from '#runtime/scorers';
import {
  webSearch,
} from '#runtime/tools/search/web-search';

export {
  generateConversationReplySchema,
} from './command';

export type { GenerateConversationReply } from './command';

function createConversationAgent(
  command: GenerateConversationReply,
  memory: Memory,
): Agent {
  return new Agent({
    id: 'pilot-conversation',
    name: conversationAgentIdentity.name,

    description: conversationAgentIdentity.jobDescription,

    instructions: [
      conversationCoreInstructions(conversationAgentIdentity),
      command.worker.instructions,
    ].join('\n\n'),
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
      currentContextProcessor,
      staleObjectiveResetProcessor,
      responseVerbosityProcessor,
      processNarrationGateProcessor,
      qualityGateProcessor,
      failureRecoveryProcessor,
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
        runId: result.runId ?? null,
        usage: {
          inputTokens: result.totalUsage.inputTokens ?? 0,
          outputTokens: result.totalUsage.outputTokens ?? 0,
          totalTokens: result.totalUsage.totalTokens ?? 0,
        },
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
