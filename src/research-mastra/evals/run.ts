import 'dotenv/config';

import {
  resolvePilotEvalMode,
} from './pilot-dataset';

import {
  runPilotExperiment,
} from './run-pilot-experiment';

async function main(): Promise<void> {
  const mode =
    resolvePilotEvalMode();

  console.log(
    `Running Pilot ${mode} experiment...`,
  );

  const startedAt =
    Date.now();

  const result =
    await runPilotExperiment();

  const durationSeconds =
    (
      (Date.now() -
        startedAt) /
      1000
    ).toFixed(1);

  console.log(
    [
      `Status: ${result.status}`,
      `Mode: ${mode}`,
      `Items: ${result.totalItems}`,
      `Succeeded: ${result.succeededCount}`,
      `Failed: ${result.failedCount}`,
      `Duration: ${durationSeconds}s`,
      `Experiment: ${result.experimentId}`,
    ].join('\n'),
  );

  if (
    result.status ===
      'failed' ||
    result.failedCount > 0
  ) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    'Pilot experiment failed:',
    error,
  );

  process.exitCode = 1;
});