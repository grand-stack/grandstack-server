# AGENTS.md: grandstack-server

GraphQL API over Neo4j using `@neo4j/graphql` v7 and GraphQL Yoga. Configured only by environment variables and a schema file.

## Run
- Whole stack: `cd ../grandstack && docker compose up --build` (Neo4j + server). GraphQL at http://localhost:4000/graphql.
- Local dev against a running Neo4j: set `NEO4J_URI`, `NEO4J_PASSWORD`, then `npm run dev`.

## Environment
`NEO4J_URI` and `NEO4J_PASSWORD` are required. Optional: `NEO4J_USERNAME` (neo4j), `NEO4J_DATABASE` (neo4j), `NEO4J_CYPHER_VERSION_PREFIX` (false; true adds the Cypher version prefix to queries), `SCHEMA_PATH` (schema/schema.graphql), `SEED` (true), `SEED_PATH` (seed/movies.cypher), `PORT` (4000), `CORS_ORIGIN` (http://localhost:3000; comma-separated origins, or `*`).
The Movies seed loads into an empty database, and reloads when `// seed-version: N` in the seed file is newer than the `(:SeedMeta {name:'movies'})` node. A database with Movie nodes but no SeedMeta is treated as someone else's data and left alone. `SEED=false` disables seeding. Bump the version when you change the seed (all statements use MERGE, so reloading is safe). The data is sample data with approximate ratings.

## Change the schema
1. Edit `schema/schema.graphql`. Every type, field and argument needs a `"""description"""`.
2. Types need `@node` (required by v7). If you use a new `@neo4j/graphql` directive, add a stub to `tooling/neo4j-directives.graphql`.
3. Run `npm run lint` (GraphQL ESLint + tsc), `npm test`, and `npm run schema:check [ref]` (breaking changes against a git ref, default HEAD).
4. Restart the server; the schema is read at startup, so mounting a different file needs no rebuild.

## Conventions
- Pin exact dependency versions. `graphql` must stay on 16.x (peer dependency of `@neo4j/graphql`).
- Community Neo4j has a single database, so the default is `neo4j`.
- Versioning: semver git tags with a matching image tag.

## Derived data
`Person.actedCount` and `directedCount` are stored on the nodes so people can be sorted and filtered by film count in plain GraphQL. The seed sets them, and `src/refreshCountsPlugin.ts` recalculates them for everyone after every mutation (before the response is sent), so any client, including agents, keeps them correct. The recalculation covers all people on each mutation, which is fine for the sample size. `Movie.similar` and `Person.collaborators` are `@cypher` fields and always reflect the graph. `Collaboration` returns a name rather than a Person because v7 could not resolve a node nested inside a custom `@cypher` return type.

## Mutating relationships
- Scalar updates use set operators: `update: { tagline: { set: "..." } }`.
- Updating a relationship list in one `updateMovies`: do not "disconnect all, then connect" in the same mutation, because the disconnect runs after the connect and removes the new links. Send a diff instead: `disconnect` the removed ones, `connect` or `create` the added ones, and a separate `{ update: { where, edge: { roles: { set: [...] } } } }` entry per changed role.
- `delete*` mutations detach relationships.
