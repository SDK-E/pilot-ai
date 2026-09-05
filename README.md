# Pilot AI

Mastra runtime and intelligence boundary for [Pilot](https://github.com/SDK-E/pilot).

The package is deliberately inert while Pilot establishes the first end-to-end worker boundary. It contains no registered agents, models, tools, local filesystems, sandboxes, schedules, or local database storage.

Pilot owns authentication, organization authorization, workers, conversations, execution records, and approvals. This package will receive only tenant-scoped runtime adapters after those inputs are verified by Pilot. Mastra supplies agent, memory, workflow, and durable-execution capabilities; it does not own Pilot domain records or make authorization decisions.

## Development

Use Node.js 24 and pnpm. The `dev` and `build` scripts invoke the Mastra CLI.

```sh
pnpm install --frozen-lockfile
pnpm build
```

Before adding Mastra code, read [AGENTS.md](AGENTS.md) and the current package documentation. Production runtime storage will use the environment-specific Neon PostgreSQL database; never add a file-backed database or expose a tool before Pilot enforces its capability and approval policy.

GitHub Actions builds the runtime and checks known high-severity vulnerabilities for pull requests and `main`.
