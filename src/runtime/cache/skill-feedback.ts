import type { createClient } from "@libsql/client";

type Client = ReturnType<typeof createClient>;

export type SkillFeedbackStats = {
  skillId: string;
  uses: number;
  helpful: number;
  unhelpful: number;
  learnedScore: number;
};

export type SkillFeedback = {
  recordSkillUse: (skillId: string, query?: string) => Promise<void>;
  recordSkillFeedback: (
    skillId: string,
    helpful: boolean,
    query?: string,
    reason?: string,
  ) => Promise<SkillFeedbackStats>;
  getSkillFeedbackMap: (
    skillIds: string[],
  ) => Promise<Map<string, SkillFeedbackStats>>;
};

function toCount(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function toStats(
  skillId: string,
  row?: Record<string, unknown>,
): SkillFeedbackStats {
  const uses = toCount(row?.uses);
  const helpful = toCount(row?.helpful);
  const unhelpful = toCount(row?.unhelpful);
  const totalFeedback = helpful + unhelpful;

  return {
    skillId,
    uses,
    helpful,
    unhelpful,
    learnedScore:
      totalFeedback === 0 ? 0 : (helpful - unhelpful) / (totalFeedback + 4),
  };
}

export function createSkillFeedback({
  client,
  tableName,
}: {
  client: Client;
  tableName: string;
}): SkillFeedback {
  let initializationPromise: Promise<void> | undefined;

  async function initialize(): Promise<void> {
    initializationPromise ??= client
      .execute(
        `
        CREATE TABLE IF NOT EXISTS ${tableName} (
          skill_id TEXT PRIMARY KEY,
          uses INTEGER NOT NULL DEFAULT 0,
          helpful INTEGER NOT NULL DEFAULT 0,
          unhelpful INTEGER NOT NULL DEFAULT 0,
          last_used_at TEXT,
          last_feedback_at TEXT,
          last_query TEXT,
          last_reason TEXT
        )
      `,
      )
      .then(() => undefined);

    await initializationPromise;
  }

  async function recordSkillUse(
    skillId: string,
    query?: string,
  ): Promise<void> {
    await initialize();

    await client.execute({
      sql: `
        INSERT INTO ${tableName} (
          skill_id,
          uses,
          last_used_at,
          last_query
        )
        VALUES (?, 1, ?, ?)

        ON CONFLICT(skill_id)
        DO UPDATE SET
          uses = ${tableName}.uses + 1,
          last_used_at = excluded.last_used_at,
          last_query = COALESCE(excluded.last_query, ${tableName}.last_query)
      `,
      args: [skillId, new Date().toISOString(), query ?? null],
    });
  }

  async function recordSkillFeedback(
    skillId: string,
    helpful: boolean,
    query?: string,
    reason?: string,
  ): Promise<SkillFeedbackStats> {
    await initialize();

    await client.execute({
      sql: `
        INSERT INTO ${tableName} (
          skill_id,
          helpful,
          unhelpful,
          last_feedback_at,
          last_query,
          last_reason
        )
        VALUES (?, ?, ?, ?, ?, ?)

        ON CONFLICT(skill_id)
        DO UPDATE SET
          helpful = ${tableName}.helpful + excluded.helpful,
          unhelpful = ${tableName}.unhelpful + excluded.unhelpful,
          last_feedback_at = excluded.last_feedback_at,
          last_query = COALESCE(excluded.last_query, ${tableName}.last_query),
          last_reason = COALESCE(excluded.last_reason, ${tableName}.last_reason)
      `,
      args: [
        skillId,
        helpful ? 1 : 0,
        helpful ? 0 : 1,
        new Date().toISOString(),
        query ?? null,
        reason ?? null,
      ],
    });

    return getSkillFeedback(skillId);
  }

  async function getSkillFeedback(
    skillId: string,
  ): Promise<SkillFeedbackStats> {
    await initialize();

    const result = await client.execute({
      sql: `
        SELECT uses, helpful, unhelpful
        FROM ${tableName}
        WHERE skill_id = ?
        LIMIT 1
      `,
      args: [skillId],
    });

    const row = result.rows[0] as Record<string, unknown> | undefined;

    return toStats(skillId, row);
  }

  async function getSkillFeedbackMap(
    skillIds: string[],
  ): Promise<Map<string, SkillFeedbackStats>> {
    const uniqueIds = [...new Set(skillIds.filter(Boolean))];

    if (uniqueIds.length === 0) {
      return new Map();
    }

    await initialize();

    const placeholders = uniqueIds.map(() => "?").join(", ");

    const result = await client.execute({
      sql: `
        SELECT skill_id, uses, helpful, unhelpful
        FROM ${tableName}
        WHERE skill_id IN (${placeholders})
      `,
      args: uniqueIds,
    });

    const stats = new Map<string, SkillFeedbackStats>();

    for (const row of result.rows) {
      const skillId = row.skill_id;

      if (typeof skillId !== "string") {
        continue;
      }

      stats.set(skillId, toStats(skillId, row as Record<string, unknown>));
    }

    return stats;
  }

  return {
    recordSkillUse,
    recordSkillFeedback,
    getSkillFeedbackMap,
  };
}
