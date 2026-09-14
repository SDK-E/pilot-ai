import { createTool } from "@mastra/core/tools";
import { Sandbox } from "@vercel/sandbox";
import { z } from "zod";

const MAX_FILES = 20;
const MAX_FILE_CHARS = 200_000;
const MAX_COMMANDS = 3;
const MAX_OUTPUT_CHARS = 20_000;
const DEFAULT_BUDGET_MS = 15_000;
const MAX_BUDGET_MS = 30_000;
const SANDBOX_BOOT_ALLOWANCE_MS = 10_000;

const fileSchema = z.object({
  path: z.string().min(1).max(300),
  content: z.string().max(MAX_FILE_CHARS),
});

const commandSchema = z.object({
  cmd: z.string().min(1).max(200),
  args: z.array(z.string().max(500)).max(20).default([]),
});

const stepSchema = z.object({
  cmd: z.string(),
  exitCode: z.number(),
  stdout: z.string(),
  stderr: z.string(),
});

async function stopQuietly(sandbox: Sandbox): Promise<void> {
  try {
    await sandbox.stop();
  } catch {
    // The commands already ran; a failed cleanup call shouldn't fail the tool.
  }
}

/**
 * Runs a bounded sequence of commands in one fresh Vercel Sandbox: an
 * isolated Linux microVM with its own filesystem and network, unable to
 * reach Pilot's own systems, secrets, or database. `budgetMs` is a shared
 * wall-clock deadline across every command in the call, not a per-command
 * timeout, so one slow step can't silently starve the rest of the turn.
 */
export const sandboxRun = createTool({
  id: "sandbox-run",

  description:
    "Run shell commands in a fresh, fully isolated Linux sandbox (its own filesystem and network — no access to Pilot's systems, secrets, or data). Write files first if a command needs them; commands run in order against the same sandbox and stop at the first non-zero exit code. Use this to actually execute code, run a test suite, or verify a script works, instead of only describing what it would do.",

  inputSchema: z.object({
    files: z
      .array(fileSchema)
      .max(MAX_FILES)
      .default([])
      .describe("Files to write into the sandbox before running commands."),
    commands: z
      .array(commandSchema)
      .min(1)
      .max(MAX_COMMANDS)
      .describe(
        "Commands to run in order, e.g. { cmd: 'npm', args: ['test'] }.",
      ),
    budgetMs: z
      .number()
      .int()
      .min(1000)
      .max(MAX_BUDGET_MS)
      .default(DEFAULT_BUDGET_MS)
      .describe("Total wall-clock budget shared across every command."),
  }),

  outputSchema: z.object({
    steps: z.array(stepSchema),
    didStopEarly: z.boolean(),
  }),

  execute: async ({ files, commands, budgetMs }, { abortSignal }) => {
    const sandbox = await Sandbox.create({
      timeout: budgetMs + SANDBOX_BOOT_ALLOWANCE_MS,
      resources: { vcpus: 1 },
      persistent: false,
      signal: abortSignal,
    });
    try {
      if (files.length > 0) {
        await sandbox.writeFiles(
          files.map((file) => ({ path: file.path, content: file.content })),
          { signal: abortSignal },
        );
      }

      const steps: z.infer<typeof stepSchema>[] = [];
      const deadline = Date.now() + budgetMs;
      let didStopEarly = false;

      for (const command of commands) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
          didStopEarly = true;
          break;
        }
        const result = await sandbox.runCommand({
          cmd: command.cmd,
          args: command.args,
          timeoutMs: remaining,
          signal: abortSignal,
        });
        const stdout = await result.stdout();
        const stderr = await result.stderr();
        steps.push({
          cmd: [command.cmd, ...command.args].join(" "),
          exitCode: result.exitCode,
          stdout: stdout.slice(0, MAX_OUTPUT_CHARS),
          stderr: stderr.slice(0, MAX_OUTPUT_CHARS),
        });
        if (result.exitCode !== 0) {
          didStopEarly = true;
          break;
        }
      }

      return { steps, didStopEarly };
    } finally {
      await stopQuietly(sandbox);
    }
  },

  toModelOutput: (output) => {
    const lines = output.steps.map(
      (step) =>
        `$ ${step.cmd}\nexit ${String(step.exitCode)}\n${step.stdout}${
          step.stderr ? `\n[stderr]\n${step.stderr}` : ""
        }`,
    );
    if (output.didStopEarly) {
      lines.push("(stopped: a command failed or the time budget ran out)");
    }
    return { type: "text", value: lines.join("\n\n").slice(0, 60_000) };
  },
});
