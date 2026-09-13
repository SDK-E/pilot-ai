import "dotenv/config";

import { mastra } from "../mastra/index.js";

import { seedPilotDatasets } from "./seed-pilot-dataset.js";

async function main(): Promise<void> {
  const datasets = await seedPilotDatasets(mastra);

  console.log(
    [
      "Pilot datasets ready:",
      `- smoke: ${datasets.smoke.id}`,
      `- regression: ${datasets.regression.id}`,
      `- deep: ${datasets.deep.id}`,
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error("Failed to seed Pilot datasets:", error);

  process.exitCode = 1;
});
