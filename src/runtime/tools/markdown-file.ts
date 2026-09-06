import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

function sanitizeFilename(
  value: string,
): string {
  const sanitized = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!sanitized) {
    return 'pilot-export.md';
  }

  return /\.md(?:own)?$/i.test(sanitized)
    ? sanitized
    : `${sanitized}.md`;
}

export const markdownFile = createTool({
  id: 'markdown-file',

  description:
    'Create a Markdown file from final user-facing content. Use for reports, research notes, lead briefs, comparison documents, README-style exports, or whenever the user asks for Markdown output.',

  inputSchema: z.object({
    filename: z
      .string()
      .min(1)
      .default('pilot-export.md'),

    content: z
      .string()
      .min(1),
  }),

  outputSchema: z.object({
    filename: z.string(),
    content: z.string(),
    characterCount: z.number().int(),
  }),

  execute: async ({
    filename,
    content,
  }) => {
    const normalized =
      content.trimEnd();

    return {
      filename:
        sanitizeFilename(filename),
      content:
        `${normalized}\n`,
      characterCount:
        normalized.length,
    };
  },

  toModelOutput: (output) => ({
    type: 'text',
    value:
      `Created ${output.filename} with ${output.characterCount} characters.`,
  }),
});