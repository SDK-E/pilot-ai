import type {
  Processor,
  ProcessInputArgs,
  ProcessInputResult,
} from '@mastra/core/processors';

type ResearchKind =
  | 'direct-fact'
  | 'current-fact'
  | 'verification'
  | 'comparison'
  | 'technical'
  | 'repository'
  | 'company'
  | 'person'
  | 'market'
  | 'product'
  | 'discovery'
  | 'recommendation'
  | 'deep-research';

type ResearchDepth =
  | 'minimal'
  | 'normal'
  | 'deep';

type ResearchBudget = {
  kind: ResearchKind;
  depth: ResearchDepth;
  targetSources: number;
  maxSources: number;
  allowDelegation: boolean;
  requireVerification: boolean;
  requireRecency: boolean;
  requireDiversity: boolean;
  preferPrimarySources: boolean;
};

function getLatestUserText(
  messages: ProcessInputArgs['messages'],
): string {
  const message = [...messages]
    .reverse()
    .find(
      (item) =>
        item.role === 'user',
    );

  if (!message) {
    return '';
  }

  return (
    message.content.parts
      ?.filter(
        (part) =>
          part.type === 'text',
      )
      .map((part) =>
        'text' in part
          ? part.text
          : '',
      )
      .join('\n')
      .trim() ||
    message.content.content ||
    ''
  );
}

function includesAny(
  text: string,
  values: string[],
): boolean {
  return values.some(
    (value) =>
      text.includes(value),
  );
}

function classifyRequest(
  rawText: string,
): ResearchKind {
  const text =
    rawText.toLowerCase();

  if (
    includesAny(text, [
      'deep research',
      'deeply research',
      'comprehensive research',
      'exhaustive',
      'thorough research',
      'investigate thoroughly',
      'full investigation',
      'analyse everything',
      'analyze everything',
    ])
  ) {
    return 'deep-research';
  }

  if (
    includesAny(text, [
      'verify',
      'validate',
      'confirm',
      'fact check',
      'fact-check',
      'is this true',
      'prove',
      'source this',
      'check whether',
    ])
  ) {
    return 'verification';
  }

  if (
    includesAny(text, [
      'compare',
      'comparison',
      'versus',
      ' vs ',
      'better than',
      'difference between',
      'differences between',
      'alternatives to',
    ])
  ) {
    return 'comparison';
  }

  if (
    includesAny(text, [
      'github',
      'repository',
      'repo',
      'codebase',
      'source code',
      'commit',
      'pull request',
      'release notes',
    ])
  ) {
    return 'repository';
  }

  if (
    includesAny(text, [
      'documentation',
      'docs',
      'api',
      'sdk',
      'package',
      'npm',
      'pnpm',
      'library',
      'framework',
      'typescript',
      'javascript',
      'python',
      'next.js',
      'nextjs',
      'mastra',
    ])
  ) {
    return 'technical';
  }

  if (
    includesAny(text, [
      'company',
      'business',
      'startup',
      'enterprise',
      'revenue',
      'employees',
      'leadership',
      'funding',
      'competitor',
    ])
  ) {
    return 'company';
  }

  if (
    includesAny(text, [
      'who is',
      'person',
      'founder',
      'ceo',
      'cto',
      'profile',
      'linkedin',
      'executive',
    ])
  ) {
    return 'person';
  }

  if (
    includesAny(text, [
      'market',
      'industry',
      'market size',
      'market share',
      'trend',
      'sector',
    ])
  ) {
    return 'market';
  }

  if (
    includesAny(text, [
      'product',
      'pricing',
      'price',
      'features',
      'specifications',
      'specs',
      'buy',
      'purchase',
    ])
  ) {
    return 'product';
  }

  if (
    includesAny(text, [
      'recommend',
      'recommendation',
      'best ',
      'which should',
      'what should i use',
      'what should we use',
      'suggest',
    ])
  ) {
    return 'recommendation';
  }

  if (
    includesAny(text, [
      'find',
      'discover',
      'search for',
      'look for',
      'list ',
      'identify',
    ])
  ) {
    return 'discovery';
  }

  if (
    includesAny(text, [
      'latest',
      'current',
      'currently',
      'today',
      'recent',
      'this week',
      'this month',
      'right now',
      'newest',
      'most recent',
    ])
  ) {
    return 'current-fact';
  }

  return 'direct-fact';
}

