import { handleChatCompletion } from "../../../src/mastra/server/chat-completions.js";

export const config = { runtime: "nodejs" };

export default { fetch: handleChatCompletion };
