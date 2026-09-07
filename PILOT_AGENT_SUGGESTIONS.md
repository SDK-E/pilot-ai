# Pilot agent suggestions

This is a suggestion document for Kilo Code. It does not authorize deployment, Pilot integration, browser access, or changes to the running `pilot-browser` implementation.

## Current recommendation

Do not add another broad autonomous agent now. The first required runtime profile is a minimal **Pilot Conversation** adapter for the one-Worker vertical slice:

- receives an already-authorized `GenerateConversationReply` command from `pilot`;
- uses the configured Kilo Gateway model `kilo/kilo-auto/free` for development;
- applies the selected Worker's instructions;
- uses a stable Worker resource and Pilot Conversation thread for Mastra memory;
- receives only tools that Pilot authorizes for that Worker and request; prefers a direct answer and uses a tool only when it materially improves the result; and
- returns only the generated reply and runtime metadata needed for Pilot to record later.

This is a runtime profile, not a second product Worker type. Pilot Workers remain organization entities whose model and instructions configure runtime behavior.

Before this profile can be connected to Pilot, configure the maintained `@mastra/libsql` package with a dedicated matching-environment Turso database. Do not use any file-backed LibSQL or DuckDB store in the deployed path. Prove memory survives a fresh process restart. The cross-repository contract is in `pilot/docs/decisions/0004-mastra-conversation-runtime-contract.md`. The detailed design is in [PILOT_CONVERSATION_PLAN.md](PILOT_CONVERSATION_PLAN.md).

## Current integration gate

The separate `pilot-ai` Vercel project already exists. Its deployed `/api/agents` route currently redirects unauthenticated requests to Vercel SSO, so it is not a Pilot runtime endpoint yet. Preserve that protection. The next integration task is a dedicated, app-level no-tools conversation endpoint that accepts only the minimal verified command. After it exists, authorize the `pilot` project through Vercel Trusted Sources and have Pilot forward its short-lived OIDC token in `x-vercel-trusted-oidc-idp-token`. Do not add `pilot` as a trusted source for the general `/api/agents` surface, bypass deployment protection, or expose an API key to the browser.

## Existing Pilot Browser

`pilot-browser` is useful as the research capability once the one-Worker conversation and durable execution slices are complete. Keep it isolated for now. It must not receive requests directly from a browser or from unverified Pilot data, and it must not be registered as a general Pilot capability until these conditions are met:

1. Pilot authorizes the organization, Worker, Conversation and allowed capability server-side.
2. Runtime storage is Turso-backed and restart-safe.
3. Browser and any external action are represented as a Pilot permission and require explicit, durable human approval where appropriate.
4. A suspended execution can resume idempotently after a request, deployment or process failure.
5. Tool calls, approvals, results, failures, latency, token usage and cost are visible in Pilot.

## Later profiles, in delivery order

| Profile | When to add it | Required guardrails |
| --- | --- | --- |
| Pilot Conversation | Now, for the first persistent two-turn memory slice | No tools; Turso storage; authenticated service call from Pilot |
| Pilot Execution | After conversations are durable | Mastra durable workflow, persisted execution state, approval suspension/resume and idempotency |
| Pilot Research | After Pilot Execution | Reuse the existing `pilot-browser`; read-only public research permission; tenant-scoped storage and activity records |
| Pilot Coding | Only when an ACP-compatible coding integration is selected | Isolated workspace, repository permission, explicit approval for writes, durable execution history |

Do not create separate “business developer”, “marketing”, or other hardcoded agent architectures. Add capabilities as permissions and configurations to the same Pilot Worker platform.

## Working safely beside Pilot

- Do not alter this document into runtime instructions; it is a roadmap only.
- Keep `pilot` as the owner of WorkOS authorization, Pilot domain records, and user-facing routes.
- Keep `pilot-ai` as the Mastra adapter boundary.
- Do not rely on the current local storage fallbacks in a deployed path.
- Do not send client-provided history to Mastra; Pilot sends only the new validated user message and verified identifiers.
