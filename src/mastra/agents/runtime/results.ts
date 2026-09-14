import type { ApprovableCapabilityId } from "../base/capabilities/index.js";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface CompletedResult {
  kind: "completed";
  text: string;
  finishReason: string | undefined;
  modelId: string;
  runId: string | null;
  usage: TokenUsage;
}

export interface SuspendedResult {
  kind: "suspended";
  runId: string;
  toolCallId: string;
  toolId: ApprovableCapabilityId;
  usage: TokenUsage;
}

export interface UserInputRequiredResult {
  kind: "user_input_required";
  runId: string;
  toolCallId: string;
  question: string;
  options?: { label: string; description?: string }[];
  selectionMode?: "single_select" | "multi_select";
  usage: TokenUsage;
}

export type RuntimeResult =
  CompletedResult | SuspendedResult | UserInputRequiredResult;

export function usageOf(value: {
  totalUsage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}): TokenUsage {
  return {
    inputTokens: value.totalUsage.inputTokens ?? 0,
    outputTokens: value.totalUsage.outputTokens ?? 0,
    totalTokens: value.totalUsage.totalTokens ?? 0,
  };
}
