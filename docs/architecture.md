# Architecture

pilot-ai is the Mastra runtime behind [Pilot](https://github.com/SDK-E/pilot).
Pilot owns authentication, organization authorization, agents, conversations,
execution records, and approvals. This service owns agent construction,
memory, the task-approval workflow, and the protected runtime API; it never
makes authorization decisions and never stores Pilot domain records.

## Agent kinds

Every request builds one agent from the **base agent** and one of three
kinds. A kind is only what differs: identity, instructions, the capabilities
it may use, and step limits. Everything reusable belongs to the base agent.

| Kind   | Purpose                                                         |
| ------ | --------------------------------------------------------------- |
| `chat` | Conversational answers; uses granted capabilities when needed.  |
| `work` | Executes one queued work item: plan, act, request approvals.    |
| `code` | Reads, explains, and proposes code changes as reviewable diffs. |

Pilot sends the kind as `baseAgentId` together with the capabilities it
grants and which of those need an approval. The legacy ids `conversational`
and `research` are accepted and mapped to `chat` until Pilot migrates
(`src/contracts/conversation.ts`).

### Capabilities

| Capability     | Tools registered on the agent                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `web-search`   | `webSearch`, `urlFetch`, `bulkUrlFetch`, `siteDiscovery`, `domainIntelligence`, `githubPublic` |
| `scratchpad`   | `scratchpad` (private per-chat working state through the Pilot callback)                       |
| `ask-user`     | `ask_user` (Mastra clarification suspension)                                                   |
| `plan`         | The agent's own visible step list                                                              |
| `code-sandbox` | A fresh, isolated `@vercel/sandbox` run per call                                               |

When `web-search` is granted the base agent also attaches the evidence
processors (source confidence, recency, contradiction, diversity, entity
resolution, memory hygiene) so long tool-using runs stay honest about their
sources. A plain chat turn pays nothing for them.

An enabled tool that a kind is allowed to use just runs — there is no
approval or suspension step for using it, matching Claude Code/Codex. `plan`
and `ask-user` are unrelated to tool-capability gating and are never removed
alongside it: `plan` is the agent's visible step list, and `ask-user` is a
clarification pause, not an approval.

## Project structure

The layout follows Mastra's standard `src/mastra` project structure. Inside
`src/mastra/agents/`, Mastra's CLI treats any folder containing `config.ts`,
`instructions.*`, `memory.ts`, `workspace.ts`, or a `tools/`, `skills/`,
`subagents/`, `workflows/`, `scorers/`, or `processors/` folder as a
file-based agent, so shared modules deliberately use other names.

```
api/v1/                     Vercel Functions. Each file is a thin wrapper over a
                            handler in src/mastra/server.
src/contracts/              Pure request/response contract shared with Pilot.
                            Zero @mastra imports, zero process.env.
src/mastra/
  index.ts                  Mastra instance: storage, logger, routes, workflow.
  agents/
    kinds.ts                The three kinds and what differs between them.
    chat.ts work.ts code.ts Identity and instructions of one kind each.
    base/                   The base agent everything is built from:
      agent.ts              factory with the shared processor pipeline
      shared-instructions.ts, identity.ts, limits.ts
      capabilities/         capability id -> tools, instructions, approvability
      pipeline/             input processors by concern:
                            context/ quality/ budget/ response/ policy/
                            reminders.ts (factories), evidence.ts (the set
                            attached with web-search)
      profiles/             tuning profiles (fast, balanced, deep, test)
      skill-preflight.ts    audited skill discovery
    runtime/                Request-scoped runtime: agent factory, results,
                            suspensions, generate/stream/resume/cleanup.
  server/                   HTTP layer: OpenAI-compatible translation, handlers,
                            and Mastra route registrations (routes/).
  tools/                    Mastra tools by what they touch:
                            web/ search/ code/ pilot/.
  workflows/                The task-approval workflow.
  memory/ storage/ cache/   Memory factories, storage adapter, tool cache.
  activity/ auth/ security/ Pilot activity callback, WorkOS M2M verification,
                            public-URL guard.
  work/                     Durable Work cache (Redis).
  setup/                    Wires cache and network config into the web tools.
scripts/                    Terminal scripts (pnpm verify:memory).
```

Relative imports carry an explicit `.js` extension because the Vercel
functions run unbundled on Node ESM. ESLint enforces this.

## Runtime API

The production runtime is `https://ai.pilot.sdk.enterprises`.
`POST /v1/chat/completions` accepts OpenAI Chat Completions `model`,
`messages`, and `stream`, and returns a `chat.completion` object or an SSE
stream. Pilot first checks the user's WorkOS session and tenant
authorization, then forwards a short-lived WorkOS M2M token minted for its
own Connect application (`client_credentials` grant). The runtime validates
its signature against that AuthKit environment's JWKS and its exact subject
(Pilot's M2M client ID) before it reads the request body, initializes
Mastra, or accepts the tenant headers. This protects the custom domain even
where Vercel Deployment Protection does not apply to it, and — unlike the
Vercel OIDC token it replaced — works identically in local development,
since it isn't tied to running on Vercel at all. `vercel.json` rewrites
`/v1/*` to the function entries.

The same boundary exposes `POST /v1/conversations/delete`,
`POST /v1/conversations/truncate`, and `POST /v1/projects/delete-memory`. All
require the verified Pilot runtime token and accept only typed server
commands; the browser never calls them.

Capabilities are selected only from Pilot's server-generated command;
per-tool approval requirements travel separately, so an `ask` policy for one
capability never pauses an allowed one. `ask_user` is a clarification
suspension, not an approval. The scratchpad callback derives the
conversation and creator from its active execution record, so the runtime
never supplies ownership.

## Capability policy (design principle)

This governs how a new capability should be added, not just how the current
ones behave:

1. **Direct conversation** needs no tool at all — explanation, drafting, and
   answers from conversation history are always free.
2. **Read-only capabilities** (`web-search`, `scratchpad`) run immediately
   once granted; they are optional, and an agent must not reach for one just
   to make a response look more thorough.
3. **Connected integrations** are added only once Pilot has an integration
   record, scoped credentials, and an explicit permission — the tool is
   constructed per request with only that connection's credentials.
4. **External mutation** (send, write, publish, delete, or any production
   action) requires a durable Pilot approval record and a Mastra tool
   suspension before it executes; the resumed request revalidates
   authorization and idempotency.
5. **Browser or sandboxed execution** (`code-sandbox`) is isolated per call
   with no access to this service's own systems, secrets, or data.

Do not add a new tool, kind, or mode until it has equivalent authorization,
activity, and storage behavior to the capabilities above.

## Design history

The three-kind model converged from two earlier, narrower designs recorded
in this repo's git history (`PILOT_AGENT_SUGGESTIONS.md`,
`PILOT_CONVERSATION_PLAN.md`, `PROCESSOR_MATRIX.md`, now folded into this
file): a "Pilot Conversation" adapter with no tools, and a separate research
profile reusing a prior standalone `pilot-browser` research agent. The
processor split those documents worked out — shared reliability processors
(unicode normalization, current context, verbosity, quality gate, budgets,
failure recovery) on every agent, versus research/evidence-only processors
attached only when a capability needing them is granted — is still the shape
of `src/mastra/agents/base/pipeline/`: base pipeline processors run for every
kind, and the evidence set (`pipeline/evidence.ts`) attaches only when
`web-search` is granted. No processor is promoted to the base agent solely
because an earlier design used it for one profile.
