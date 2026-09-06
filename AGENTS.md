# AGENTS.md

## CRITICAL: Verify current Mastra APIs first

There is no bundled `mastra` skill in this repository. Before any Mastra work,
read the current official documentation at https://mastra.ai/llms.txt and
inspect the installed package types. Never rely on cached knowledge — APIs
change between versions.

## Rules

- Register agents in `src/index.ts`; keep each agent's declarations and
  instructions in `src/<agent>`. Put shared processors, configuration,
  schemas, scorers, tools, storage, workflows, skills, and caches in
  `src/runtime`. Every agent must use the BaseAgent factory in
  `src/runtime/agent/base-agent.ts`; put only agent-specific processors after
  that shared pipeline. Request-scoped Pilot runtime adapters may be exported
  from the entrypoint without registering a general-purpose agent endpoint.
- Use the `dev` and `build` scripts from `package.json` instead of running `mastra dev` / `mastra build` directly

## Resources

- [Mastra Documentation](https://mastra.ai/llms.txt)
