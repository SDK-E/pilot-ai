import { handleConversationCleanup } from "../../../src/conversation/api/cleanup-handlers.js";

export const config = { runtime: "nodejs" };

export default { fetch: handleConversationCleanup };
