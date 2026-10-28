// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
import { resolveModel, realModelIo, type ModelIo } from "./model.js";

export interface Config {
  /** Which model runs: `movies` (the default, built in) or a folder under `modelsDir`. Only one at a time. */
  model: string;
  modelsDir: string;
  /** No create, update or delete mutations are generated. */
  readOnly: boolean;
  neo4jUri: string;
  neo4jUsername: string;
  neo4jPassword: string;
  neo4jDatabase: string;
  neo4jAddCypherVersionPrefix: boolean;
  schemaPath: string;
  /** Absent when the model has no sample data, in which case `seed` is false. */
  seedPath?: string;
  seed: boolean;
  seedProbeLabel: string;
  refreshCounts: boolean;
  /** Serve the schema as an Apollo Federation subgraph (`getSubgraphSchema`). The schema must contain a federation `@link` extension. */
  federation: boolean;
  port: number;
  corsOrigin: string;
  /** All three set: verify JWTs with this JWKS and enable `@authentication`/`@authorization`. */
  auth?: { jwksUrl: string; issuer: string; audience: string };
  /** Extra schema files appended to the base schema (new types, `extend type`). */
  schemaExtraPaths: string[];
  /** Cypher files run at every start (idempotent setup such as `CREATE CONSTRAINT ... IF NOT EXISTS`). */
  setupCypherPaths: string[];
}

type Env = Record<string, string | undefined>;

export function loadConfig(env: Env = process.env, io: ModelIo = realModelIo): Config {
  const missing = ["NEO4J_URI", "NEO4J_PASSWORD"].filter((k) => !env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
  const port = Number(env.PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer between 1 and 65535, got "${env.PORT}"`);
  }
  const authVars = ["AUTH_JWKS_URL", "AUTH_ISSUER", "AUTH_AUDIENCE"] as const;
  const authSet = authVars.filter((k) => env[k]);
  if (authSet.length > 0 && authSet.length < authVars.length) {
    const missingAuth = authVars.filter((k) => !env[k]);
    throw new Error(`AUTH_JWKS_URL, AUTH_ISSUER and AUTH_AUDIENCE must be set together; missing: ${missingAuth.join(", ")}`);
  }
  if (env.AUTH_JWKS_URL && !/^https?:\/\//.test(env.AUTH_JWKS_URL)) {
    throw new Error(`AUTH_JWKS_URL must be an http(s) URL, got "${env.AUTH_JWKS_URL}"`);
  }
  // A model sets defaults for the schema, seed, setup and counts; an explicit variable always wins over the model
  const modelsDir = env.MODELS_DIR ?? "models";
  const model = resolveModel(env.MODEL ?? "movies", modelsDir, io);
  const label = env.SEED_PROBE_LABEL ?? model.seedProbeLabel;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(label)) {
    throw new Error(`SEED_PROBE_LABEL must be a plain Neo4j label (letters, digits, underscore), got "${label}"`);
  }
  const seedPath = env.SEED_PATH ?? model.seedPath;
  const seed = env.SEED === undefined ? seedPath !== undefined : env.SEED.toLowerCase() !== "false";
  if (seed && seedPath === undefined) throw new Error(`SEED is on but MODEL "${model.name}" has no seed.cypher and SEED_PATH is not set`);
  return {
    model: model.name,
    modelsDir,
    readOnly: (env.READ_ONLY ?? "false").toLowerCase() === "true",
    neo4jUri: env.NEO4J_URI!,
    neo4jUsername: env.NEO4J_USERNAME ?? "neo4j",
    neo4jPassword: env.NEO4J_PASSWORD!,
    neo4jDatabase: env.NEO4J_DATABASE ?? "neo4j",
    neo4jAddCypherVersionPrefix: (env.NEO4J_CYPHER_VERSION_PREFIX ?? "false").toLowerCase() === "true",
    schemaPath: env.SCHEMA_PATH ?? model.schemaPath,
    seedPath,
    seed,
    seedProbeLabel: label,
    refreshCounts: env.REFRESH_COUNTS === undefined ? model.refreshCounts : env.REFRESH_COUNTS.toLowerCase() !== "false",
    federation: (env.FEDERATION ?? "false").toLowerCase() === "true",
    port,
    corsOrigin: env.CORS_ORIGIN ?? "http://localhost:3000",
    auth: authSet.length === authVars.length
      ? { jwksUrl: env.AUTH_JWKS_URL!, issuer: env.AUTH_ISSUER!, audience: env.AUTH_AUDIENCE! }
      : undefined,
    schemaExtraPaths: (env.SCHEMA_EXTRA_PATHS ?? "").split(",").map((p) => p.trim()).filter(Boolean),
    // The model's own setup runs first, then anything added with SETUP_CYPHER_PATHS
    setupCypherPaths: [...(model.setupCypherPath ? [model.setupCypherPath] : []), ...(env.SETUP_CYPHER_PATHS ?? "").split(",").map((p) => p.trim()).filter(Boolean)],
  };
}
