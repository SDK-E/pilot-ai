import { registerApiRoute } from "@mastra/core/server";

import { handleConversationTruncate } from "../cleanup.js";

export const conversationTruncateRegistration = registerApiRoute(
  "/v1/conversations/truncate",
  {
    method: "POST",
    requiresAuth: false,
    handler: (c) => handleConversationTruncate(c.req.raw),
  },
);
