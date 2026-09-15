import { handleConversationTruncate } from "../../../src/mastra/server/cleanup.js";

export const config = { runtime: "nodejs" };

export default { fetch: handleConversationTruncate };
