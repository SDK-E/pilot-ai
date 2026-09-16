import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.mastra/**",
      ".agents/skills/**",
      ".claude/skills/**",
    ],
  },
});
