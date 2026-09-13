import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "#runtime/": `${root}src/runtime/`,
      "#runtime/config": `${root}src/research/runtime/config`,
      "#runtime/config/*": `${root}src/research/runtime/config/*`,
      "#runtime/workflows/*": `${root}src/research/runtime/workflows/*`,
      "#research/": `${root}src/research/`,
      "#conversation/": `${root}src/conversation/`,
    },
  },
  test: {
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.mastra/**",
      "**/*.eval.test.ts",
    ],
  },
});
