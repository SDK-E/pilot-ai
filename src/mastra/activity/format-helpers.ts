export const MAX_DETAIL_CHARS = 4000;
const TRUNCATION_MARKER = "\n\n…(truncated)";

export function truncate(value: string, limit = MAX_DETAIL_CHARS): string {
  return value.length > limit
    ? value.slice(0, limit - TRUNCATION_MARKER.length) + TRUNCATION_MARKER
    : value;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function num(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}
