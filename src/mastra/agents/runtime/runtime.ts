import { Mastra } from "@mastra/core/mastra";

import {
  createConversationResourceId,
  createMemoryResourceId,
  createProjectResourceId,
  generateConversationReplySchema,
  type GenerateConversationReply,
} from "../../../contracts/conversation.js";
import {
  createConversationMemory,
  createProjectMemory,
} from "../../memory/project-memory.js";
import { configureWebTools, type WebToolSecrets } from "../../setup/web-tools.js";
import {
  createPilotRuntimeStorage,
  type PilotRuntimeStorageConfig,
} from "../../storage/runtime.js";
import { agentKindFor } from "../kinds.js";

import { createAgentForRequest, grantedCapabilities } from "./agent-factory.js";
import { isHtmlDocumentText, usageOf, type RuntimeResult } from "./results.js";
import { isSuspended, suspendedAskUserInput } from "./suspensions.js";

import type { Agent } from "@mastra/core/agent";
import type { Memory } from "@mastra/memory";

export interface ConversationCleanup {
  organizationId: string;
  workerId: string;
  conversationId: string;
  project?: { id: string; sharedMemoryEnabled: boolean };
}

export interface ConversationTruncate extends ConversationCleanup {
  /*
   * Forget every stored message at or after this point.
   */
  cutoff: Date;
}

export interface ProjectMemoryCleanup {
  organizationId: string;
  workerId: string;
  projectId: string;
}

interface Memories {
  conversation: Memory;
  project: Memory;
}

type AgentOutput = Parameters<typeof isSuspended>[0] & {
  text: string;
  totalUsage: Parameters<typeof usageOf>[0]["totalUsage"];
};

// `maxSteps` alone was observed not to stop the loop (a Work-kind run with
// maxSteps: 8 made 9+ webSearch calls in one `agent.stream()` invocation
// before the server's own turn timeout cut it off). `stopWhen` is the
// underlying AI SDK stopping mechanism `maxSteps` is documented to map to;
// setting it explicitly gives a hard, verifiable cap independent of whatever
// gap exists in that mapping.
function stopAtStepCount(stepCount: number) {
  return ({ steps }: { steps: unknown[] }) => steps.length >= stepCount;
}

function generationOptions(
  command: GenerateConversationReply,
  abortSignal?: AbortSignal,
) {
  const kind = agentKindFor(command.baseAgentId);
  const granted = grantedCapabilities(kind, command);
  return {
    memory: {
      resource: createMemoryResourceId(command),
      thread: command.conversationId,
    },
    maxSteps: kind.limits.maxSteps,
    stopWhen: stopAtStepCount(kind.limits.maxSteps),
    toolChoice: granted.length > 0 ? ("auto" as const) : ("none" as const),
    abortSignal,
  };
}

function memoryFor(memories: Memories, command: GenerateConversationReply) {
  return command.project?.sharedMemoryEnabled
    ? memories.project
    : memories.conversation;
}

async function toResult(
  agent: Agent,
  command: GenerateConversationReply,
  output: AgentOutput,
): Promise<RuntimeResult> {
  const usage = usageOf(output);
  if (!isSuspended(output)) {
    if (isHtmlDocumentText(output.text)) {
      throw new Error(
        "The model provider returned an unexpected response instead of a completion.",
      );
    }
    return {
      kind: "completed",
      text: output.text,
      finishReason: output.finishReason,
      modelId: command.worker.modelId,
      runId: output.runId ?? null,
      usage,
    };
  }
  const { runId } = output;
  const { toolCallId } = output.suspendPayload;
  const prompt = await suspendedAskUserInput(agent, command, runId, toolCallId);
  return { kind: "user_input_required", runId, toolCallId, ...prompt, usage };
}

async function resolveConversationThread(
  memories: Memories,
  input: ConversationCleanup,
) {
  const isShared = input.project?.sharedMemoryEnabled === true;
  const resourceId =
    isShared && input.project
      ? createProjectResourceId(
          input.organizationId,
          input.workerId,
          input.project.id,
        )
      : createConversationResourceId(input.organizationId, input.workerId);
  const memory = isShared ? memories.project : memories.conversation;
  const thread = await memory.getThreadById({
    threadId: input.conversationId,
    resourceId,
  });
  if (!thread) return;
  if (thread.resourceId !== resourceId) {
    throw new Error("Conversation thread has an unexpected resource owner.");
  }
  return { memory, resourceId };
}

