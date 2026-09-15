---
name: seo
description: "Traditional search-engine optimization guidance for Pilot's marketing surfaces (landing pages, docs, blog). Use when writing or reviewing page metadata, headings, or content structure meant to rank in search."
---

# SEO for Pilot

Pilot's public surfaces are marketing/docs pages in the sibling `pilot`
(Next.js) repo, not this runtime — but conventions here keep this repo's own
public artifacts (README, docs) consistent with how Pilot should be described
externally.

## Page fundamentals

- One `<h1>` per page, matching the primary keyword intent (e.g. "AI agent
  platform for chat, work, and code" rather than a generic tagline).
- Title tags: `Page topic — Pilot` under ~60 characters; meta description
  under ~160 characters, written as a genuine summary, not a keyword stuffing
  target.
- Every page needs a unique, accurate meta description — never copy the same
  description across the three kind pages (`/chat`, `/work`, `/code`); each
  kind has a distinct purpose per the product model and should rank for its
  own intent.
- Use semantic HTML headings in order (`h1` → `h2` → `h3`); don't skip levels
  for visual styling.

## Structure that matches the product

- Because Chat/Work/Code are the real product taxonomy, use them as the
  information architecture for SEO too: three clear landing sections/pages
  beat one page trying to rank for all three intents at once.
- Internal links between the kind pages and the docs describing capabilities
  (web search, scratchpad, code sandbox) build topical relevance — link with
  descriptive anchor text ("code sandbox capability"), not "click here."

## Technical basics

- Canonical URLs on every indexable page; noindex anything that's a duplicate
  or an internal/preview surface.
- Sitemap and robots.txt kept current with the actual route set — don't list
  a `/work` or `/code` route in the sitemap before it ships.
- Page speed matters for ranking: keep marketing pages free of unnecessary
  client JS; this is a backend-heavy product, the marketing site doesn't need
  to be.
