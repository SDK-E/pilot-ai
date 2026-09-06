import { mastra } from '../index';

import {
  pilotDatasetDescription,
  pilotDatasetItems,
  pilotDatasetName,
} from './pilot-dataset';

export async function seedPilotDataset() {
  const dataset = await mastra.datasets.create({
    name: pilotDatasetName,

    description:
      pilotDatasetDescription,
  });

  await dataset.addItems({
    items: pilotDatasetItems.map(
      (item) => ({
        input: item.input,

        groundTruth:
          item.groundTruth,
      }),
    ),
  });

  return dataset;
}