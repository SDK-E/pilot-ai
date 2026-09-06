type SkillSummary = {
  id?: unknown;
  slug?: unknown;
  name?: unknown;
  source?: unknown;
  installs?: unknown;
};

type SearchResponse = {
  data?: unknown;
};

type DetailResponse = {
  id?: unknown;
  slug?: unknown;
  source?: unknown;
  files?: unknown;
};

type AuditResponse = {
  audits?: unknown;
};

export type RuntimeSkillPreflightResult = {
  query: string;
  searched: boolean;
  loaded: boolean;
  skillId?: string;
  instructions?: string;
  error?: string;
};

const API = 'https://skills.sh/api/v1';
const MAX_SKILL_CONTEXT = 24_000;
const REQUEST_TIMEOUT_MS = 8_000;

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'could',
  'do', 'for', 'from', 'give', 'help', 'how', 'i', 'if', 'in', 'is', 'it',
  'me', 'my', 'of', 'on', 'or', 'please', 'the', 'this', 'to', 'use', 'want',
  'what', 'when', 'where', 'which', 'who', 'with', 'would', 'you', 'your',
]);

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function tokens(value: string): string[] {
  return [...new Set(
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9+#.\-/\s]/g, ' ')
      .split(/\s+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 1 && !STOP_WORDS.has(item)),
  )];
}

export function buildSkillCapabilityQuery(request: string): string {
  const selected = tokens(request).slice(0, 12);
  return selected.join(' ').slice(0, 180) || request.trim().slice(0, 180);
}

function authHeaders(): Record<string, string> {
  const token = process.env.VERCEL_OIDC_TOKEN;
  if (!token) {
    throw new Error('VERCEL_OIDC_TOKEN is missing');
  }

  return {
    authorization: `Bearer ${token}`,
    'x-vercel-oidc-token': token,
    accept: 'application/json',
    'user-agent': 'SDK-Pilot-Agent/1.0 (+https://sdk.enterprises; autonomous research agent)',
    'x-agent-name': 'SDK Pilot',
    'x-agent-purpose': 'runtime-skill-preflight',
  };
}

async function requestJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API}${path}`, {
      headers: authHeaders(),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`skills.sh ${response.status}: ${await response.text()}`);
    }

    return await response.json() as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`skills.sh request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function candidateScore(candidate: SkillSummary, query: string, index: number): number {
  const candidateText = [candidate.id, candidate.slug, candidate.name, candidate.source]
    .map(text)
    .filter(Boolean)
    .join(' ');

  const wanted = tokens(query);
  const available = new Set(tokens(candidateText));
  const overlap = wanted.length === 0
    ? 0
    : wanted.filter((token) => available.has(token)).length / wanted.length;

  const position = Math.max(0, 1 - index / 5);
  const installs = typeof candidate.installs === 'number'
    ? Math.min(1, Math.log1p(candidate.installs) / Math.log(10_001))
    : 0;

  return overlap * 0.65 + position * 0.3 + installs * 0.05;
}

function pickCandidate(value: unknown, query: string): SkillSummary | undefined {
  if (!Array.isArray(value)) return undefined;

  const ranked = value
    .filter((item): item is SkillSummary => Boolean(item && typeof item === 'object' && text((item as SkillSummary).id)))
    .map((item, index) => ({ item, score: candidateScore(item, query, index) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  return best && best.score >= 0.3 ? best.item : undefined;
}

function auditIsUnsafe(value: unknown): boolean {
  if (!Array.isArray(value)) return false;

  return value.some((item) => {
    if (!item || typeof item !== 'object') return false;
    const record = item as Record<string, unknown>;
    const status = text(record.status)?.toLowerCase();
    const risk = text(record.riskLevel)?.toLowerCase();
    return status === 'fail' || status === 'blocked' || risk === 'high' || risk === 'critical';
  });
}

function instructionContext(files: unknown): string | undefined {
  if (!Array.isArray(files)) return undefined;

  const accepted: string[] = [];
  let hasSkill = false;

  for (const item of files) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const path = text(record.path);
    const contents = text(record.contents);
    if (!path || !contents) continue;

    const lower = path.toLowerCase();
    const allowed = lower === 'skill.md' || /\.(md|mdx|txt|json|ya?ml)$/.test(lower);
    if (!allowed) continue;
    if (lower === 'skill.md') hasSkill = true;

    accepted.push(`\n--- ${path} ---\n${contents}`);
  }

  if (!hasSkill) return undefined;
  return accepted.join('\n').slice(0, MAX_SKILL_CONTEXT);
}

export async function runRuntimeSkillPreflight(
  request: string,
): Promise<RuntimeSkillPreflightResult> {
  const query = buildSkillCapabilityQuery(request);

  try {
    const params = new URLSearchParams({ q: query, limit: '5' });
    const search = await requestJson<SearchResponse>(`/skills/search?${params.toString()}`);
    const candidate = pickCandidate(search.data, query);

    if (!candidate) {
      return { query, searched: true, loaded: false };
    }

    const id = text(candidate.id)!;
    const encodedId = id.split('/').map(encodeURIComponent).join('/');

    const [detail, audit] = await Promise.all([
      requestJson<DetailResponse>(`/skills/${encodedId}`),
      requestJson<AuditResponse>(`/skills/audit/${encodedId}`).catch(() => ({ audits: [] })),
    ]);

    if (auditIsUnsafe(audit.audits)) {
      return { query, searched: true, loaded: false, skillId: id };
    }

    const instructions = instructionContext(detail.files);
    if (!instructions) {
      return { query, searched: true, loaded: false, skillId: id };
    }

    return {
      query,
      searched: true,
      loaded: true,
      skillId: id,
      instructions,
    };
  } catch (error) {
    return {
      query,
      searched: false,
      loaded: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
