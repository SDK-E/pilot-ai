import { describe, expect, it } from "vitest";

import { buildToolDetail } from "./tool-detail.js";

describe("buildToolDetail", () => {
  it("formats sandbox-run steps as fenced command and output blocks", () => {
    const detail = buildToolDetail(
      "sandbox-run",
      { commands: [{ cmd: "echo", args: ["hi"] }] },
      {
        steps: [{ cmd: "echo hi", exitCode: 0, stdout: "hi\n", stderr: "" }],
        didStopEarly: false,
      },
      undefined,
    );
    expect(detail).toContain("```bash\n$ echo hi\nhi\n```");
    expect(detail).not.toContain("exit");
    expect(detail).not.toContain("stderr");
  });

  it("shows whatever a failed command printed without labeling which stream it came from", () => {
    const detail = buildToolDetail(
      "sandbox-run",
      {},
      {
        steps: [{ cmd: "false", exitCode: 1, stdout: "", stderr: "boom" }],
        didStopEarly: true,
      },
      undefined,
    );
    expect(detail).toContain("```bash\n$ false\nboom\n```");
    expect(detail).not.toContain("stderr");
    expect(detail).not.toContain("exit");
    expect(detail).toContain("stopped");
  });

  it("prints (no output) only when a command produced nothing at all", () => {
    const detail = buildToolDetail(
      "sandbox-run",
      {},
      {
        steps: [{ cmd: "true", exitCode: 0, stdout: "", stderr: "" }],
        didStopEarly: false,
      },
      undefined,
    );
    expect(detail).toContain("```bash\n$ true\n(no output)\n```");
  });

  it("formats web search results with the real query and linked results", () => {
    const detail = buildToolDetail(
      "webSearch",
      { query: "sdk enterprises" },
      {
        results: [
          {
            title: "SDK Enterprises",
            url: "https://sdk.enterprises",
            snippet: "A company.",
          },
        ],
      },
      undefined,
    );
    expect(detail).toContain("**Query:** sdk enterprises");
    expect(detail).toContain("[SDK Enterprises](https://sdk.enterprises)");
    expect(detail).toContain("A company.");
  });

  it("returns undefined for a failed call", () => {
    expect(
      buildToolDetail("sandbox-run", {}, undefined, new Error("failed")),
    ).toBeUndefined();
  });

  it("returns undefined for a tool with no formatter (e.g. ask_user, plan)", () => {
    expect(buildToolDetail("ask_user", {}, {}, undefined)).toBeUndefined();
    expect(buildToolDetail("plan", {}, {}, undefined)).toBeUndefined();
    expect(buildToolDetail("scratchpad", {}, {}, undefined)).toBeUndefined();
  });

  it("truncates a very long detail with a marker", () => {
    const detail = buildToolDetail(
      "sandbox-run",
      {},
      {
        steps: [
          {
            cmd: "cat big",
            exitCode: 0,
            stdout: "x".repeat(10_000),
            stderr: "",
          },
        ],
        didStopEarly: false,
      },
      undefined,
    );
    expect(detail?.length).toBeLessThanOrEqual(4000);
    expect(detail).toContain("(truncated)");
  });
});
