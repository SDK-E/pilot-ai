import {
  createGenericCache,
} from './generic-cache';
import { createSkillFeedback, type SkillFeedbackStats } from './skill-feedback';

import {
  createClient,
  type Client,
} from '@libsql/client';

import {
  researchMemoryDatabaseAuthToken,
  researchMemoryDatabaseUrl,
} from '#runtime/research/config/research-agent/storage';
import { pilotConfig } from '#runtime/research/config';

const client: Client = createClient({
  url: researchMemoryDatabaseUrl,
  authToken: researchMemoryDatabaseAuthToken,
});

const researchCache = createGenericCache({
  client,
  tableName: 'pilot_research_cache',
});

const skillFeedback = createSkillFeedback({
  client,
  tableName: 'pilot_skill_feedback',
});

export function makeCacheKey(
  type: string,
  input: unknown,
): string {
  return researchCache.makeCacheKey(type, input);
}

export async function getCachedValue<T>(
  key: string,
): Promise<T | undefined> {
  return researchCache.getCachedValue<T>(key);
}

export async function setCachedValue(
  key: string,
  type: string,
  value: unknown,
  ttlMs: number,
): Promise<void> {
  return researchCache.setCachedValue(key, type, value, ttlMs);
}

export const getSkillFeedbackMap = skillFeedback.getSkillFeedbackMap;
export const recordSkillFeedback = skillFeedback.recordSkillFeedback;
export const recordSkillUse = skillFeedback.recordSkillUse;
export type { SkillFeedbackStats };