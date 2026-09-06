import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.mastra/**",
      "**/*.eval.test.ts",
    ],
  },
});
