import { describe, expect, it } from "vitest";

import {
  CAPABILITIES,
  capabilityIdFromToolName,
  capabilityInstructions,
} from "./index.js";

describe("capabilities", () => {
  it("maps Mastra tool names and capability ids back to capability ids", () => {
    expect(capabilityIdFromToolName("webSearch")).toBe("web-search");
    expect(capabilityIdFromToolName("web-search")).toBe("web-search");
    expect(capabilityIdFromToolName("scratchpad")).toBe("scratchpad");
    expect(capabilityIdFromToolName("ask_user")).toBe("ask-user");
    expect(capabilityIdFromToolName("plan")).toBe("plan");
    expect(capabilityIdFromToolName("sandbox-run")).toBe("code-sandbox");
    expect(capabilityIdFromToolName("connector-github")).toBe(
      "connector-github",
    );
    expect(capabilityIdFromToolName("stagehandBrowser")).toBeUndefined();
    expect(capabilityIdFromToolName(undefined)).toBeUndefined();
  });

  it("registers exactly the production capabilities", () => {
    expect(Object.keys(CAPABILITIES)).toEqual([
      "web-search",
      "scratchpad",
      "ask-user",
      "plan",
      "code-sandbox",
      "connector-github",
      "connector-google-drive",
      "connector-gmail",
      "connector-slack",
      "connector-notion",
      "connector-linear",
      "connector-vercel",
      "connector-monday",
    ]);
  });

  it("builds capability instructions only for granted capabilities", () => {
    expect(capabilityInstructions([])).toBeUndefined();
    const text = capabilityInstructions(["scratchpad"]);
    expect(text).toContain("Use only the tools made available");
    expect(text).toContain("scratchpad");
    expect(text).not.toContain("web-search when");
  });
});
