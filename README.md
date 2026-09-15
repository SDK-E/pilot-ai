# Pilot AI

The Mastra runtime behind [Pilot](https://github.com/SDK-E/pilot). Pilot owns
authentication, organization authorization, agents, conversations, execution
records, and approvals. This service owns agent construction, memory, the
task-approval workflow, and the protected runtime API; it never makes
authorization decisions and never stores Pilot domain records.

## Agent kinds

Every request builds one agent from the **base agent** and one of three kinds.
A kind is only what differs: identity, instructions, the capabilities it may
use, and step limits. Everything reusable belongs to the base agent.

| Kind   | Purpose                                                         |
| ------ | --------------------------------------------------------------- |
| `chat` | Conversational answers; uses granted capabilities when needed.  |
| `work` | Executes one queued work item: plan, act, request approvals.    |
| `code` | Reads, explains, and proposes code changes as reviewable diffs. |

Pilot sends the kind as `baseAgentId` together with the capabilities it grants
and which of those need an approval. The legacy ids `conversational` and
`research` are accepted and mapped to `chat` until Pilot migrates.

### Capabilities

| Capability               | Tools registered on the agent                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| `web-search`             | `webSearch`, `urlFetch`, `bulkUrlFetch`, `siteDiscovery`, `domainIntelligence`, `githubPublic` |
| `scratchpad`             | `scratchpad` (private per-chat working state through the Pilot callback)                       |
| `ask-user`               | `ask_user` (Mastra clarification suspension)                                                   |
| `plan`                   | `plan` (visible step-by-step task list through the Pilot callback)                             |
| `code-sandbox`           | `sandbox-run` (fresh, isolated Vercel Sandbox per call)                                        |
| `connector-github`       | `connector-github` (the user's own connected GitHub account, read-only)                        |
| `connector-google-drive` | `connector-google-drive` (the user's own connected Google Drive, read-only)                    |
| `connector-gmail`        | `connector-gmail` (the user's own connected Gmail account, read-only)                          |
| `connector-slack`        | `connector-slack` (the user's own connected Slack workspace, read-only)                        |
| `connector-notion`       | `connector-notion` (the user's own connected Notion workspace, read-only)                      |
| `connector-linear`       | `connector-linear` (the user's own connected Linear workspace, read-only)                      |
| `connector-vercel`       | `connector-vercel` (the user's own connected Vercel account, read-only)                        |
| `connector-monday`       | `connector-monday` (the user's own connected Monday.com account, read-only)                    |

When `web-search` is granted the base agent also attaches the evidence
processors (source confidence, recency, contradiction, diversity, entity
resolution, memory hygiene) so long tool-using runs stay honest about their
sources. A plain chat turn pays nothing for them.

Every connector tool reaches only the requesting user's own connected
account for that provider, is strictly read-only (it cannot create, edit,
send, or delete anything), and is only available at all when Pilot's
`PILOT_ENABLE_CONNECTORS` platform flag is on.

---

See [docs/development.md](docs/development.md) for local setup, project
structure, and configuration.
