# AGENTS.md

## CRITICAL: Verify current Mastra APIs first

There is no bundled `mastra` skill in this repository. Before any Mastra work,
read the current official documentation at https://mastra.ai/llms.txt and
inspect the installed package types. Never rely on cached knowledge — APIs
change between versions.

## Rules

- Register agents, tools, workflows, and scorers exposed by the Mastra service
  in `src/mastra/index.ts`. Request-scoped Pilot runtime adapters may be
  exported there without registering a general-purpose agent endpoint.
- Use the `dev` and `build` scripts from `package.json` instead of running `mastra dev` / `mastra build` directly

## Resources

- [Mastra Documentation](https://mastra.ai/llms.txt)
