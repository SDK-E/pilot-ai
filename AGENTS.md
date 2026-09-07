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
  `src/runtime`. Every registered or delegated Pilot agent must use the
  BaseAgent factory in `src/runtime/agent/base-agent.ts`; put only
  agent-specific processors after that shared pipeline. A private helper model
  created inside a processor is not a registered or delegated Pilot agent and
  must stay narrowly scoped to that processor's work. Request-scoped Pilot
  runtime adapters may be exported from the entrypoint without registering a
  general-purpose agent endpoint.
- Use the `dev` and `build` scripts from `package.json` instead of running `mastra dev` / `mastra build` directly
- A deployed Pilot runtime route must validate Pilot's Vercel OIDC token before
  parsing tenant headers or initializing Mastra. WorkOS session and organization
  authorization stay in the Pilot application; Pilot AI does not create or
  accept a separate user session.
- Any tool that fetches a model-controlled URL must validate the initial URL and every redirect against a public-network boundary before sending a request. Reject loopback, private, link-local, mixed DNS answers, local hostnames, and credential-bearing URLs; do not treat a read-only tool as safe without this check.

## Resources

- [Mastra Documentation](https://mastra.ai/llms.txt)
