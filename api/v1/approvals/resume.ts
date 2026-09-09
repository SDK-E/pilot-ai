import { handleApprovalResume } from "../../../src/conversation/api/approval-resume.js";

export const config = { runtime: "nodejs" };
export default { fetch: handleApprovalResume };
