import { ToolSearchProcessor } from "@mastra/core/processors";

import { githubPublic } from "../tools/code/github-public.js";
import { csvFile } from "../tools/files/csv-file.js";
import { exportResults } from "../tools/files/export-results.js";
import { exportValidator } from "../tools/files/export-validator.js";
import { markdownFile } from "../tools/files/markdown-file.js";
import { structuredData } from "../tools/files/structured-data.js";
import { bulkUrlFetch } from "../tools/web/bulk-url-fetch.js";
import { domainIntelligence } from "../tools/web/domain-intelligence.js";
import { siteDiscovery } from "../tools/web/site-discovery.js";

/**
 * Tools deferred from the initial model context. Each agent gets a fresh
 * processor instance, while `storage: 'context'` makes its selection survive
 * an interrupted or resumed request without relying on process memory.
 */
export function createToolSearchProcessor() {
  return new ToolSearchProcessor({
    tools: {
      bulkUrlFetch,
      siteDiscovery,
      structuredData,
      domainIntelligence,
      githubPublic,
      exportValidator,
      exportResults,
      csvFile,
      markdownFile,
    },
    search: { topK: 5, minScore: 0.1 },
    storage: "context",
  });
}
