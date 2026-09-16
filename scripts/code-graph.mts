#!/usr/bin/env node
/**
 * Lightweight import-graph lookup for agents: "what does this file import"
 * and "what imports this file", without reading either side's contents.
 * Pure Node, no dependencies — regex-based import extraction, not a real
 * TS parse, so it can miss unusual syntax; good enough for "what's related"
 * triage before deciding what to actually read.
 *
 * Usage:
 *   tsx scripts/code-graph.mts <path-or-symbol> [--depth N] [--symbol]
 *
 * --symbol treats the argument as an exported name to locate first, then
 * reports the graph for every file that exports it.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

interface TsconfigPaths {
  baseUrl: string;
  paths: Record<string, string[]>;
}

type FileGraph = Map<string, Set<string>>;

interface BuiltGraph {
  imports: FileGraph;
  importedBy: FileGraph;
  files: string[];
}

const ROOT = process.cwd();
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs"];
const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  ".mastra",
  ".git",
  "dist",
  "drizzle",
  "coverage",
]);

function stripTrailingStar(value: string): string {
  return value.endsWith("*") ? value.slice(0, -1) : value;
}

function readTsconfigPaths(): TsconfigPaths {
  const tsconfigPath = path.join(ROOT, "tsconfig.json");
  if (!existsSync(tsconfigPath)) return { baseUrl: ROOT, paths: {} };
  // tsconfig.json commonly has // comments, which JSON.parse rejects.
  const raw = readFileSync(tsconfigPath, "utf8").replaceAll(
    /\/\/[^\r\n]*/g,
    "",
  );
  const config = JSON.parse(raw) as {
    compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> };
  };
  const compilerOptions = config.compilerOptions ?? {};
  const baseUrl = path.resolve(ROOT, compilerOptions.baseUrl ?? ".");
  return { baseUrl, paths: compilerOptions.paths ?? {} };
}

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(fullPath, out);
    } else if (SOURCE_EXTENSIONS.includes(path.extname(entry.name))) {
      out.push(fullPath);
    }
  }
  return out;
}

function resolveAlias(
  specifier: string,
  { baseUrl, paths }: TsconfigPaths,
): string | null {
  const match = Object.entries(paths).find(([alias]) =>
    specifier.startsWith(stripTrailingStar(alias)),
  );
  if (!match) return null; // bare package import (node_modules); not tracked
  const [alias, targets] = match;
  const target = targets[0];
  if (!target) return null;
  const prefix = stripTrailingStar(alias);
  const suffix = specifier.slice(prefix.length);
  return path.resolve(baseUrl, stripTrailingStar(target), suffix);
}

function resolveOnDisk(candidate: string): string | null {
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;

  // NodeNext/ESM convention: source often imports "./foo.js" for a file
  // that's actually foo.ts on disk. Strip a known extension before trying
  // the real ones, since "foo.js" + ".ts" would otherwise look for
  // "foo.js.ts" and never match.
  const knownExtension = SOURCE_EXTENSIONS.find((ext) =>
    candidate.endsWith(ext),
  );
  const withoutExtension = knownExtension
    ? candidate.slice(0, -knownExtension.length)
    : candidate;

  for (const ext of SOURCE_EXTENSIONS) {
    if (existsSync(withoutExtension + ext)) return withoutExtension + ext;
  }
  for (const ext of SOURCE_EXTENSIONS) {
    const indexPath = path.join(withoutExtension, `index${ext}`);
    if (existsSync(indexPath)) return indexPath;
  }
  return null;
}

function resolveSpecifier(
  specifier: string,
  fromFile: string,
  tsconfig: TsconfigPaths,
): string | null {
  const candidate = specifier.startsWith(".")
    ? path.resolve(path.dirname(fromFile), specifier)
    : resolveAlias(specifier, tsconfig);
  return candidate ? resolveOnDisk(candidate) : null;
}

