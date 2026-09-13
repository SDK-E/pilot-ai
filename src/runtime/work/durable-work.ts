import { RedisServerCache } from "@mastra/redis";
import Redis from "ioredis";

const defaultCacheTtlSeconds = 60 * 60;

export interface PilotDurableWorkConfig {
  redisUrl: string;
  cacheTtlSeconds: number;
}

/**
 * A shared cache is mandatory for a Work run to be observable after a request
 * moves to another serverless instance. Do not fall back to an in-memory cache:
 * that would make a run appear durable while losing its event history.
 */
export function getPilotDurableWorkConfig():
  PilotDurableWorkConfig | undefined {
  const redisUrl = process.env.PILOT_WORK_REDIS_URL?.trim();
  if (!redisUrl) return undefined;

  const url = new URL(redisUrl);
  if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
    throw new Error("PILOT_WORK_REDIS_URL must use redis:// or rediss://.");
  }

  const configuredTtl = process.env.PILOT_WORK_CACHE_TTL_SECONDS?.trim();
  const cacheTtlSeconds = configuredTtl
    ? Number(configuredTtl)
    : defaultCacheTtlSeconds;
  if (!Number.isInteger(cacheTtlSeconds) || cacheTtlSeconds < 60) {
    throw new Error(
      "PILOT_WORK_CACHE_TTL_SECONDS must be an integer of at least 60.",
    );
  }

  return { redisUrl, cacheTtlSeconds };
}

export function createPilotDurableWorkCache(config: PilotDurableWorkConfig) {
  const client = new Redis(config.redisUrl, {
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });
  return new RedisServerCache(
    { client },
    { keyPrefix: "pilot:work:", ttlSeconds: config.cacheTtlSeconds },
  );
}
