import {
  ALLOWED_TOOL_IDS,
  type AllowedToolId,
  type BaseAgentId,
} from "../../contracts/conversation.js";

import { chatAgentIdentity, chatInstructions } from "./chat.js";
import { codeAgentIdentity, codeInstructions } from "./code.js";
import { workAgentIdentity, workInstructions } from "./work.js";

import type { AgentIdentity } from "./base/identity.js";

export interface AgentKindLimits {
  maxSteps: number;
  warningAt: number;
  finalAt: number;
}

/**
 * What makes one agent kind different from another. Everything else is base.
 */
export interface AgentKind {
  id: BaseAgentId;
  identity: AgentIdentity;
  instructions: (identity: AgentIdentity) => string;
  /**
   * Capabilities this kind may use when Pilot grants them.
   */
  capabilities: readonly AllowedToolId[];
  limits: AgentKindLimits;
}

export const AGENT_KINDS: Record<BaseAgentId, AgentKind> = {
  chat: {
    id: "chat",
    identity: chatAgentIdentity,
    instructions: chatInstructions,
    capabilities: ALLOWED_TOOL_IDS,
    limits: { maxSteps: 5, warningAt: 3, finalAt: 4 },
  },
  work: {
    id: "work",
    identity: workAgentIdentity,
    instructions: workInstructions,
    capabilities: ALLOWED_TOOL_IDS,
    limits: { maxSteps: 8, warningAt: 6, finalAt: 7 },
  },
  code: {
    id: "code",
    identity: codeAgentIdentity,
    instructions: codeInstructions,
    capabilities: ["scratchpad", "ask-user", "web-search"],
    limits: { maxSteps: 6, warningAt: 4, finalAt: 5 },
  },
};

export function agentKindFor(id: BaseAgentId): AgentKind {
  return AGENT_KINDS[id];
}
