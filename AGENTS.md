# AGENTS.md: grandstack-server

GraphQL API over Neo4j using `@neo4j/graphql` v7 and GraphQL Yoga. Configured only by environment variables and a schema file.

## Run
- Whole stack: `cd ../grandstack && docker compose up --build` (Neo4j + server). GraphQL at http://localhost:4000/graphql.
- Local dev against a running Neo4j: set `NEO4J_URI`, `NEO4J_PASSWORD`, then `npm run dev`.

## Environment
`NEO4J_URI` and `NEO4J_PASSWORD` are required. Optional: `NEO4J_USERNAME` (neo4j), `NEO4J_DATABASE` (neo4j), `SCHEMA_PATH` (schema/schema.graphql), `SEED` (true), `SEED_PATH` (seed/movies.cypher), `PORT` (4000).
The Movies seed loads only when the target database has no `Movie` nodes. `SEED=false` disables it.

## Change the schema
1. Edit `schema/schema.graphql`. Every type, field and argument needs a `"""description"""`.
2. Types need `@node` (required by v7). If you use a new `@neo4j/graphql` directive, add a stub to `tooling/neo4j-directives.graphql`.
3. Run `npm run lint` (GraphQL ESLint + tsc), `npm test`, and `npm run schema:check` (breaking changes against git HEAD).
4. Restart the server; the schema is read at startup, so mounting a different file needs no rebuild.

## Conventions
- Pin exact dependency versions. `graphql` must stay on 16.x (peer dependency of `@neo4j/graphql`).
- Community Neo4j has a single database, so the default is `neo4j`.
- Versioning: semver git tags with a matching image tag.
