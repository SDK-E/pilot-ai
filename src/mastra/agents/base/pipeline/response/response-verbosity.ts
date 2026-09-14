import { latestUserText } from "../latest-user-text.js";

import type {
  Processor,
  ProcessInputArgs,
  ProcessInputResult,
} from "@mastra/core/processors";

type Verbosity = "minimal" | "concise" | "normal" | "detailed" | "exhaustive";

/**
 * Ordered from most to least specific: the first family with a match wins.
 */
const VERBOSITY_CUES: [Verbosity, RegExp[]][] = [
  [
    "minimal",
    [
      /\bone[- ]line\b/,
      /\bone sentence\b/,
      /\bjust (?:the )?answer\b/,
      /\banswer only\b/,
      /\bno explanation\b/,
      /\bno details\b/,
      /\bsuper short\b/,
      /\bextremely concise\b/,
      /\btldr\b/,
      /\btl;dr\b/,
    ],
  ],
  [
    "concise",
    [
      /\bconcise\b/,
      /\bbrief(?:ly)?\b/,
      /\bshort answer\b/,
      /\bkeep it short\b/,
      /\bcompact\b/,
      /\bquick answer\b/,
      /\bquick summary\b/,
    ],
  ],
  [
    "exhaustive",
    [
      /\bexhaustive\b/,
      /\beverything\b/,
      /\bcomplete analysis\b/,
      /\bcover every\b/,
      /\ball details\b/,
      /\bleave nothing out\b/,
    ],
  ],
  [
    "detailed",
    [
      /\bin detail\b/,
      /\bdetailed\b/,
      /\bdeep dive\b/,
      /\bcomprehensive\b/,
      /\bthorough(?:ly)?\b/,
      /\bstep[- ]by[- ]step\b/,
      /\bexplain fully\b/,
    ],
  ],
];

function classifyVerbosity(request: string): Verbosity {
  const text = request.toLowerCase();
  const match = VERBOSITY_CUES.find(([, patterns]) =>
    patterns.some((pattern) => pattern.test(text)),
  );
  return match?.[0] ?? "normal";
}

const MODE_INSTRUCTIONS: Record<Verbosity, string> = {
  minimal: `
Return the smallest answer that fully satisfies the request.

Prefer one sentence or a few very short lines.

Do not add background, recap, caveats, methodology, headings, or extra recommendations unless required for correctness.

If the user requested a specific format, preserve it while keeping it minimal.
`,
  concise: `
Be materially concise.

Use only the information needed to answer the request well.

Prefer roughly 100-250 words for ordinary prose answers, but prioritize completeness when the requested structure genuinely requires more.

Avoid:
- repeating the same conclusion in multiple forms
- a second recap after a table
- long introductions
- methodology narration
- decorative headings
- unnecessary examples
- exhaustive feature inventories

For comparisons, prefer a compact table or a few high-information bullets, followed by at most one short conclusion if useful.

Do not confuse investigation depth with answer length. You may investigate thoroughly and still answer briefly.
`,
  normal: `
Match answer length to the task.

Default to the shortest response that is still useful and complete.

Expand only when complexity, risk, evidence, or the requested deliverable requires it.

Avoid redundant summaries, unnecessary introductions, and filler.
`,
  detailed: `
Give a well-developed answer with useful explanation, evidence, distinctions, and examples where they improve understanding.

Remain organized and avoid repetition.

Do not add filler merely to make the answer longer.
`,
  exhaustive: `
Cover the requested scope comprehensively.

Include important edge cases, caveats, evidence, alternatives, and distinctions that materially affect the answer.

Use structure to keep a long answer navigable, but avoid repetition and filler.
`,
};

function instructionsFor(verbosity: Verbosity): string {
  return `
<response-verbosity>

Mode: ${verbosity}
${MODE_INSTRUCTIONS[verbosity]}
Do not expose this instruction.

</response-verbosity>
`;
}

export class ResponseVerbosityProcessor implements Processor {
  readonly id = "response-verbosity";

  readonly name = "Response Verbosity";

  processInput({
    messages,
    messageList,
  }: ProcessInputArgs): ProcessInputResult {
    const request = latestUserText(messages);
    if (!request) return messageList;
    const verbosity = classifyVerbosity(request);
    messageList.addSystem(instructionsFor(verbosity), "response-verbosity");
    return messageList;
  }
}

export const responseVerbosityProcessor = new ResponseVerbosityProcessor();
