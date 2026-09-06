import {
  resolve4,
  resolve6,
  resolveMx,
  resolveNs,
  resolveTxt,
} from 'node:dns/promises';

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

async function safeResolve<T>(
  operation: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await operation();
  } catch {
    return undefined;
  }
}

function normalizeDomain(value: string): string {
  const input = value.trim().toLowerCase();

  try {
    return new URL(
      input.includes('://')
        ? input
        : `https://${input}`,
    ).hostname;
  } catch {
    return input;
  }
}

export const domainIntelligence = createTool({
  id: 'domain-intelligence',

  description:
    'Inspect public DNS information for a domain, including A, AAAA, MX, NS, and TXT records. Useful for domain verification, company infrastructure signals, and validating whether a domain can receive email.',

  inputSchema: z.object({
    domain: z.string().min(1),
  }),

  outputSchema: z.object({
    domain: z.string(),
    ipv4: z.array(z.string()),
    ipv6: z.array(z.string()),
    mx: z.array(
      z.object({
        exchange: z.string(),
        priority: z.number(),
      }),
    ),
    nameservers: z.array(z.string()),
    txt: z.array(z.array(z.string())),
    canReceiveEmail: z.boolean(),
  }),

  execute: async (inputData) => {
    const domain = normalizeDomain(
      inputData.domain,
    );

    const [ipv4, ipv6, mx, nameservers, txt] =
      await Promise.all([
        safeResolve(() => resolve4(domain)),
        safeResolve(() => resolve6(domain)),
        safeResolve(() => resolveMx(domain)),
        safeResolve(() => resolveNs(domain)),
        safeResolve(() => resolveTxt(domain)),
      ]);

    return {
      domain,
      ipv4: ipv4 ?? [],
      ipv6: ipv6 ?? [],
      mx: (mx ?? []).sort(
        (a, b) => a.priority - b.priority,
      ),
      nameservers: nameservers ?? [],
      txt: txt ?? [],
      canReceiveEmail:
        Array.isArray(mx) && mx.length > 0,
    };
  },
});