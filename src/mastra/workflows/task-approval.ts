import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

const inputSchema = z.object({
  taskId: z.uuid(),
  approvalSummary: z.string().min(1).max(2000),
});

const outputSchema = z.object({
  result: z.string(),
});

const approvalStep = createStep({
  id: "request-approval",
  inputSchema,
  outputSchema,
  resumeSchema: z.object({ approved: z.boolean() }),
  suspendSchema: z.object({ taskId: z.uuid(), summary: z.string() }),
  execute: async (step) => {
    const { inputData, resumeData } = step;
    if (resumeData?.approved === false) {
      return step.bail({ result: "The protected task action was rejected." });
    }
    if (!resumeData?.approved) {
      return await step.suspend({
        taskId: inputData.taskId,
        summary: inputData.approvalSummary,
      });
    }
    return { result: "The protected task action was approved." };
  },
});

export const taskApprovalWorkflow = createWorkflow({
  id: "pilot-task-approval",
  inputSchema,
  outputSchema,
})
  // eslint-disable-next-line unicorn/prefer-top-level-await -- workflow builder, not a promise
  .then(approvalStep)
  .commit();
