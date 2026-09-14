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
import {
  createPilotRuntimeStorage,
  type PilotRuntimeStorageConfig,
} from "../../storage/runtime.js";
import { capabilityIdFromToolName } from "../base/capabilities/index.js";
import { agentKindFor } from "../kinds.js";

import {
  createActivityReporter,
  createAgentForRequest,
  grantedCapabilities,
  reportActivitySafely,
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
} from "./suspensions.js";

import type { Agent } from "@mastra/core/agent";

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

/**
Request-scoped Pilot runtime: one agent per command, shared storage.
*/
export function createPilotRuntime(
  storageConfig: PilotRuntimeStorageConfig,
  oidcToken?: string,
) {
  const storage = createPilotRuntimeStorage(storageConfig);
  const conversationMemory = createConversationMemory(storage);
  const projectMemory = createProjectMemory(storage);
  const reporter = createActivityReporter(oidcToken);

  const memoryFor = (command: GenerateConversationReply) =>
    command.project?.sharedMemoryEnabled ? projectMemory : conversationMemory;

  const prepare = (rawCommand: unknown) => {
    const command = generateConversationReplySchema.parse(rawCommand);
    const agent = createAgentForRequest({
      command,
      memory: memoryFor(command),
      oidcToken,
    });
    // A public registration over the shared store lets suspensions survive
    // process restarts without mutable global agents.
    new Mastra({ agents: { [agent.id]: agent }, storage });
    return { command, agent };
  };

  const toResult = async (
    agent: Agent,
    command: GenerateConversationReply,
    output: Parameters<typeof isSuspended>[0] & {
      text: string;
      totalUsage: Parameters<typeof usageOf>[0]["totalUsage"];
    },
    fallbackRunId: string | null,
  ): Promise<RuntimeResult> => {
    const usage = usageOf(output);
    if (!isSuspended(output)) {
      return {
        kind: "completed",
        text: output.text,
        finishReason: output.finishReason,
        modelId: command.worker.modelId,
        runId: output.runId ?? fallbackRunId,
        usage,
      };
    }
    const { runId } = output;
    const { toolCallId } = output.suspendPayload;
    const toolId = await suspendedCapabilityId(
      agent,
      command,
      runId,
      toolCallId,
    );
    if (toolId === "ask-user") {
      const prompt = await suspendedAskUserInput(
        agent,
        command,
        runId,
        toolCallId,
      );
      return {
        kind: "user_input_required",
        runId,
        toolCallId,
        ...prompt,
        usage,
      };
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
  };

  return {
    async generate(rawCommand: unknown): Promise<RuntimeResult> {
      const { command, agent } = prepare(rawCommand);
      const output = await agent.generate(
        command.message,
        generationOptions(command),
      );
      return toResult(agent, command, output, null);
    },

    async stream(rawCommand: unknown) {
      const { command, agent } = prepare(rawCommand);
      const output = await agent.stream(
        command.message,
        generationOptions(command),
      );
      return {
        runId: output.runId ?? null,
        modelId: command.worker.modelId,
        textStream: output.textStream,
        result: async () =>
          toResult(
            agent,
            command,
            await output.getFullOutput(),
            output.runId ?? null,
          ),
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
      const run = await findApprovalRun(agent, command, rawCommand);
      if (!run) throw new Error("The requested approval is not suspended.");
      const resumeInput = {
        runId: run.runId,
        toolCallId: rawCommand.toolCallId,
        ...generationOptions(command),
      };
      const output = isApproved
        ? await agent.approveToolCallGenerate(resumeInput)
        : await agent.declineToolCallGenerate({
            ...resumeInput,
            reason: "The user declined this tool call.",
          });
      return {
        kind: "completed",
        text: output.text,
        finishReason: output.finishReason,
        modelId: command.worker.modelId,
        runId: output.runId ?? run.runId,
        usage: usageOf(output),
      };
    },

    async deleteConversation(input: ConversationCleanup): Promise<void> {
      const resourceId = input.project?.sharedMemoryEnabled
        ? createProjectResourceId(
            input.organizationId,
            input.workerId,
            input.project.id,
          )
        : createConversationResourceId(input.organizationId, input.workerId);
      const memory = input.project?.sharedMemoryEnabled
        ? projectMemory
        : conversationMemory;
      const thread = await memory.getThreadById({
        threadId: input.conversationId,
        resourceId,
      });
      if (!thread) return;
      if (thread.resourceId !== resourceId) {
        throw new Error(
          "Conversation thread has an unexpected resource owner.",
        );
      }
      await memory.deleteThread(input.conversationId);
    },

    async deleteProjectMemory(input: ProjectMemoryCleanup): Promise<void> {
      const resourceId = createProjectResourceId(
        input.organizationId,
        input.workerId,
        input.projectId,
      );
      const { threads } = await projectMemory.listThreads({
        filter: { resourceId },
        perPage: false,
      });
      await Promise.all(
        threads.map((thread) => projectMemory.deleteThread(thread.id)),
      );
    },

    async close(): Promise<void> {
      await conversationMemory.settled();
      await projectMemory.settled();
      await storage.close();
    },
  };
}

export type PilotRuntime = ReturnType<typeof createPilotRuntime>;
