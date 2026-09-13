import { handleApprovalResume } from "../../../src/mastra/server/approval-resume.js";

export const config = { runtime: "nodejs" };
export default { fetch: handleApprovalResume };
