import { createGenericCache } from "./generic-cache.js";
import { createSkillFeedback } from "./skill-feedback.js";

import type { createClient } from "@libsql/client";

type Client = ReturnType<typeof createClient>;

let toolCache: ReturnType<typeof createGenericCache> | undefined;
let skillFeedback: ReturnType<typeof createSkillFeedback> | undefined;

/**
Configures the cache for the current runtime environment.
*/
export function setRuntimeCache(client: Client): void {
  toolCache = createGenericCache({
    client,
    tableName: "pilot_tool_cache",
  });
  skillFeedback = createSkillFeedback({
    client,
    tableName: "pilot_skill_feedback",
  });
}

function requireSkillFeedback() {
  if (!skillFeedback) {
    throw new Error(
      "Research skill feedback is not configured for this runtime.",
    );
  }
  return skillFeedback;
}

function requireCache() {
  if (!toolCache) {
    throw new Error("Research cache is not configured for this runtime.");
  }
  return toolCache;
}

export function makeCacheKey(type: string, input: unknown): string {
  return requireCache().makeCacheKey(type, input);
}

export async function getCachedValue<T>(key: string): Promise<T | undefined> {
  return requireCache().getCachedValue<T>(key);
}

export async function setCachedValue(
  key: string,
  type: string,
  value: unknown,
  ttlMs: number,
): Promise<void> {
  return requireCache().setCachedValue(key, type, value, ttlMs);
}

export const getSkillFeedbackMap = (skillIds: string[]) =>
  requireSkillFeedback().getSkillFeedbackMap(skillIds);
export const recordSkillFeedback = (
  skillId: string,
  helpful: boolean,
  query?: string,
  reason?: string,
) =>
  requireSkillFeedback().recordSkillFeedback(skillId, helpful, query, reason);
export const recordSkillUse = (skillId: string, query?: string) =>
  requireSkillFeedback().recordSkillUse(skillId, query);

export { type SkillFeedbackStats } from "./skill-feedback.js";
