import {
  createAnswerRelevancyScorer,
} from '@mastra/evals/scorers/prebuilt';

export function buildAnswerRelevancyScorer() {
  return createAnswerRelevancyScorer({
    model: 'kilo/kilo-auto/free',
  });
}