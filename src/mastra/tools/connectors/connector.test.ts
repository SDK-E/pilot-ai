import { describe, expect, it } from "vitest";

import { connectorToModelOutput } from "./connector.js";

describe("connectorToModelOutput", () => {
  it("surfaces a pending confirmation instead of treating it as a completed action", () => {
    const output = connectorToModelOutput({
      confirmationRequired: true,
      action: {
        id: "post-message",
        label: "Post message",
        description: "Sends a message to #general.",
      },
    });

    expect(output.value).toContain("Post message");
    expect(output.value).toContain("confirm: true");
    expect(output.value).not.toMatch(/^No results\.|^OK$/);
  });

  it("marks mutating actions in the connector listing", () => {
    const output = connectorToModelOutput({
      connectors: [
        {
          slug: "slack",
          displayName: "Slack",
          icon: null,
          description: "",
          actions: [
            {
              id: "list-channels",
              label: "",
              description: "",
              isMutating: false,
            },
            {
              id: "post-message",
              label: "",
              description: "",
              isMutating: true,
            },
          ],
        },
      ],
    });

    expect(output.value).toContain("list-channels");
    expect(output.value).toContain("post-message (mutating)");
  });

  it("falls back to the plain item/result rendering when nothing is pending", () => {
    const output = connectorToModelOutput({
      item: { id: "1", title: "Issue #1", url: null },
    });
    expect(output.value).toBe("Issue #1");
  });
});
