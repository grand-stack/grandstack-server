import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { Neo4jGraphQL } from "@neo4j/graphql";
import neo4j from "neo4j-driver";
import { createYoga } from "graphql-yoga";
import { loadConfig } from "./config.js";
import { seedIfNeeded } from "./seed.js";

const config = loadConfig();
const driver = neo4j.driver(config.neo4jUri, neo4j.auth.basic(config.neo4jUsername, config.neo4jPassword));
await driver.verifyConnectivity({ database: config.neo4jDatabase });

if (config.seed) {
  const decision = await seedIfNeeded(driver, config.neo4jDatabase, config.seedPath);
  const messages = {
    load: "Loaded Movies seed",
    "skip-current": "Movies seed already loaded, skipping",
    "skip-foreign": "Database already has Movie data not loaded by this seed, skipping",
  };
  console.log(messages[decision]);
}

const typeDefs = await readFile(config.schemaPath, "utf8");
const neo4jGraphQL = new Neo4jGraphQL({ typeDefs, driver });
const schema = await neo4jGraphQL.getSchema();

// Create a Yoga instance with the neo4j schema and per-request Neo4j options
const yoga = createYoga({
  schema,
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
