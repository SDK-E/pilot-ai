# Pilot Conversation design plan

This plan adapts the reliable parts of the Pilot Research Agent into a general conversational runtime profile. It is not a second product Worker type and it does not change the research implementation.

## Product behavior

Pilot Conversation is the default conversational runtime for a Pilot Worker. It should hold a useful, natural conversation, remember the current Pilot Conversation, and answer directly whenever it has enough information. It has access to tools, but research, browsing and external actions are capabilities it uses when the user asks for something that needs them; they are not its default purpose.

The model never decides whether it may use a capability. Pilot resolves the active Worker's permissions, integrations and approval policy before each runtime call. `pilot-ai` receives that already-authorized capability set and cannot expand it.

## Reuse from Pilot Research Agent

| Pilot Research Agent component | Pilot Conversation decision |
| --- | --- |
| Kilo Gateway model configuration and retry policy | Reuse as the initial model adapter, with the Worker-selected model checked against Pilot's server allowlist. |
| `BaseAgent` | Reuse the identity contract and shared normalization, context, objective continuity, response-quality, recovery, bounded retry, token and step-budget pipeline. |
| `UnicodeNormalizer` | Reuse to normalize untrusted message text before model input. |
| `TokenLimiterProcessor` and step budget | Reuse with smaller conversational limits and a clear terminal reply when a limit is reached. |
| Response quality, verbosity and process-narration processors | Reuse their conversation-safe parts so replies stay direct, proportionate and free of internal runtime narration. |
| `ToolSearchProcessor` | Reuse for authorized tool discovery only. Supply the tool set dynamically from request context, use `storage: 'context'` so loaded-tool state survives process restarts, and filter every search/load/activation against the request's allowed tool IDs. |
| Mastra `Memory` | Reuse message history with the stable Pilot Worker resource and Pilot Conversation thread. Start with message history only; add observational memory after normal two-turn persistence is proven. |
| Tool approval and suspended-run support | Reuse when an authorized capability requires approval. Pilot owns the approval record, user experience and resume authorization. |
| Agent tests, evals and scorer approach | Reuse the discipline, not the research-specific datasets. Add a small conversational regression suite for memory, authorization, direct answers, allowed tools, denied tools and approval suspension. |

## Do not copy from Pilot Research Agent

- Browser-first identity and research-planning instructions.
- Discovery, technical and verification subagents; conversation delegation comes later as an explicit Worker capability.
- Broad static registration of `webSearch`, `searchDorks`, Stagehand, marketplace skills, scratchpad and result-collection tools.
- Research-only processors: source confidence, recency, contradiction, source diversity, claim challenge, entity resolution, research budget and research policy.
- Local LibSQL, DuckDB, FastEmbed and all checked-in local database fallbacks.
- Browser-specific workflow/eval fixtures and Editor datasets in the deployed conversation path.

## Tool policy

Pilot Conversation may have tools, but each call receives a narrow capability set. Pilot exposes only tools enabled for the organization, Worker and active request.

1. **Direct conversation:** no tool is needed for explanation, drafting, brainstorming or a response based on conversation history.
2. **Read-only research:** when Pilot grants it, allow narrowly scoped public web search, URL reading or public repository inspection. These are optional tools; the agent must not research merely to make a response look thorough.
3. **Connected integrations:** add only after Pilot has an Integration record, scoped credentials and an explicit Worker permission. The tool is created per request with only that connection's credentials.
4. **External mutation:** every send, write, purchase, publish, delete or production action requires a Pilot approval record and Mastra tool suspension before execution. The resumed request must recheck authorization, approval status and idempotency.
5. **Browser control:** treat it as an integration capability. Stagehand is never a default conversation tool and cannot submit a form or act externally without the prior approval path.

For the first conversational slice, expose at most a small read-only tool set once Pilot can enforce a `web:read` capability. Do not add write tools, MCP connections, browser control, filesystem access, subagents or workflows until their Pilot permission and approval path exists.

## Runtime shape

Pilot sends a typed, server-generated command containing organization ID, Worker ID and instructions, Conversation ID, new user message, and allowed tool IDs. The browser sends only the new message to Pilot; it never supplies memory history, model ID, capability IDs or integration credentials.

`pilot-ai` constructs a request-scoped agent context from that command. Dynamic `tools` and `ToolSearchProcessor` resolve only the authorized tools. The memory identifiers are deterministic:

- resource: immutable organization plus Worker pair;
- thread: Pilot Conversation UUID.

Use `@mastra/libsql` with the matching Turso environment for Mastra storage. Do not use in-memory loaded-tool state, process globals or filesystem state for any behavior that must survive a restart.

## Delivery order

1. Use deployed storage with `@mastra/libsql` and prove restart-safe message history. **Preview was verified through two separate protected Vercel invocations on 2026-09-07. Production still needs its own sensitive `TURSO_AUTH_TOKEN` before deployment.**
2. Add `pilot-conversation` with direct chat behavior and no enabled capabilities by default. **Implemented and covered by deterministic command-validation tests.**
3. Add the typed internal endpoint and protected Pilot-to-runtime transport. **The runtime endpoint is implemented; Pilot still needs to become the authenticated caller and Vercel Trusted Sources must be configured before deployment.**
4. Keep the local Research Agent in the shared Pilot runtime before deployment. **Implemented with `src/index.ts` registering both agents, `src/runtime/agent/base-agent.ts` providing their shared behavior, and `src/research` holding research-specific code. The normal Pilot build does not load research dependencies.**
5. Add Pilot-side message persistence and the authenticated server-to-server call, then prove one complete user message/reply flow.
6. Add dynamic, capability-filtered read-only tools and prove denied tools cannot be discovered, loaded or called.
7. Add durable approval/suspension for mutation tools, then browser control and integrations.
8. Add worker delegation only after assignments, execution records and durable resumption exist in Pilot.

## Acceptance tests

- Two messages in one Conversation recall the first after a fresh process restart.
- A Conversation cannot read another organization or Worker's memory.
- The same prompt answers directly when no capability is enabled.
- An allowed read-only tool is discoverable and usable only when the request grants it.
- A denied tool cannot be found, loaded or invoked through dynamic search or a forged client request.
- A mutating tool cannot execute without a persisted Pilot approval and a revalidated resume.
- Tool calls, results, errors, latency, token usage and cost are returned to Pilot for durable activity/execution records.

## Sources checked

- Installed `@mastra/core` `1.64.0` types: `tools` can resolve dynamically from request context; `ToolSearchProcessor` supports request-aware filters and restart-safe `storage: 'context'` state.
- [Mastra tools documentation](https://mastra.ai/docs/agents/mcp-guide): tools are typed functions registered on agents.
- [Mastra approval guidance](https://mastra.ai/blog/human-in-the-loop-when-to-use-agent-approval): use tool-level approval for risky actions and suspension for needed clarification.
- npm metadata for `@mastra/libsql` `1.22.3`: compatible with the installed core release and Node requirement.
