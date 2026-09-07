import { ToolSearchProcessor } from '@mastra/core/processors';

import { bulkUrlFetch } from '#runtime/tools/bulk-url-fetch';
import { csvFile } from '#runtime/tools/csv-file';
import { domainIntelligence } from '#runtime/tools/domain-intelligence';
import { exportResults } from '#runtime/tools/export-results';
import { exportValidator } from '#runtime/tools/export-validator';
import { markdownFile } from '#runtime/tools/markdown-file';
import { siteDiscovery } from '#runtime/tools/site-discovery';
import { structuredData } from '#runtime/tools/structured-data';
import { githubPublic } from '#runtime/research/tools/github-public';

/**
 * Tools deferred from the initial model context. Each agent gets a fresh
 * processor instance, while `storage: 'context'` makes its selection survive
 * an interrupted or resumed request without relying on process memory.
 */
export function createResearchToolSearchProcessor() {
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
    storage: 'context',
  });
}
