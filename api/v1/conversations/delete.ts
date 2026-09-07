import { z } from 'zod';
import { createPilotConversationRuntime } from '../../../src/conversation/pilot-conversation.js';
import { verifyPilotRuntimeRequest } from '../../../src/runtime/auth/vercel-oidc.js';
import { getPilotRuntimeStorageConfig } from '../../../src/runtime/storage/pilot-runtime.js';

const commandSchema = z.object({ organizationId: z.string().min(1).max(255), workerId: z.uuid(), conversationId: z.uuid() }).strict();
export const config = { runtime: 'nodejs' };

export default { async fetch(request: Request): Promise<Response> {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  if (!(await verifyPilotRuntimeRequest(request))) return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  const storageConfig = getPilotRuntimeStorageConfig(); if (!storageConfig) return Response.json({ error: 'Pilot Conversation is not configured.' }, { status: 503 });
  const command = commandSchema.safeParse(await request.json().catch(() => undefined)); if (!command.success) return Response.json({ error: 'Invalid cleanup command.' }, { status: 400 });
  const runtime = createPilotConversationRuntime(storageConfig);
  try { await runtime.deleteConversation({ organizationId: command.data.organizationId, worker: { id: command.data.workerId, instructions: 'Cleanup only.', modelId: 'kilo/kilo-auto/free' }, conversationId: command.data.conversationId, message: 'Cleanup only.', allowedToolIds: [] }); return new Response(null, { status: 204 }); }
  finally { await runtime.close(); }
} };
