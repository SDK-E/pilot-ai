import 'dotenv/config';

const requiredEnvironmentVariables = [
  'KILO_API_KEY',
  'LANGSEARCH_API_KEY',
] as const;

export function assertEvalEnvironment(): void {
  const missing = requiredEnvironmentVariables.filter(
    (name) => !process.env[name]?.trim(),
  );

  if (missing.length === 0) {
    return;
  }

  throw new Error(
    `Missing environment variables required for Pilot evals: ${missing.join(', ')}`,
  );
}