# AGENTS.md: grandstack-server

GraphQL API over Neo4j using `@neo4j/graphql` v7 and GraphQL Yoga. Configured by environment variables and a schema file. Read [docs/how-it-works.md](docs/how-it-works.md) first, then [docs/recipes.md](docs/recipes.md) for the change you are making.

## Commands
- Run the whole stack: `cd ../grandstack && docker compose up --build` (GraphQL at http://localhost:4000/graphql).
- Local dev against a running Neo4j: `NEO4J_URI=bolt://localhost:7687 NEO4J_PASSWORD=... npm run dev`.
- Before you finish any change: `npm run lint && npm test && npm run schema:check && npm run docs:check`.

## Rules that are easy to get wrong
- Every type, field and argument in `schema/schema.graphql` needs a `"""description"""` (lint enforces it).
- Types need `@node` (v7). New Neo4j directives need a stub in `tooling/neo4j-directives.graphql`.
- Scalar updates are `{ set: value }`. Relationship updates must be a diff, never "disconnect all then connect" ([docs/mutations.md](docs/mutations.md)).
- `contains` filters are case-sensitive. Keep `graphql` on 16.x. Pin exact dependency versions.
- Seed changes need a bumped `// seed-version`. Seed maps use bare keys. See [docs/seeding.md](docs/seeding.md).
- `Person.actedCount` and `directedCount` are refreshed by a plugin after every mutation; do not maintain them by hand.
- There is no auth. Do not expose the server publicly.

## Keep the docs true
When you change behaviour, update the matching doc in the same change: environment variables in `docs/configuration.md` and the table in `src/config.ts` tests, schema changes via `npm run docs:schema`, and new gotchas in `docs/troubleshooting.md`. `npm run docs:check` fails on a stale schema reference or a broken relative link.

Versioning: semver git tags with a matching image tag.
