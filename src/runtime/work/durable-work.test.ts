import { afterEach, describe, expect, it } from "vitest";

import { getPilotDurableWorkConfig } from "./durable-work.js";

const original = {
  redis: process.env.PILOT_WORK_REDIS_URL,
  ttl: process.env.PILOT_WORK_CACHE_TTL_SECONDS,
};

afterEach(() => {
  if (original.redis === undefined) delete process.env.PILOT_WORK_REDIS_URL;
  else process.env.PILOT_WORK_REDIS_URL = original.redis;
  if (original.ttl === undefined) delete process.env.PILOT_WORK_CACHE_TTL_SECONDS;
  else process.env.PILOT_WORK_CACHE_TTL_SECONDS = original.ttl;
});

describe("durable Work configuration", () => {
  it("remains disabled without a shared cache", () => {
    delete process.env.PILOT_WORK_REDIS_URL;
    expect(getPilotDurableWorkConfig()).toBeUndefined();
  });

  it("accepts a TLS Redis URL and bounded cache lifetime", () => {
    process.env.PILOT_WORK_REDIS_URL = "rediss://pilot:secret@example.test:6380";
    process.env.PILOT_WORK_CACHE_TTL_SECONDS = "900";
    expect(getPilotDurableWorkConfig()).toEqual({
      redisUrl: process.env.PILOT_WORK_REDIS_URL,
      cacheTtlSeconds: 900,
    });
  });

  it("rejects invalid durable-cache configuration", () => {
    process.env.PILOT_WORK_REDIS_URL = "https://example.test";
    expect(() => getPilotDurableWorkConfig()).toThrow("redis://");
    process.env.PILOT_WORK_REDIS_URL = "redis://example.test";
    process.env.PILOT_WORK_CACHE_TTL_SECONDS = "1";
    expect(() => getPilotDurableWorkConfig()).toThrow("at least 60");
  });
});
