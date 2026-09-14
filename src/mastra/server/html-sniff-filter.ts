import { isHtmlDocumentText } from "../agents/runtime/results.js";

// A model provider outage can return an HTML error page as 200 completion
// text; nothing forwards until there's enough of it to rule that out via
// isHtmlDocumentText; every byte after that streams as soon as it arrives.
const HTML_SNIFF_LENGTH = 15;

function checked(text: string): string {
  if (isHtmlDocumentText(text)) {
    throw new Error(
      "The model provider returned an unexpected response instead of a completion.",
    );
  }
  return text;
}

/**
 * Buffers the first HTML_SNIFF_LENGTH characters of a text stream, throwing
 * if they turn out to be an HTML document instead of releasing them.
 */
export function htmlSniffFilter() {
  let sniffed = "";
  let isPast = false;
  return {
    push(text: string): string | undefined {
      if (isPast) return text;
      sniffed += text;
      if (sniffed.length < HTML_SNIFF_LENGTH) return undefined;
      isPast = true;
      return checked(sniffed);
    },
    flush(): string | undefined {
      return isPast || sniffed.length === 0 ? undefined : checked(sniffed);
    },
  };
}
