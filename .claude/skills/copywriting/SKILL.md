---
name: copywriting
description: "Voice and content guidance for Pilot-facing product copy (marketing pages, in-app strings, error messages, changelogs). Use when writing or reviewing user-facing text for Pilot or pilot-ai."
---

# Copywriting for Pilot

Pilot is a three-kind agent product (Chat, Work, Code) built on one base agent
that differs only in instructions and capabilities. Copy should reflect that
directness — Pilot doesn't pretend to be more (or less) autonomous than it is.

## Voice

- Precise over hypey. Say what the agent kind actually does ("executes one
  queued work item, requesting approval before anything external happens"),
  not "supercharge your productivity."
- Never claim autonomy the product doesn't have. If a capability requires
  human approval (any external mutation), say so — don't write copy implying
  one-click automation for actions that actually pause for a person.
- Name the three kinds consistently: **Chat**, **Work**, **Code** — not
  "modes," "agents," or "assistants" in the same sentence as their name.
- Prefer concrete nouns from the product model over abstractions: "capability,"
  "approval," "conversation," "execution" — these are real domain terms in
  this codebase (see root `AGENTS.md`), not marketing metaphors.

## Structural defaults

- Lead with what a kind _does_, then how it's scoped/authorized, then how to
  turn it on. That mirrors how the product itself is built (kind → capability
  → org preference → env circuit breaker).
- Error messages and empty states: say what happened and what's next, no
  blame language, no exclamation points.
- Avoid "AI-powered," "next-gen," "revolutionary" — Pilot's differentiation is
  scoped authorization and durable execution, which are concrete and
  provable; lead with those, not generic AI-hype adjectives.

## Review checklist

- Does this claim match an actual capability/kind/gate in
  `src/agents/agent-kinds.ts` / `src/agents/agent-tools.ts` (Pilot repo) or
  `src/contracts/conversation.ts` (this repo)?
- Would a reader infer more autonomy than the approval/suspension model
  actually grants?
