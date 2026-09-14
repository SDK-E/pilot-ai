interface SkillSummary {
  id?: unknown;
  slug?: unknown;
  name?: unknown;
  source?: unknown;
  installs?: unknown;
}

interface SearchResponse {
  data?: unknown;
}

interface DetailResponse {
  id?: unknown;
  slug?: unknown;
  source?: unknown;
  files?: unknown;
}

interface AuditResponse {
  audits?: unknown;
}

export interface RuntimeSkillPreflightResult {
  query: string;
  searched: boolean;
  loaded: boolean;
  skillId?: string;
  instructions?: string;
  error?: string;
}

const API = "https://skills.sh/api/v1";
const MAX_SKILL_CONTEXT = 24_000;
const REQUEST_TIMEOUT_MS = 8000;
const MIN_CANDIDATE_SCORE = 0.3;
const INSTRUCTION_FILE = /\.(md|mdx|txt|json|ya?ml)$/;

const STOP_WORDS = new Set(
  "a an and are as at be but by can could do for from give help how i if in is it me my of on or please the this to use want what when where which who with would you your".split(
    " ",
  ),
);

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function tokens(value: string): string[] {
  return [
    ...new Set(
      value
        .toLowerCase()
        .normalize("NFKD")
        .replaceAll(/[^a-z0-9+#.\-/\s]/g, " ")
        .split(/\s+/)
        .map((item) => item.trim())
        .filter((item) => item.length > 1 && !STOP_WORDS.has(item)),
    ),
  ];
}

export function buildSkillCapabilityQuery(request: string): string {
  const selected = tokens(request).slice(0, 12);
  return selected.join(" ").slice(0, 180) || request.trim().slice(0, 180);
}

function authHeaders(): Record<string, string> {
  const token = process.env.VERCEL_OIDC_TOKEN;
  if (!token) {
    throw new Error("VERCEL_OIDC_TOKEN is missing");
  }

  return {
    authorization: `Bearer ${token}`,
    "x-vercel-oidc-token": token,
    accept: "application/json",
    "user-agent": "SDK-Pilot-Agent/1.0 (+https://sdk.enterprises; Pilot)",
    "x-agent-name": "SDK Pilot",
    "x-agent-purpose": "runtime-skill-preflight",
  };
}

async function requestJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API}${path}`, {
      headers: authHeaders(),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`skills.sh ${response.status}: ${await response.text()}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `skills.sh request timed out after ${REQUEST_TIMEOUT_MS}ms`,
        { cause: error },
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function candidateScore(
  candidate: SkillSummary,
  query: string,
  index: number,
): number {
  const candidateText = [
    candidate.id,
    candidate.slug,
    candidate.name,
    candidate.source,
  ]
    .map((value) => text(value))
    .filter(Boolean)
    .join(" ");

  const wanted = tokens(query);
  const available = new Set(tokens(candidateText));
  const overlap =
    wanted.length === 0
      ? 0
      : wanted.filter((token) => available.has(token)).length / wanted.length;

  const position = Math.max(0, 1 - index / 5);
  const installs =
    typeof candidate.installs === "number"
      ? Math.min(1, Math.log1p(candidate.installs) / Math.log(10_001))
      : 0;

  return overlap * 0.65 + position * 0.3 + installs * 0.05;
}

/**
 * The best-matching skill id from a search result, if any scores well enough.
 */
function pickCandidateId(value: unknown, query: string): string | undefined {
  if (!Array.isArray(value)) return undefined;

  const ranked = value
    .filter((item): item is SkillSummary => isRecord(item) && !!text(item.id))
    .map((item, index) => ({ item, score: candidateScore(item, query, index) }))
    .toSorted((a, b) => b.score - a.score);

  const best = ranked.at(0);
  return best && best.score >= MIN_CANDIDATE_SCORE
    ? text(best.item.id)
    : undefined;
}

function isAuditUnsafe(value: unknown): boolean {
  if (!Array.isArray(value)) return false;

  return value.some((item) => {
    if (!isRecord(item)) return false;
    const status = text(item.status)?.toLowerCase();
    const risk = text(item.riskLevel)?.toLowerCase();
    return (
      status === "fail" ||
      status === "blocked" ||
      risk === "high" ||
      risk === "critical"
    );
  });
}

interface SkillFile {
  path: string;
  contents: string;
}

function instructionFile(item: unknown): SkillFile | undefined {
  if (!isRecord(item)) return undefined;
  const path = text(item.path);
  const contents = text(item.contents);
  if (!path || !contents) return undefined;
  const lower = path.toLowerCase();
  return lower === "skill.md" || INSTRUCTION_FILE.test(lower)
    ? { path, contents }
    : undefined;
}

/**
 * Joins a skill's instruction files, but only when a SKILL.md is present.
 */
function instructionContext(files: unknown): string | undefined {
  if (!Array.isArray(files)) return undefined;
  const accepted = files
    .map((item) => instructionFile(item))
    .filter((file): file is SkillFile => file !== undefined);
  const hasSkill = accepted.some(
    (file) => file.path.toLowerCase() === "skill.md",
  );
  if (!hasSkill) return undefined;
  return accepted
    .map((file) => `\n--- ${file.path} ---\n${file.contents}`)
    .join("\n")
    .slice(0, MAX_SKILL_CONTEXT);
}

async function auditFor(encodedId: string): Promise<AuditResponse> {
  try {
    return await requestJson<AuditResponse>(`/skills/audit/${encodedId}`);
  } catch {
    return { audits: [] };
  }
}

async function loadSkill(
  query: string,
  id: string,
): Promise<RuntimeSkillPreflightResult> {
  const encodedId = id
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const [detail, audit] = await Promise.all([
    requestJson<DetailResponse>(`/skills/${encodedId}`),
    auditFor(encodedId),
  ]);
  const instructions = isAuditUnsafe(audit.audits)
    ? undefined
    : instructionContext(detail.files);
  return {
    query,
    searched: true,
    loaded: instructions !== undefined,
    skillId: id,
    instructions,
  };
}

export async function runRuntimeSkillPreflight(
  request: string,
): Promise<RuntimeSkillPreflightResult> {
  const query = buildSkillCapabilityQuery(request);

  try {
    const params = new URLSearchParams({ q: query, limit: "5" });
    const search = await requestJson<SearchResponse>(
      `/skills/search?${params.toString()}`,
    );
    const id = pickCandidateId(search.data, query);
    if (!id) return { query, searched: true, loaded: false };
    return await loadSkill(query, id);
  } catch (error) {
    return {
      query,
      searched: false,
      loaded: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
