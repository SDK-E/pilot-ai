import {
  type Client,
} from '@libsql/client';

import type { CollectedResult } from '../schemas/collected-result.js';

export interface ResultStore {
  listResults: (threadId: string) => Promise<CollectedResult[]>;
  getResult: (threadId: string, resultId: string) => Promise<CollectedResult | undefined>;
  upsertResult: (threadId: string, result: CollectedResult) => Promise<void>;
  removeResult: (threadId: string, resultId: string) => Promise<void>;
  clearResults: (threadId: string) => Promise<void>;
}

export function createResultStore({
  client,
  tableName,
}: {
  client: Client;
  tableName: string;
}): ResultStore {
  let initializationPromise:
    | Promise<void>
    | undefined;

  async function initialize(): Promise<void> {
    initializationPromise ??= client
      .execute(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          thread_id TEXT NOT NULL,
          result_id TEXT NOT NULL,
          result_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,

          PRIMARY KEY (thread_id, result_id)
        )
      `)
      .then(() => {});

    await initializationPromise;
  }

  async function listResults(
    threadId: string,
  ): Promise<CollectedResult[]> {
    await initialize();

    const result = await client.execute({
      sql: `
        SELECT result_json
        FROM ${tableName}
        WHERE thread_id = ?
        ORDER BY updated_at DESC
      `,
      args: [threadId],
    });

    return result.rows.flatMap((row) => {
      const raw = row.result_json;

      if (typeof raw !== 'string') {
        return [];
      }

      try {
        return [
          JSON.parse(raw) as CollectedResult,
        ];
      } catch {
        return [];
      }
    });
  }

  async function getResult(
    threadId: string,
    resultId: string,
  ): Promise<CollectedResult | undefined> {
    await initialize();

    const result = await client.execute({
      sql: `
        SELECT result_json
        FROM ${tableName}
        WHERE thread_id = ?
          AND result_id = ?
        LIMIT 1
      `,
      args: [
        threadId,
        resultId,
      ],
    });

    const row = result.rows[0];

    if (!row) {
      return undefined;
    }

    const raw = row.result_json;

    if (typeof raw !== 'string') {
      return undefined;
    }

    try {
      return JSON.parse(raw) as CollectedResult;
    } catch {
      return undefined;
    }
  }

  async function upsertResult(
    threadId: string,
    result: CollectedResult,
  ): Promise<void> {
    await initialize();

    const now = new Date().toISOString();

    await client.execute({
      sql: `
        INSERT INTO ${tableName} (
          thread_id,
          result_id,
          result_json,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?)

        ON CONFLICT(thread_id, result_id)
        DO UPDATE SET
          result_json = excluded.result_json,
          updated_at = excluded.updated_at
      `,
      args: [
        threadId,
        result.id,
        JSON.stringify(result),
        now,
        now,
      ],
    });
  }

  async function removeResult(
    threadId: string,
    resultId: string,
  ): Promise<void> {
    await initialize();

    await client.execute({
      sql: `
        DELETE FROM ${tableName}
        WHERE thread_id = ?
          AND result_id = ?
      `,
      args: [
        threadId,
        resultId,
      ],
    });
  }

  async function clearResults(
    threadId: string,
  ): Promise<void> {
    await initialize();

    await client.execute({
      sql: `
        DELETE FROM ${tableName}
        WHERE thread_id = ?
      `,
      args: [threadId],
    });
  }

  return {
    listResults,
    getResult,
    upsertResult,
    removeResult,
    clearResults,
  };
}