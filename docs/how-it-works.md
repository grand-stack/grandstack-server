# How grandstack-server works

grandstack-server is a small Node service that exposes a GraphQL API over a Neo4j database. You describe your data in a GraphQL schema file; [`@neo4j/graphql`](https://neo4j.com/docs/graphql/) turns it into a full API (queries, filters, sorting, create/update/delete) and translates every request into Cypher. [GraphQL Yoga](https://the-guild.dev/graphql/yoga-server) serves it over HTTP.

Applies to grandstack-server v0.6.0 (`@neo4j/graphql` 7.6.4, `graphql` 16.14, Node 22 or later).

## What is in the repo

| Path | Purpose |
| --- | --- |
| `src/index.ts` | Entry point: wires everything together (below). |
| `src/config.ts` | Reads and validates environment variables ([configuration](configuration.md)). |
| `src/seed.ts` | Loads the seed Cypher file when needed ([seeding](seeding.md)). |
| `src/counts.ts`, `src/refreshCountsPlugin.ts` | Keeps stored film counts correct after mutations ([mutations](mutations.md#stored-counts-are-refreshed-after-every-mutation)). |
| `schema/schema.graphql` | **The API.** Your types, fields and relationships ([schema guide](schema-guide.md)). |
| `seed/movies.cypher` | Sample data (152 films, 464 people). |
| `tooling/neo4j-directives.graphql` | Stub declarations of Neo4j directives so lint and breaking-change tools can read the schema. |
| `scripts/` | `schema-check.sh` (breaking changes), `generate-schema-docs.mjs`, `check-links.mjs`. |
| `test/` | Unit tests (vitest). |
| `Dockerfile` | Multi-stage build, runs as the non-root `node` user. |

## Startup sequence

`src/index.ts` runs these steps in order. If any step throws, the process exits with the error, so a bad configuration fails fast.

1. **Read configuration** from environment variables. `NEO4J_URI` and `NEO4J_PASSWORD` are required.
2. **Create the Neo4j driver** and call `verifyConnectivity`. This fails immediately if Neo4j is unreachable or the credentials are wrong.
3. **Seed** (unless `SEED=false`): decide whether to load `seed/movies.cypher` ([rules](seeding.md)).
4. **Read the schema file** (`SCHEMA_PATH`) and build the executable schema with `new Neo4jGraphQL({ typeDefs, driver }).getSchema()`. Schema errors, for example a missing `@node`, surface here.
5. **Create the Yoga server** with CORS, the counts plugin (if `REFRESH_COUNTS` is not `false`) and the per-request context below.
6. **Listen** on `PORT`. The GraphQL endpoint is `/graphql`; opening it in a browser shows GraphiQL.
7. On `SIGINT` or `SIGTERM` it closes the HTTP server and the driver.

## What happens to a request

```
client --HTTP POST /graphql--> Yoga
   Yoga builds the per-request context (below)
   plugins wrap execution (counts refresh runs after mutations)
   @neo4j/graphql translates the operation to Cypher and runs it through the driver
   Neo4j returns rows; @neo4j/graphql shapes them into the GraphQL response
client <--JSON--
```

Nothing in this repo writes resolvers. Behaviour comes from the schema file and the directives in it.

## The per-request context

Yoga calls `context` for every request in `src/index.ts`. `@neo4j/graphql` reads these keys:

| Key | Value here | What it does |
| --- | --- | --- |
| `executionContext` | the shared driver | The driver (or session or transaction) used to run the generated Cypher. With a driver, the library opens a session for each request. |
| `sessionConfig.database` | `NEO4J_DATABASE` (default `neo4j`) | Database every request runs against. Only used when `executionContext` is a driver. |
| `token` | the `Authorization` header, if any | A bearer token (with or without `Bearer `) for authentication and authorization. It does nothing until you enable authorization in the schema; authentication is planned but not built yet. |
| `cypherQueryOptions.addVersionPrefix` | `NEO4J_CYPHER_VERSION_PREFIX` (default `false`) | `true` prefixes generated queries with the Cypher version the library targets; `false` lets the database use its default. |

Other keys exist but are not set. `jwt` supplies an already-decoded token payload and takes precedence over `token`. `cypherParams` supplies named parameters that `@cypher` fields can reference as `$name`, for example a tenant id. `transaction` sets metadata and a timeout for the transaction. The rest of `cypherQueryOptions` (`runtime`, `planner`, `replan`, and so on) are query-tuning options left at the database default.

## Limits to know about

- Titles and names act as keys (unique constraints), so there are no ids. See [seeding](seeding.md).
- Community Neo4j supports one database, which is why the default is `neo4j`.
- `graphql` must stay on 16.x, because `@neo4j/graphql` 7.6.4 declares it as a peer dependency (graphql 17 is newer but not supported).
- There is no authentication yet. Anyone who can reach the endpoint can read and write everything.

Next: [schema guide](schema-guide.md), [mutations](mutations.md), [recipes](recipes.md).
