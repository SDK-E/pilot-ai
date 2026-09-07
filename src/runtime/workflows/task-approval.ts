import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const inputSchema = z.object({
  taskId: z.uuid(),
  approvalSummary: z.string().min(1).max(2_000),
});

const outputSchema = z.object({
  result: z.string(),
});

const approvalStep = createStep({
  id: 'request-approval',
  inputSchema,
  outputSchema,
  resumeSchema: z.object({ approved: z.boolean() }),
  suspendSchema: z.object({ taskId: z.uuid(), summary: z.string() }),
  execute: async ({ inputData, resumeData, suspend, bail }) => {
    if (resumeData?.approved === false) {
      return bail({ result: 'The protected task action was rejected.' });
    }
    if (!resumeData?.approved) {
      return await suspend({ taskId: inputData.taskId, summary: inputData.approvalSummary });
    }
    return { result: 'The protected task action was approved.' };
  },
});

export const taskApprovalWorkflow = createWorkflow({
  id: 'pilot-task-approval',
  inputSchema,
  outputSchema,
}).then(approvalStep).commit();
