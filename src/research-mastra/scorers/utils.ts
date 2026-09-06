type TextLike = {
  text?: unknown;
  content?: unknown;
  output?: unknown;
  message?: unknown;
  messages?: unknown;
  response?: unknown;
};

function contentToText(
  value: unknown,
  seen = new Set<unknown>(),
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (
    typeof value !== 'object'
  ) {
    return '';
  }

  if (seen.has(value)) {
    return '';
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value
      .map((item) =>
        contentToText(
          item,
          seen,
        ),
      )
      .filter(Boolean)
      .join('\n');
  }

  const object =
    value as TextLike;

  if (
    typeof object.text ===
    'string'
  ) {
    return object.text;
  }

  const candidates = [
    object.content,
    object.output,
    object.message,
    object.messages,
    object.response,
  ];

  for (
    const candidate of candidates
  ) {
    const text =
      contentToText(
        candidate,
        seen,
      );

    if (text) {
      return text;
    }
  }

  return '';
}

export function agentOutputToText(
  output: unknown,
): string {
  return contentToText(
    output,
  ).trim();
}

export function uniqueUrls(
  text: string,
): string[] {
  const matches =
    text.match(
      /https?:\/\/[^\s)\]}"'<>]+/gi,
    ) ?? [];

  return [
    ...new Set(
      matches.map((url) =>
        url.replace(
          /[.,;:!?]+$/,
          '',
        ),
      ),
    ),
  ];
}