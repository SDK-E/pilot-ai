import { registerApiRoute } from "@mastra/core/server";

import { handleProjectMemoryCleanup } from "./cleanup-handlers.js";

export const projectDeleteRegistration = registerApiRoute(
  "/v1/projects/delete-memory",
  {
    method: "POST",
    requiresAuth: false,
    handler: (c) => handleProjectMemoryCleanup(c.req.raw),
  },
);
