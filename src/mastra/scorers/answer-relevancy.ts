import {
  createAnswerRelevancyScorer,
} from '@mastra/evals/scorers/prebuilt';

export const answerRelevancyScorer =
  createAnswerRelevancyScorer({
    model:
      'kilo/kilo-auto/free',
  });