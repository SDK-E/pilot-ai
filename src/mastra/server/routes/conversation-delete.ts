import { registerApiRoute } from "@mastra/core/server";

import { handleConversationCleanup } from "../cleanup.js";

export const conversationDeleteRegistration = registerApiRoute(
  "/v1/conversations/delete",
  {
    method: "POST",
    requiresAuth: false,
    handler: (c) => handleConversationCleanup(c.req.raw),
  },
);
