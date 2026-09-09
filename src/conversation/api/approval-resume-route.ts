import { registerApiRoute } from "@mastra/core/server";

import { handleApprovalResume } from "./approval-resume.js";

export const approvalResumeRegistration = registerApiRoute(
  "/v1/approvals/resume",
  {
    method: "POST",
    requiresAuth: false,
    handler: async (context) => handleApprovalResume(context.req.raw),
  },
);
