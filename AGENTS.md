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
  BaseAgent factory in `src/runtime/agent/base-agent.ts`; its shared pipeline
  includes normalization, current context, compact prompt enhancement for
  short requests, reliability gates, token limiting, and a step budget. Put
  only agent-specific processors after that shared pipeline. A private helper model
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
- Production Research must remain request-scoped and import only its explicitly approved tools. Its activity callback must use the original verified Pilot OIDC token, target the fixed `PILOT_ACTIVITY_CALLBACK_URL`, and send only capability ID, lifecycle state, organization ID, and execution ID. Never send prompts, tool inputs, outputs, URLs, errors, or reasoning through that callback.
- The bounded public `web-search`, private `scratchpad`, and in-chat `ask_user` adapters are shared by request-scoped Pilot and Pilot Research agents. Web search and scratchpad retain the OIDC-verified activity callback and durable Mastra approval suspension regardless of the selected base agent. `web-search` must also retain its public-network URL safeguards. The scratchpad callback must derive organization, conversation, worker, and creator from the active execution record, never from model-controlled input. `ask_user` uses Mastra's persisted tool suspension and automatic resume on the same resource/thread; its question and choices return only through the authenticated runtime response, never the activity callback. A request-level approval policy must exempt `ask_user`, while remaining fail-closed for every external-state tool. Broader tool preferences must not become runtime tools without equivalent boundaries.

## Resources

- [Mastra Documentation](https://mastra.ai/llms.txt)
- The Vercel `api/v1/approvals/resume` entrypoint and the Mastra custom API route must remain behaviorally identical and reject a non-POST or unauthenticated request before parsing an approval command.
