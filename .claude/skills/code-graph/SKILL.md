---
name: code-graph
description: Trace what imports or is imported by a given file or exported symbol in this repo's TypeScript source, without reading every candidate file. Use before making a change to understand blast radius (who depends on this?), before renaming/removing an export, or whenever you'd otherwise grep for imports and open a pile of files to figure out relationships — this gives the same answer for far fewer tokens.
---

# Code graph (pilot)

`pnpm graph <path-or-symbol> [--depth N] [--symbol]` runs `scripts/code-graph.mts`.

## Two modes

- **File mode** (default): give a path (relative or absolute, `.ts`/`.tsx`). Reports what that file imports and what imports it, expanding outward `--depth` hops (default 1).
- **Symbol mode** (`--symbol`): give an exported symbol name (function, type, const). It finds the file(s) that export it, then does the same import/importer expansion from there. Use this when you know *what* you're touching (a function name) but not *where* it lives.

## Why use this over grep

A plain `grep` for an import string misses NodeNext-style specifiers (`./foo.js` importing a real `foo.ts`) and doesn't distinguish "imports this" from "is imported by this." This tool resolves both directions correctly against the repo's actual `tsconfig.json` paths and on-disk extensions, and reports a clean two-way graph instead of a flat match list.

## Reading the output

- If a symbol/path reports "not tracked" or "no exported symbol found," that's a real answer (it genuinely isn't used/exported here) — not a tool failure. This is expected when checking a symbol that lives in the other repo (pilot vs pilot-ai) instead.
- Start with `--depth 1`; only increase it if the immediate neighbors aren't enough context — depth grows the result fast in a well-connected file.

## When to reach for this first

Before editing a shared type, a widely-imported util, or an agent tool definition, run this to see the actual importer list rather than assuming from the file's location. It's meant to replace "grep + open five files to check" with one command.

## Invocation

Call it plainly — `pnpm graph src/foo.ts`, no `--` separator needed. If `--` output ever looks odd (e.g. the target reads as `--`), drop it; it isn't part of the documented syntax above.
