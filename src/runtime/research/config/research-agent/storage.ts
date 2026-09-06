function requiredResearchStorageUrl(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `${name} is required when PILOT_ENABLE_BROWSER_AGENT=true. ` +
        'Use a development-only database outside this repository source tree.',
    );
  }

  return value;
}

export const researchMemoryDatabaseUrl = requiredResearchStorageUrl(
  'MASTRA_MEMORY_DATABASE_URL',
);

export const researchMemoryDatabaseAuthToken =
  process.env.MASTRA_MEMORY_DATABASE_AUTH_TOKEN;
