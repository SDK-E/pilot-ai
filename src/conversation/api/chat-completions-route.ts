import { registerApiRoute } from "@mastra/core/server";

import { handleChatCompletion } from "./chat-completions.js";

export const chatCompletionsRegistration = registerApiRoute(
  "/v1/chat/completions",
  {
    method: "POST",
    requiresAuth: false,
    handler: (context) => handleChatCompletion(context.req.raw),
  },
);
