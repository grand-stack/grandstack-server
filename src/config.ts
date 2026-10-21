export interface Config {
  neo4jUri: string;
  neo4jUsername: string;
  neo4jPassword: string;
  neo4jDatabase: string;
  neo4jAddCypherVersionPrefix: boolean;
  schemaPath: string;
  seedPath: string;
  seed: boolean;
  seedProbeLabel: string;
  refreshCounts: boolean;
  port: number;
  corsOrigin: string;
}

type Env = Record<string, string | undefined>;

export function loadConfig(env: Env = process.env): Config {
  const missing = ["NEO4J_URI", "NEO4J_PASSWORD"].filter((k) => !env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
  const port = Number(env.PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer between 1 and 65535, got "${env.PORT}"`);
  }
  const label = env.SEED_PROBE_LABEL ?? "Movie";
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(label)) {
    throw new Error(`SEED_PROBE_LABEL must be a plain Neo4j label (letters, digits, underscore), got "${label}"`);
  }
  return {
    neo4jUri: env.NEO4J_URI!,
    neo4jUsername: env.NEO4J_USERNAME ?? "neo4j",
    neo4jPassword: env.NEO4J_PASSWORD!,
    neo4jDatabase: env.NEO4J_DATABASE ?? "neo4j",
    neo4jAddCypherVersionPrefix: (env.NEO4J_CYPHER_VERSION_PREFIX ?? "false").toLowerCase() === "true",
    schemaPath: env.SCHEMA_PATH ?? "schema/schema.graphql",
    seedPath: env.SEED_PATH ?? "seed/movies.cypher",
    seed: (env.SEED ?? "true").toLowerCase() !== "false",
    seedProbeLabel: env.SEED_PROBE_LABEL ?? "Movie",
    refreshCounts: (env.REFRESH_COUNTS ?? "true").toLowerCase() !== "false",
    port,
    corsOrigin: env.CORS_ORIGIN ?? "http://localhost:3000",
  };
}
