type MessageContentPart = {
  type?: string;
  text?: string;
};

type MessageLike = {
  content?: unknown;
};

function contentToText(
  content: unknown,
): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }

        if (
          part &&
          typeof part === 'object'
        ) {
          const value =
            part as MessageContentPart;

          if (
            value.type === 'text' &&
            typeof value.text === 'string'
          ) {
            return value.text;
          }
        }

        return '';
      })
      .filter(Boolean)
      .join('\n');
  }

  if (
    content &&
    typeof content === 'object'
  ) {
    const value =
      content as {
        text?: unknown;
      };

    if (typeof value.text === 'string') {
      return value.text;
    }
  }

  return '';
}

export function agentOutputToText(
  output: unknown,
): string {
  if (typeof output === 'string') {
    return output;
  }

  if (Array.isArray(output)) {
    return output
      .map((message) => {
        if (
          !message ||
          typeof message !== 'object'
        ) {
          return '';
        }

        return contentToText(
          (message as MessageLike)
            .content,
        );
      })
      .filter(Boolean)
      .join('\n');
  }

  if (
    output &&
    typeof output === 'object'
  ) {
    const value =
      output as MessageLike;

    return contentToText(
      value.content,
    );
  }

  return '';
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