import type { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import type { LibSQLStore } from '@mastra/libsql';

import {
  createConversationResourceId,
  generateConversationReplySchema,
  type GenerateConversationReply,
} from './command.js';
import { conversationRuntimeConfig } from './config.js';
import { conversationAgentIdentity } from './identity.js';
import { conversationCoreInstructions } from './instructions/core.js';
import { createBaseAgent } from '../runtime/agent/base-agent.js';
import { buildBaseAgentInstructions } from '../runtime/agent/base-instructions.js';
import {
  createPilotRuntimeStorage,
  type PilotRuntimeStorageConfig,
} from '../runtime/storage/pilot-runtime.js';

export {
  generateConversationReplySchema,
} from './command.js';

export type { GenerateConversationReply } from './command.js';

function createConversationAgent(
  command: GenerateConversationReply,
  memory: Memory,
): Agent {
  return createBaseAgent({
    base: {
      maxSteps: conversationRuntimeConfig.maxSteps,
      tokenLimit: conversationRuntimeConfig.tokenLimit,
      warningAt: 2,
      finalAt: 3,
    },
    id: 'pilot-conversation',
    name: conversationAgentIdentity.name,

    description: conversationAgentIdentity.jobDescription,

    instructions: [
      buildBaseAgentInstructions(conversationAgentIdentity),
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
    tools: {},
  });
}

export function createPilotConversationRuntime(
  storageConfig: PilotRuntimeStorageConfig,
) {
  const storage: LibSQLStore = createPilotRuntimeStorage(storageConfig);

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
    async stream(rawCommand: unknown) {
      const command = generateConversationReplySchema.parse(rawCommand);
      const agent = createConversationAgent(command, memory);
      const output = await agent.stream(command.message, {
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
        runId: output.runId ?? null,
        textStream: output.textStream,
        async result() {
          const completed = await output.getFullOutput();
          return {
            finishReason: completed.finishReason,
            modelId: command.worker.modelId,
            runId: completed.runId ?? output.runId ?? null,
            usage: {
              inputTokens: completed.totalUsage.inputTokens ?? 0,
              outputTokens: completed.totalUsage.outputTokens ?? 0,
              totalTokens: completed.totalUsage.totalTokens ?? 0,
            },
          };
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
