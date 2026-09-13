function requiredDevelopmentDatabaseUrl(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `${name} is required when PILOT_ENABLE_DEVELOPMENT_TOOLS=true. ` +
        "Use a development-only database outside this repository source tree.",
    );
  }

  return value;
}

export const developmentDatabaseUrl = requiredDevelopmentDatabaseUrl(
  "MASTRA_MEMORY_DATABASE_URL",
);

export const developmentDatabaseAuthToken =
  process.env.MASTRA_MEMORY_DATABASE_AUTH_TOKEN;
