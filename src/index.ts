// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { Neo4jGraphQL } from "@neo4j/graphql";
import neo4j from "neo4j-driver";
import { createYoga } from "graphql-yoga";
import { loadConfig } from "./config.js";
import { refreshCounts } from "./counts.js";
import { addReadOnly } from "./readOnly.js";
import { useRefreshCounts } from "./refreshCountsPlugin.js";
import { runSetupCypher, seedIfNeeded } from "./seed.js";

const config = loadConfig();
const driver = neo4j.driver(config.neo4jUri, neo4j.auth.basic(config.neo4jUsername, config.neo4jPassword));
await driver.verifyConnectivity({ database: config.neo4jDatabase });

console.log(`Model: ${config.model}`);
if (config.seed && config.seedPath) {
  const decision = await seedIfNeeded(driver, config.neo4jDatabase, config.seedPath, config.seedProbeLabel);
  const messages = {
    load: "Loaded seed",
    "skip-current": "Seed already loaded, skipping",
    "skip-foreign": `Database already has ${config.seedProbeLabel} data not loaded by this seed, skipping`,
  };
  console.log(messages[decision]);
}

// After the seed, so statements that act on seeded data (such as the federation links) also work on a fresh database
if (config.setupCypherPaths.length > 0) {
  const n = await runSetupCypher(driver, config.neo4jDatabase, config.setupCypherPaths);
  console.log(`Ran ${n} setup statement(s)`);
}

const baseTypeDefs = (await Promise.all([config.schemaPath, ...config.schemaExtraPaths].map((p) => readFile(p, "utf8")))).join("\n");
// READ_ONLY=true: no create, update or delete mutations are generated, for any node type
const typeDefs = config.readOnly ? addReadOnly(baseTypeDefs) : baseTypeDefs;
if (config.readOnly) console.log("Read-only: no mutations are generated");
const neo4jGraphQL = new Neo4jGraphQL({
  typeDefs,
  driver,
  // With AUTH_* set, tokens are verified against the JWKS before @authentication/@authorization rules run
  features: config.auth
    ? { authorization: { key: { url: config.auth.jwksUrl }, verifyOptions: { issuer: config.auth.issuer, audience: config.auth.audience } } }
    : undefined,
});
// FEDERATION=true serves a federation subgraph; the typeDefs then need `extend schema @link(...federation/v2.0...)`
const schema = config.federation ? await neo4jGraphQL.getSubgraphSchema() : await neo4jGraphQL.getSchema();
if (config.federation) console.log("Serving as a federation subgraph");
if (config.auth) console.log(`JWT verification on (issuer ${config.auth.issuer})`);

// Create a Yoga instance with the neo4j schema and per-request Neo4j options
const yoga = createYoga({
  schema,
  plugins: config.refreshCounts ? [useRefreshCounts(() => refreshCounts(driver, config.neo4jDatabase))] : [],
  // Comma-separated origins, or * for any
  cors: { origin: config.corsOrigin.split(",").map((o) => o.trim()), credentials: config.corsOrigin !== "*" },
  context: ({ request }) => ({
    executionContext: driver,
    token: request.headers.get("authorization") ?? undefined,
    sessionConfig: {
      database: config.neo4jDatabase, // Set the database
    },
    cypherQueryOptions: {
      // false (default) lets the database choose its Cypher version; true prefixes queries with the library's version
      addVersionPrefix: config.neo4jAddCypherVersionPrefix,
    },
  }),
});

const server = createServer(yoga);
server.listen(config.port, () => {
  console.log(`GraphQL ready at http://localhost:${config.port}${yoga.graphqlEndpoint}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close();
    void driver.close().finally(() => process.exit(0));
  });
}
