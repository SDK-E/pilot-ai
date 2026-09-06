import {
  createClient,
  type Client,
} from '@libsql/client';

import type { ResearchResult } from '../schemas/research-result';

import {
  researchMemoryDatabaseAuthToken,
  researchMemoryDatabaseUrl,
} from '../research-agent/config/storage';

const client: Client = createClient({
  url: researchMemoryDatabaseUrl,
  authToken: researchMemoryDatabaseAuthToken,
});

let initializationPromise:
  | Promise<void>
  | undefined;

async function initialize(): Promise<void> {
  initializationPromise ??= client
    .execute(`
      CREATE TABLE IF NOT EXISTS pilot_research_results (
        thread_id TEXT NOT NULL,
        result_id TEXT NOT NULL,
        result_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,

        PRIMARY KEY (thread_id, result_id)
      )
    `)
    .then(() => undefined);

  await initializationPromise;
}

export async function listResearchResults(
  threadId: string,
): Promise<ResearchResult[]> {
  await initialize();

  const result = await client.execute({
    sql: `
      SELECT result_json
      FROM pilot_research_results
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
        JSON.parse(raw) as ResearchResult,
      ];
    } catch {
      return [];
    }
  });
}

export async function getResearchResult(
  threadId: string,
  resultId: string,
): Promise<ResearchResult | undefined> {
  await initialize();

  const result = await client.execute({
    sql: `
      SELECT result_json
      FROM pilot_research_results
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
    return JSON.parse(raw) as ResearchResult;
  } catch {
    return undefined;
  }
}

export async function upsertResearchResult(
  threadId: string,
  result: ResearchResult,
): Promise<void> {
  await initialize();

  const now = new Date().toISOString();

  await client.execute({
    sql: `
      INSERT INTO pilot_research_results (
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

export async function removeResearchResult(
  threadId: string,
  resultId: string,
): Promise<void> {
  await initialize();

  await client.execute({
    sql: `
      DELETE FROM pilot_research_results
      WHERE thread_id = ?
        AND result_id = ?
    `,
    args: [
      threadId,
      resultId,
    ],
  });
}

export async function clearResearchResults(
  threadId: string,
): Promise<void> {
  await initialize();

  await client.execute({
    sql: `
      DELETE FROM pilot_research_results
      WHERE thread_id = ?
    `,
    args: [threadId],
  });
}
