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
import { configureWebTools } from "../../setup/web-tools.js";
import {
  createPilotRuntimeStorage,
  type PilotRuntimeStorageConfig,
} from "../../storage/runtime.js";
import {
  capabilityIdFromToolName,
  isApprovableCapabilityId,
} from "../base/capabilities/index.js";
import { agentKindFor } from "../kinds.js";

import {
  createActivityReporter,
  createAgentForRequest,
  grantedCapabilities,
  reportActivitySafely,
  type ActivityReporter,
} from "./agent-factory.js";
import {
  usageOf,
  type CompletedResult,
  type RuntimeResult,
} from "./results.js";
import {
  findApprovalRun,
  isApprovalTarget,
  isSuspended,
  suspendedAskUserInput,
  suspendedCapabilityId,
  type ApprovalTarget,
} from "./suspensions.js";

import type { Agent } from "@mastra/core/agent";
import type { Memory } from "@mastra/memory";

export interface ConversationCleanup {
  organizationId: string;
  workerId: string;
  conversationId: string;
  project?: { id: string; sharedMemoryEnabled: boolean };
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

function generationOptions(command: GenerateConversationReply) {
  const kind = agentKindFor(command.baseAgentId);
  const granted = grantedCapabilities(kind, command);
  return {
    memory: {
      resource: createMemoryResourceId(command),
      thread: command.conversationId,
    },
    maxSteps: kind.limits.maxSteps,
    toolChoice: granted.length > 0 ? ("auto" as const) : ("none" as const),
    requireToolApproval: ({ toolName }: { toolName: string }) => {
      const toolId = capabilityIdFromToolName(toolName);
      return toolId ? command.approvalRequiredToolIds.includes(toolId) : false;
    },
    autoResumeSuspendedTools: granted.includes("ask-user"),
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
  reporter: ActivityReporter | undefined,
): Promise<RuntimeResult> {
  const usage = usageOf(output);
  if (!isSuspended(output)) {
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
  const toolId = await suspendedCapabilityId(agent, command, runId, toolCallId);
  if (toolId === "ask-user") {
    const prompt = await suspendedAskUserInput(
      agent,
      command,
      runId,
      toolCallId,
    );
    return { kind: "user_input_required", runId, toolCallId, ...prompt, usage };
  }
  if (!isApprovableCapabilityId(toolId)) {
    throw new Error("The suspended tool does not support approval.");
  }
  await reportActivitySafely(reporter, {
    kind: "tool",
    organizationId: command.organizationId,
    executionId: command.executionId,
    toolId,
    toolCallId,
    runtimeRunId: runId,
    state: "awaiting_approval",
  });
  return { kind: "suspended", runId, toolCallId, toolId, usage };
}

async function resumeRun(
  agent: Agent,
  command: GenerateConversationReply,
  target: ApprovalTarget,
  isApproved: boolean,
): Promise<CompletedResult> {
  const run = await findApprovalRun(agent, command, target);
  if (!run) throw new Error("The requested approval is not suspended.");
  const input = {
    runId: run.runId,
    toolCallId: target.toolCallId,
    ...generationOptions(command),
  };
  const output = isApproved
    ? await agent.approveToolCallGenerate(input)
    : await agent.declineToolCallGenerate({
        ...input,
        reason: "The user declined this tool call.",
      });
  return {
    kind: "completed",
    text: output.text,
    finishReason: output.finishReason,
    modelId: command.worker.modelId,
    runId: output.runId ?? null,
    usage: usageOf(output),
  };
}

async function deleteConversationThread(
  memories: Memories,
  input: ConversationCleanup,
): Promise<void> {
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
  await memory.deleteThread(input.conversationId);
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
  oidcToken: string | undefined;
}

function prepareAgent(context: RuntimeContext, rawCommand: unknown) {
  const command = generateConversationReplySchema.parse(rawCommand);
  const agent = createAgentForRequest({
    command,
    memory: memoryFor(context.memories, command),
    oidcToken: context.oidcToken,
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
  oidcToken?: string,
) {
  const storage = createPilotRuntimeStorage(storageConfig);
  configureWebTools(storageConfig);
  const memories: Memories = {
    conversation: createConversationMemory(storage),
    project: createProjectMemory(storage),
  };
  const context: RuntimeContext = { storage, memories, oidcToken };
  const reporter = createActivityReporter(oidcToken);
  const prepare = (rawCommand: unknown) => prepareAgent(context, rawCommand);

  return {
    async generate(rawCommand: unknown): Promise<RuntimeResult> {
      const { command, agent } = prepare(rawCommand);
      const output = await agent.generate(
        command.message,
        generationOptions(command),
      );
      return toResult(agent, command, output, reporter);
    },

    async stream(rawCommand: unknown) {
      const { command, agent } = prepare(rawCommand);
      const output = await agent.stream(
        command.message,
        generationOptions(command),
      );
      return {
        runId: output.runId,
        modelId: command.worker.modelId,
        textStream: output.textStream,
        result: async () =>
          toResult(agent, command, await output.getFullOutput(), reporter),
      };
    },

    async resume(
      rawCommand: unknown,
      isApproved: boolean,
    ): Promise<CompletedResult> {
      const { command, agent } = prepare(rawCommand);
      if (!isApprovalTarget(rawCommand)) {
        throw new Error("Invalid approval resume command.");
      }
      return resumeRun(agent, command, rawCommand, isApproved);
    },

    deleteConversation: (input: ConversationCleanup) =>
      deleteConversationThread(memories, input),

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
