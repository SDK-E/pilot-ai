import { handleProjectMemoryCleanup } from "../../../src/mastra/server/cleanup.js";

export const config = { runtime: "nodejs" };

export default { fetch: handleProjectMemoryCleanup };
