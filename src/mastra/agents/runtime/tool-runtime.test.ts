import { describe, expect, it } from "vitest";

import { productionToolIdFromName } from "./tool-runtime.js";

describe("production tool names", () => {
  it("normalizes Mastra registration keys to Pilot capability IDs", () => {
    expect(productionToolIdFromName("webSearch")).toBe("web-search");
    expect(productionToolIdFromName("scratchpad")).toBe("scratchpad");
    expect(productionToolIdFromName("ask_user")).toBe("ask-user");
    expect(productionToolIdFromName("stagehandBrowser")).toBeUndefined();
  });
});