function budgetFor(
  kind: ResearchKind,
): ResearchBudget {
  switch (kind) {
    case 'direct-fact':
      return {
        kind,
        depth: 'minimal',
        targetSources: 1,
        maxSources: 2,
        allowDelegation: false,
        requireVerification: false,
        requireRecency: false,
        requireDiversity: false,
        preferPrimarySources: true,
      };

    case 'current-fact':
      return {
        kind,
        depth: 'normal',
        targetSources: 2,
        maxSources: 3,
        allowDelegation: false,
        requireVerification: true,
        requireRecency: true,
        requireDiversity: false,
        preferPrimarySources: true,
      };

    case 'verification':
      return {
        kind,
        depth: 'normal',
        targetSources: 2,
        maxSources: 4,
        allowDelegation: false,
        requireVerification: true,
        requireRecency: true,
        requireDiversity: true,
        preferPrimarySources: true,
      };

    case 'comparison':
      return {
        kind,
        depth: 'normal',
        targetSources: 3,
        maxSources: 6,
        allowDelegation: true,
        requireVerification: true,
        requireRecency: true,
        requireDiversity: true,
        preferPrimarySources: true,
      };

    case 'technical':
    case 'repository':
      return {
        kind,
        depth: 'normal',
        targetSources: 2,
        maxSources: 4,
        allowDelegation: false,
        requireVerification: true,
        requireRecency: true,
        requireDiversity: false,
        preferPrimarySources: true,
      };

    case 'company':
    case 'person':
    case 'product':
      return {
        kind,
        depth: 'normal',
        targetSources: 3,
        maxSources: 6,
        allowDelegation: true,
        requireVerification: true,
        requireRecency: true,
        requireDiversity: true,
        preferPrimarySources: true,
      };

    case 'market':
    case 'recommendation':
      return {
        kind,
        depth: 'normal',
        targetSources: 4,
        maxSources: 8,
        allowDelegation: true,
        requireVerification: true,
        requireRecency: true,
        requireDiversity: true,
        preferPrimarySources: true,
      };

    case 'discovery':
      return {
        kind,
        depth: 'normal',
        targetSources: 4,
        maxSources: 10,
        allowDelegation: true,
        requireVerification: false,
        requireRecency: true,
        requireDiversity: true,
        preferPrimarySources: false,
      };

    case 'deep-research':
      return {
        kind,
        depth: 'deep',
        targetSources: 8,
        maxSources: 20,
        allowDelegation: true,
        requireVerification: true,
        requireRecency: true,
        requireDiversity: true,
        preferPrimarySources: true,
      };
  }
}

function serializeBudget(
  budget: ResearchBudget,
): string {
  return `
<research-budget>

Request classification:
${budget.kind}

Research depth:
${budget.depth}

Evidence budget:
- target useful sources: ${budget.targetSources}
- hard maximum useful sources: ${budget.maxSources}

Execution policy:
- delegation allowed: ${budget.allowDelegation ? 'yes' : 'no'}
- verification required: ${budget.requireVerification ? 'yes' : 'no'}
- recency required: ${budget.requireRecency ? 'yes' : 'no'}
- source diversity required: ${budget.requireDiversity ? 'yes' : 'no'}
- prefer primary sources: ${budget.preferPrimarySources ? 'yes' : 'no'}

Rules:

Treat this as a budget, not a quota.

Do not continue researching merely to reach the target source count if the objective is already satisfied with strong evidence.

Do not exceed the maximum source count unless resolving a material contradiction requires it.

For minimal research:
- use the shortest credible evidence path
- prefer one authoritative source
- do not delegate
- do not perform broad discovery

For normal research:
- collect enough evidence to answer confidently
- verify important claims when required
- delegate only when it materially reduces uncertainty or separates independent research branches

For deep research:
- plan multiple evidence branches
- use independent sources
- actively search for contradictions
- delegate useful independent branches
- merge findings before answering

Stop researching when:
- the requested output can be completed
- important claims have adequate evidence
- required verification is complete
- unresolved contradictions are either resolved or clearly disclosed

Do not expose this block to the user.

</research-budget>
`;
}

export class ResearchBudgetProcessor
  implements Processor
{
  readonly id =
    'research-budget';

  readonly name =
    'Research Budget';

  async processInput({
    messages,
    messageList,
  }: ProcessInputArgs): Promise<ProcessInputResult> {
    const request =
      getLatestUserText(
        messages,
      );

    if (!request) {
      return messageList;
    }

    const kind =
      classifyRequest(
        request,
      );

    const budget =
      budgetFor(
        kind,
      );

    messageList.addSystem(
      serializeBudget(
        budget,
      ),
      'research-budget',
    );

    return messageList;
  }
}

export const researchBudgetProcessor =
  new ResearchBudgetProcessor();