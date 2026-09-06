import type {
  Mastra,
} from '@mastra/core/mastra';

import {
  pilotDatasets,
  type PilotDatasetDefinition,
  type PilotEvalMode,
} from './pilot-dataset';

async function findExistingDataset(
  mastra: Mastra,
  name: string,
) {
  const result =
    await mastra.datasets.list({
      page: 0,
      perPage: 100,
    });

  return result.datasets.find(
    (dataset) =>
      dataset.name === name,
  );
}

async function addMissingItems(
  dataset: Awaited<
    ReturnType<
      Mastra['datasets']['get']
    >
  >,
  definition: PilotDatasetDefinition,
): Promise<void> {
  const result =
    await dataset.listItems({
      page: 0,
      perPage: 100,
    });

  const items =
    Array.isArray(result)
      ? result
      : result.items;

  const existingInputs =
    new Set(
      items.map(
        (item) =>
          JSON.stringify(
            item.input,
          ),
      ),
    );

  const missingItems =
    definition.items.filter(
      (item) =>
        !existingInputs.has(
          JSON.stringify(
            item.input,
          ),
        ),
    );

  if (
    missingItems.length === 0
  ) {
    return;
  }

  await dataset.addItems({
    items:
      missingItems.map(
        (item) => ({
          input:
            item.input,

          groundTruth:
            item.groundTruth,
        }),
      ),
  });
}

async function ensureDataset(
  mastra: Mastra,
  definition: PilotDatasetDefinition,
) {
  const existing =
    await findExistingDataset(
      mastra,
      definition.name,
    );

  const dataset =
    existing
      ? await mastra.datasets.get({
          id: existing.id,
        })
      : await mastra.datasets.create({
          name:
            definition.name,

          description:
            definition.description,
        });

  await addMissingItems(
    dataset,
    definition,
  );

  return dataset;
}

export async function seedPilotDataset(
  mastra: Mastra,
  mode: PilotEvalMode = 'smoke',
) {
  return ensureDataset(
    mastra,
    pilotDatasets[mode],
  );
}

export async function seedPilotDatasets(
  mastra: Mastra,
) {
  const smoke =
    await ensureDataset(
      mastra,
      pilotDatasets.smoke,
    );

  const regression =
    await ensureDataset(
      mastra,
      pilotDatasets.regression,
    );

  const deep =
    await ensureDataset(
      mastra,
      pilotDatasets.deep,
    );

  return {
    smoke,
    regression,
    deep,
  };
}