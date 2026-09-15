---
name: ai-readiness
description: "Making Pilot's public surfaces discoverable and safely crawlable by AI agents and crawlers (llms.txt, structured data, robots rules for AI bots). Use when setting up or reviewing how automated agents/crawlers should access Pilot's docs and marketing site."
---

# AI-readiness / agent discoverability for Pilot

Pilot is itself an agent product, so its own public surfaces should model good
agent-discoverability practice.

## `llms.txt`-style discoverability

- Publish an `llms.txt` at the marketing site root (in the `pilot` repo, not
  here) listing: what Pilot is, the three kinds and their purpose, links to
  the docs pages for capabilities and the approval model, and a link to the
  runtime API's public description if one is published. Keep it a flat
  Markdown list of links with one-line descriptions — it is a sitemap for
  models, not a full doc.
- Keep `llms.txt` in sync with the real route set; a stale entry pointing at a
  removed page is worse than no `llms.txt` at all, since a model will cite the
  dead link with confidence.

## Structured data

- `SoftwareApplication` JSON-LD on the product/marketing pages naming the
  three kinds as `featureList` entries.
- `FAQPage` JSON-LD wherever the `ai-seo` skill's FAQ blocks live — this is
  the same content serving two purposes (human search snippet + machine
  extraction).

## Crawl policy for AI/agent user agents

- Decide explicitly whether `GPTBot`, `PerplexityBot`, `ClaudeBot`, etc. may
  crawl marketing/docs pages (usually yes — that's the audience for
  `ai-seo`/`ai-readiness` work) versus the authenticated app and the runtime
  API under `ai.pilot.sdk.enterprises` (always no — nothing behind
  `getWorkspaceSession()`/the WorkOS M2M boundary should ever be crawlable,
  regardless of `robots.txt`, since the real protection is authentication,
  not politeness).
- `robots.txt` disallow rules are a courtesy signal only; never treat them as
  the security boundary for the runtime API — that boundary is the WorkOS M2M
  check (`workos` skill) and org/session scoping in Pilot.

## For agents integrating with Pilot programmatically

- The runtime's OpenAI-compatible `POST /v1/chat/completions` (see the
  `vercel` skill) is the only intended machine entry point today, and it is
  gated behind Pilot's own session + WorkOS M2M forwarding — there is no
  anonymous or API-key-only path for a third-party agent to call pilot-ai
  directly, and `ai-readiness` work should not imply otherwise.
