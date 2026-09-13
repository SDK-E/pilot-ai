import { ConsoleLogger, LogLevel } from "@mastra/core/logger";
import { z } from "zod";

const logLevelSchema = z.enum(LogLevel).default(LogLevel.INFO);

function configuredLogLevel(): LogLevel {
  const raw = process.env.PILOT_LOG_LEVEL?.trim();
  return logLevelSchema.parse(raw === "" ? undefined : raw);
}

/**
 * Process-wide logger shared by the Mastra server and the Vercel functions.
 * Set PILOT_LOG_LEVEL to debug, info, warn, error, or silent.
 */
export const logger = new ConsoleLogger({
  name: "pilot-ai",
  level: configuredLogLevel(),
});
