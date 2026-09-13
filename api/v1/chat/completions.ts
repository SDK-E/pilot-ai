import { handleChatCompletion } from "../../../src/conversation/api/chat-completions.js";

export const config = { runtime: "nodejs" };

export default { fetch: handleChatCompletion };