async function deleteConversationThread(
  memories: Memories,
  input: ConversationCleanup,
): Promise<void> {
  const resolved = await resolveConversationThread(memories, input);
  if (!resolved) return;
  await resolved.memory.deleteThread(input.conversationId);
}

/**
 * Forgets every message Mastra stored for this conversation at or after
 * `cutoff` — the point Pilot is about to overwrite (an edited message) or
 * discard (a regenerated reply). Pilot's own Postgres history is the source
 * of truth for what the user sees; this only keeps the model's own memory of
 * the conversation from staying stale once Pilot's copy no longer matches.
 */
async function truncateConversationThread(
  memories: Memories,
  input: ConversationTruncate,
): Promise<void> {
  const resolved = await resolveConversationThread(memories, input);
  if (!resolved) return;
  const { messages } = await resolved.memory.recall({
    threadId: input.conversationId,
    resourceId: resolved.resourceId,
    perPage: false,
    filter: { dateRange: { start: input.cutoff } },
  });
  if (messages.length === 0) return;
  await resolved.memory.deleteMessages(messages.map((message) => message.id));
}

async function deleteProjectThreads(
  memories: Memories,
  input: ProjectMemoryCleanup,
): Promise<void> {
  const resourceId = createProjectResourceId(
    input.organizationId,
    input.workerId,
    input.projectId,
  );
  const { threads } = await memories.project.listThreads({
    filter: { resourceId },
    perPage: false,
  });
  await Promise.all(
    threads.map((thread) => memories.project.deleteThread(thread.id)),
  );
}

interface RuntimeContext {
  storage: ReturnType<typeof createPilotRuntimeStorage>;
  memories: Memories;
  runtimeToken: string | undefined;
}

function prepareAgent(context: RuntimeContext, rawCommand: unknown) {
  const command = generateConversationReplySchema.parse(rawCommand);
  const agent = createAgentForRequest({
    command,
    memory: memoryFor(context.memories, command),
    runtimeToken: context.runtimeToken,
  });
  // Registering the agent over the shared store is what lets a suspended
  // run be found again from another process.
  // eslint-disable-next-line sonarjs/constructor-for-side-effects -- the registration is the effect
  new Mastra({ agents: { [agent.id]: agent }, storage: context.storage });
  return { command, agent };
}

/**
 * Request-scoped Pilot runtime: one agent per command over shared storage.
 */
export function createPilotRuntime(
  storageConfig: PilotRuntimeStorageConfig,
  runtimeToken?: string,
  webToolSecrets?: WebToolSecrets,
) {
  const storage = createPilotRuntimeStorage(storageConfig);
  configureWebTools(storageConfig, webToolSecrets);
  const memories: Memories = {
    conversation: createConversationMemory(storage),
    project: createProjectMemory(storage),
  };
  const context: RuntimeContext = { storage, memories, runtimeToken };
  const prepare = (rawCommand: unknown) => prepareAgent(context, rawCommand);

  return {
    async generate(
      rawCommand: unknown,
      abortSignal?: AbortSignal,
    ): Promise<RuntimeResult> {
      const { command, agent } = prepare(rawCommand);
      const output = await agent.generate(
        command.message,
        generationOptions(command, abortSignal),
      );
      return toResult(agent, command, output);
    },

    async stream(rawCommand: unknown, abortSignal?: AbortSignal) {
      const { command, agent } = prepare(rawCommand);
      const output = await agent.stream(
        command.message,
        generationOptions(command, abortSignal),
      );
      return {
        runId: output.runId,
        modelId: command.worker.modelId,
        textStream: output.textStream,
        result: async () =>
          toResult(agent, command, await output.getFullOutput()),
      };
    },

    deleteConversation: (input: ConversationCleanup) =>
      deleteConversationThread(memories, input),

    truncateConversation: (input: ConversationTruncate) =>
      truncateConversationThread(memories, input),

    deleteProjectMemory: (input: ProjectMemoryCleanup) =>
      deleteProjectThreads(memories, input),

    async close(): Promise<void> {
      await memories.conversation.settled();
      await memories.project.settled();
      await storage.close();
    },
  };
}

export type PilotRuntime = ReturnType<typeof createPilotRuntime>;
