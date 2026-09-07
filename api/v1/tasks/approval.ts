import { z } from 'zod';
import { mastra } from '../../../src/index.js';
import { verifyPilotRuntimeRequest } from '../../../src/runtime/auth/vercel-oidc.js';

const inputSchema = z.object({ taskId: z.uuid(), approvalSummary: z.string().min(1).max(2_000) }).strict();
export const config = { runtime: 'nodejs' };

export default { async fetch(request: Request): Promise<Response> {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  if (!(await verifyPilotRuntimeRequest(request))) return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  const input = inputSchema.safeParse(await request.json().catch(() => undefined));
  if (!input.success) return Response.json({ error: 'Invalid task command.' }, { status: 400 });
  const workflow = mastra.getWorkflow('taskApprovalWorkflow');
  const run = await workflow.createRun();
  const result = await run.start({ inputData: input.data });
  return Response.json({ runId: run.runId, status: result.status });
} };