const IMPORT_FROM_PATTERN = /(?:import|export)[^'"]*?from\s*["']([^"']+)["']/g;
const DYNAMIC_IMPORT_PATTERN = /import\(\s*["']([^"']+)["']\s*\)/g;

// Group 1 is mandatory in both patterns (no `?`, no skip-alternation), so
// it is always captured whenever matchAll yields a match at all. Kept as a
// runtime filter (shared verbatim with pilot's copy of this script, which
// needs it under noUncheckedIndexedAccess) even though this project's
// tsconfig already narrows match[1] to `string`, making the check itself
// unreachable here.
function extractSpecifiers(source: string): string[] {
  const fromMatches = Array.from(
    source.matchAll(IMPORT_FROM_PATTERN),
    (match) => match[1],
  );
  const dynamicMatches = Array.from(
    source.matchAll(DYNAMIC_IMPORT_PATTERN),
    (match) => match[1],
  );
  return [...fromMatches, ...dynamicMatches].filter(
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, sonarjs/different-types-comparison -- see comment above
    (specifier): specifier is string => specifier !== undefined,
  );
}

function buildGraph(): BuiltGraph {
  const tsconfig = readTsconfigPaths();
  const files = collectSourceFiles(ROOT);
  const imports: FileGraph = new Map();
  const importedBy: FileGraph = new Map();

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const specifiers = extractSpecifiers(source);
    const resolved = new Set<string>();
    for (const specifier of specifiers) {
      const target = resolveSpecifier(specifier, file, tsconfig);
      if (target) resolved.add(target);
    }
    imports.set(file, resolved);
    for (const target of resolved) {
      if (!importedBy.has(target)) importedBy.set(target, new Set());
      importedBy.get(target)?.add(file);
    }
  }
  return { imports, importedBy, files };
}

function admitUnseenNeighbors(
  file: string,
  graph: FileGraph,
  seen: Set<string>,
  next: Set<string>,
): void {
  const neighbors = graph.get(file) ?? new Set<string>();
  for (const neighbor of neighbors) {
    if (seen.has(neighbor)) continue;
    seen.add(neighbor);
    next.add(neighbor);
  }
}

function expandFrontier(
  frontier: Set<string>,
  graph: FileGraph,
  seen: Set<string>,
): Set<string> {
  const next = new Set<string>();
  for (const file of frontier) {
    admitUnseenNeighbors(file, graph, seen, next);
  }
  return next;
}

function expand(
  startSet: Iterable<string>,
  graph: FileGraph,
  depth: number,
): Set<string> {
  let frontier = new Set(startSet);
  const seen = new Set(startSet);
  for (let i = 0; i < depth; i++) {
    frontier = expandFrontier(frontier, graph, seen);
  }
  return seen;
}

function findSymbolDefinitions(files: string[], symbol: string): string[] {
  const pattern = new RegExp(
    String.raw`export\s+(default\s+)?(async\s+)?(function|class|const|let|var|interface|type|enum)\s+${symbol}\b`,
  );
  const namedExportPattern = new RegExp(
    String.raw`export\s*\{[^}]*\b${symbol}\b[^}]*\}`,
  );
  return files.filter((file) => {
    const source = readFileSync(file, "utf8");
    return pattern.test(source) || namedExportPattern.test(source);
  });
}

function report(target: string, graph: BuiltGraph, depth: number): void {
  const importSet = expand([target], graph.imports, depth);
  importSet.delete(target);
  const importedBySet = expand([target], graph.importedBy, depth);
  importedBySet.delete(target);

  process.stdout.write(`\n${path.relative(ROOT, target)}\n`);
  process.stdout.write(`  imports (depth ${depth}):\n`);
  for (const file of importSet) {
    process.stdout.write(`    ${path.relative(ROOT, file)}\n`);
  }
  if (importSet.size === 0) process.stdout.write("    (none tracked)\n");

  process.stdout.write(`  imported by (depth ${depth}):\n`);
  for (const file of importedBySet) {
    process.stdout.write(`    ${path.relative(ROOT, file)}\n`);
  }
  if (importedBySet.size === 0) process.stdout.write("    (none tracked)\n");
}

function parseArgs(argv: string[]): {
  target?: string;
  depth: number;
  isSymbol: boolean;
} {
  const depthIndex = argv.indexOf("--depth");
  const depthValue = depthIndex === -1 ? undefined : argv[depthIndex + 1];
  const depth = depthValue ? Number(depthValue) : 1;
  const isSymbol = argv.includes("--symbol");
  const target = argv.find(
    (arg, i) =>
      arg !== "--depth" &&
      arg !== "--symbol" &&
      i !== depthIndex + 1 &&
      !arg.startsWith("--"),
  );
  return { target, depth, isSymbol };
}

function main(): void {
  const { target, depth, isSymbol } = parseArgs(process.argv.slice(2));

  if (!target) {
    process.stderr.write(
      "usage: code-graph.mts <path-or-symbol> [--depth N] [--symbol]\n",
    );
    process.exitCode = 1;
    return;
  }

  const graph = buildGraph();

  if (isSymbol) {
    const definitions = findSymbolDefinitions(graph.files, target);
    if (definitions.length === 0) {
      process.stdout.write(`no exported symbol found matching: ${target}\n`);
      return;
    }
    for (const file of definitions) report(file, graph, depth);
    return;
  }

  const resolvedTarget = path.resolve(ROOT, target);
  if (!graph.imports.has(resolvedTarget)) {
    process.stdout.write(`not a tracked source file: ${target}\n`);
    return;
  }
  report(resolvedTarget, graph, depth);
}

main();
