export const pilotDatasetName =
  'pilot-browser-regression';

export const pilotDatasetDescription =
  'Regression dataset for Pilot Browser covering research quality, current technical research, source use, delegation, memory-aware continuation, and failure recovery.';

export const pilotDatasetItems = [
  {
    input:
      'What is the current recommended way to register child agents in Mastra and configure delegation? Use current official sources and keep the answer concise.',

    groundTruth: {
      expectations: [
        'Uses current Mastra documentation or repository evidence.',
        'Explains current child-agent registration.',
        'Explains current delegation configuration.',
        'Distinguishes current APIs from outdated examples.',
      ],
    },
  },

  {
    input:
      'Research the current Mastra memory model. Explain the difference between working memory, semantic recall, observational memory, and token limiting. Use current sources.',

    groundTruth: {
      expectations: [
        'Explains working memory.',
        'Explains semantic recall.',
        'Explains observational memory.',
        'Explains token limiting.',
        'Uses current evidence.',
      ],
    },
  },

  {
    input:
      'Find the current Mastra release/version state and verify it using official repository or release evidence. Mention any version-sensitive behavior relevant to agents or evals.',

    groundTruth: {
      expectations: [
        'Uses current release or repository evidence.',
        'Reports version-sensitive information carefully.',
        'Does not rely solely on remembered package versions.',
      ],
    },
  },

  {
    input:
      'Compare Mastra and LangGraph specifically for supervisor/subagent orchestration. Keep the comparison technical, current, and evidence-based.',

    groundTruth: {
      expectations: [
        'Researches both frameworks.',
        'Stays focused on supervisor/subagent orchestration.',
        'Uses current sources.',
        'Separates facts from interpretation.',
      ],
    },
  },

  {
    input:
      'Research Mastra observability, datasets, experiments, scorers, and gates. Explain how they fit together for testing an agent before production.',

    groundTruth: {
      expectations: [
        'Explains observability.',
        'Explains datasets.',
        'Explains experiments.',
        'Explains scorers.',
        'Explains deterministic gates.',
        'Connects them into one evaluation loop.',
      ],
    },
  },

  {
    input:
      'Research the Mastra GitHub repository and identify the current implementation or documentation evidence for ToolSearchProcessor. Use repository evidence where possible.',

    groundTruth: {
      expectations: [
        'Uses GitHub or repository evidence.',
        'Finds ToolSearchProcessor evidence.',
        'Reports current behavior rather than guessing.',
      ],
    },
  },

  {
    input:
      'Use broad web discovery to find three strong current sources about Mastra agent memory. Deduplicate equivalent sources and explain which source is strongest and why.',

    groundTruth: {
      expectations: [
        'Finds multiple sources.',
        'Deduplicates equivalent evidence.',
        'Compares source quality.',
        'Identifies strongest source.',
      ],
    },
  },

  {
    input:
      'Research one current claim about Mastra supervisor agents, then actively try to disprove that claim using another evidence path before giving your final confidence.',

    groundTruth: {
      expectations: [
        'Identifies a concrete claim.',
        'Searches for disconfirming evidence.',
        'Reports contradictions if found.',
        'Assigns confidence.',
      ],
    },
  },

  {
    input:
      'Fetch a clearly nonexistent page under the Mastra documentation domain, recover without repeatedly retrying it, and still answer what Mastra Experiments are using another valid source.',

    groundTruth: {
      expectations: [
        'Handles the failed fetch.',
        'Does not repeatedly hammer the same failing URL.',
        'Recovers using another source.',
        'Still answers the question.',
      ],
    },
  },

  {
    input:
      'Research whether Mastra Experiments execute agent tools live or replay recorded tool outputs by default. Verify carefully and mention uncertainty or limitations.',

    groundTruth: {
      expectations: [
        'Checks current experiment behavior.',
        'Distinguishes live execution from replay or mocking.',
        'Uses current evidence.',
        'Reports limitations accurately.',
      ],
    },
  },
] as const;