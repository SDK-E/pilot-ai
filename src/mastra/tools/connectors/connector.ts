import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import {
  callConnector,
  connectorsExecuteUrl,
  type ConnectorToolContext,
} from "./callback.js";

const TOOL_ID = "connector";

const connectorSummarySchema = z.object({
  slug: z.string().max(200),
  displayName: z.string().max(200),
  icon: z.string().max(16).nullable(),
  description: z.string().max(500),
  actions: z
    .array(
      z.object({
        id: z.string().max(100),
        label: z.string().max(200),
        description: z.string().max(500),
        isMutating: z.boolean(),
      }),
    )
    .max(50),
});

const itemSchema = z.looseObject({
  id: z.string().max(200).nullable(),
  title: z.string().max(500).nullable(),
  url: z.string().max(2000).nullable(),
  raw: z.string().max(2000).optional(),
});

const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list-connectors") }),
  z.object({
    action: z.literal("call"),
    connectorSlug: z.string().min(1).max(200),
    connectorAction: z.string().min(1).max(100),
    params: z.record(z.string(), z.unknown()).default({}),
    /**
    Required to actually run a mutating action. Get the user's explicit
    go-ahead (e.g. via ask-user) before ever setting this to true.
    */
    confirm: z.boolean().optional(),
  }),
]);

const outputSchema = z
  .object({
    connectors: z.array(connectorSummarySchema).optional(),
    items: z.array(itemSchema).optional(),
    item: itemSchema.nullable().optional(),
    nextCursor: z.string().optional(),
    confirmationRequired: z.literal(true).optional(),
    action: z
      .object({
        id: z.string().max(100),
        label: z.string().max(200),
        description: z.string().max(500),
      })
      .optional(),
  })
  .strict();

type ConnectorOutput = z.infer<typeof outputSchema>;
type ConnectorSummary = z.infer<typeof connectorSummarySchema>;

function actionLabel(action: { id: string; isMutating: boolean }): string {
  return action.isMutating ? `${action.id} (mutating)` : action.id;
}

function connectorLine(connector: ConnectorSummary): string {
  const actions = connector.actions
    .map((action) => actionLabel(action))
    .join(", ");
  return `- ${connector.icon ?? ""} ${connector.displayName} (${connector.slug}): ${actions}`;
}

function connectorsToText(connectors: ConnectorSummary[]): string {
  if (connectors.length === 0) return "No connectors are connected.";
  return connectors.map((connector) => connectorLine(connector)).join("\n");
}

function itemsToText(items: NonNullable<ConnectorOutput["items"]>): string {
  if (items.length === 0) return "No results.";
  return items.map((item) => `- ${item.title ?? item.id ?? "item"}`).join("\n");
}

/**
 * Renders the model-facing text for one connector call. A confirmation-
 * pending result is checked first since it's the one case that must never
 * be read as a completed action.
 */
export function connectorToModelOutput(output: ConnectorOutput) {
  if (output.confirmationRequired && output.action) {
    const { label, description } = output.action;
    return {
      type: "text" as const,
      value: `"${label}" makes a change (${description}). Confirm with the user, then call again with confirm: true to actually run it.`,
    };
  }
  if (output.connectors) {
    return {
      type: "text" as const,
      value: connectorsToText(output.connectors),
    };
  }
  if (output.item) {
    return {
      type: "text" as const,
      value: output.item.title ?? output.item.id ?? "OK",
    };
  }
  return { type: "text" as const, value: itemsToText(output.items ?? []) };
}

async function executeConnectorCall(
  context: ConnectorToolContext,
  callbackUrl: URL,
  rawInput: z.infer<typeof inputSchema>,
): Promise<ConnectorOutput> {
  const result = await callConnector({
    context,
    callbackUrl,
    toolId: TOOL_ID,
    toolLabel: "Connector",
    action:
      rawInput.action === "list-connectors"
        ? "list-connectors"
        : rawInput.connectorAction,
    params: rawInput.action === "list-connectors" ? {} : rawInput.params,
    connectorSlug:
      rawInput.action === "call" ? rawInput.connectorSlug : undefined,
    confirm: rawInput.action === "call" ? rawInput.confirm : undefined,
  });
  return outputSchema.parse(result);
}

/**
 * Calls one of this organization's connected connectors — GitHub, Slack,
 * and every other provider are all rows in the same admin-managed connector
 * registry (Settings → Connectors) driven by one generic OAuth2 + REST
 * engine, not per-provider code (see docs/decisions/0023-dynamic-connectors.md).
 * Always call `list-connectors` first in a conversation that hasn't already
 * discovered what's available — which connectors exist, their actions, and
 * required params are all admin-configured and not knowable in advance.
 * Most actions are read-only; an action with `isMutating: true` never runs
 * on its first call — it returns `confirmationRequired` instead, and the
 * caller must get the user's explicit go-ahead (e.g. via `ask-user`) before
 * calling again with `confirm: true`.
 */
export function createConnectorTool(context: ConnectorToolContext) {
  const callbackUrl = connectorsExecuteUrl();
  return createTool({
    id: TOOL_ID,
    description:
      'List or call this organization\'s connected connectors. Call with action "list-connectors" first to discover which connectors and actions exist (each action says whether it isMutating), then action "call" with the chosen connectorSlug/connectorAction/params. A mutating action returns confirmationRequired until you get the user\'s explicit go-ahead and call again with confirm: true.',
    inputSchema,
    outputSchema,
    execute: (rawInput) => executeConnectorCall(context, callbackUrl, rawInput),
    toModelOutput: connectorToModelOutput,
  });
}
