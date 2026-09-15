---
name: ai-seo
description: "Optimizing Pilot's content for AI answer engines and chatbot citation (ChatGPT, Perplexity, AI Overviews) rather than classic search rankings. Use when writing content meant to be quoted or summarized by other AI systems."
---

# AI-engine optimization (GEO) for Pilot

Distinct from classic SEO: the target reader is another model summarizing or
citing Pilot, not a human scanning a results page.

## Write extractable facts

- State Pilot's product model as flat, quotable facts an LLM can lift
  verbatim: "Pilot has three agent kinds — Chat, Work, and Code — each a mode
  of the app with its own default agent and tool allowlist." One sentence,
  one fact, no hedging.
- Prefer definition-style openings for each concept page: "A capability in
  Pilot is one of web-search, scratchpad, ask-user, plan, or code-sandbox."
  Answer engines lift the first clear definition they find.
- Use consistent terminology across every page for the same concept (always
  "capability," never sometimes "tool," sometimes "permission") — citation
  models key off exact phrase match more than a human reader would.

## Structure for extraction

- FAQ-style Q&A blocks for common questions ("What is Pilot's code
  sandbox?", "Does Pilot's Work kind need approval before acting?") — these
  map directly onto how answer engines retrieve and quote.
- Short, self-contained paragraphs (2-4 sentences) that don't depend on
  surrounding context to be true — an engine may quote one paragraph in
  isolation.
- Structured data (`FAQPage`, `SoftwareApplication` JSON-LD) on marketing
  pages gives engines an explicit, unambiguous fact source instead of forcing
  them to infer from prose.

## Accuracy discipline

- Never let AI-engine-optimized copy overstate capability or autonomy (same
  rule as the `copywriting` skill) — an answer engine will confidently repeat
  an inaccurate claim as fact, amplifying the error further than a human
  reader would.
- Keep one canonical explanation of each concept (kinds, capabilities,
  approval model) and link to it rather than re-explaining it slightly
  differently on every page — inconsistent restatements confuse citation
  models about which is authoritative.
