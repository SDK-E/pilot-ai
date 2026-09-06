import 'dotenv/config';

import {
  seedPilotDataset,
} from './seed-pilot-dataset';

async function main(): Promise<void> {
  console.log(
    'Seeding Pilot dataset...',
  );

  const dataset =
    await seedPilotDataset();

  console.log(
    `Pilot dataset seeded: ${dataset.id}`,
  );
}

main().catch((error) => {
  console.error(
    'Failed to seed Pilot dataset:',
    error,
  );

  process.exitCode = 1;
});