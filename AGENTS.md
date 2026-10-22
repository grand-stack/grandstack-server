# AGENTS.md: grandstack-server

GraphQL API over Neo4j using `@neo4j/graphql` v7 and GraphQL Yoga. Configured by environment variables and a schema file. Read [docs/how-it-works.md](docs/how-it-works.md) first, then [docs/recipes.md](docs/recipes.md) for the change you are making.

## Commands
- Run the whole stack: `cd ../grandstack && docker compose up --build` (GraphQL at http://localhost:4000/graphql).
- Local dev against a running Neo4j: `NEO4J_URI=bolt://localhost:7687 NEO4J_PASSWORD=... npm run dev`.
- Before you finish any change: `npm run lint && npm test && npm run schema:check && npm run docs:check`. `schema:check` needs a git checkout with the schema committed at `HEAD`; `docs:check` fails until you run `npm run docs:schema` after a schema change.

## Rules that are easy to get wrong
- Every type, field and argument in `schema/schema.graphql` needs a `"""description"""` (lint enforces it).
- Types need `@node` (v7). New Neo4j directives need a stub in `tooling/neo4j-directives.graphql`.
- Scalar updates are `{ set: value }`. Relationship updates must be a diff, never "disconnect all then connect" ([docs/mutations.md](docs/mutations.md)).
- `contains` filters are case-sensitive. Keep `graphql` on 16.x. Pin exact dependency versions.
- Seed changes need a bumped `// seed-version`. Seed maps use bare keys. See [docs/seeding.md](docs/seeding.md).
- `Person.actedCount` and `directedCount` are refreshed by a plugin after every mutation; do not maintain them by hand.
- Auth is off unless the three `AUTH_*` variables are set (they must be set together). Rules (`@authentication`/`@authorization`) belong in an extra schema file loaded with `SCHEMA_EXTRA_PATHS`; v7 pitfalls (APOC for `validate` and `DateTime`, no `@unique`, `type Mutation` not `extend`) are in [docs/schema-guide.md](docs/schema-guide.md#authentication-and-authorization-rules-in-v7). Do not expose an open server publicly.
- New code files need the copyright header (two lines: `Copyright (c) "Neo4j"` and `Neo4j Sweden AB [http://neo4j.com]`, in the file's comment syntax). Run `node ../grandstack/scripts/add-headers.mjs` (or `node ../.github/scripts/headers.mjs --root .` for one repository) to add it; `--check` lists what is missing. Generated files are exempt.

## Keep the docs true
When you change behaviour, update the matching doc in the same change: environment variables in `docs/configuration.md` and the table in `src/config.ts` tests, schema changes via `npm run docs:schema`, and new gotchas in `docs/troubleshooting.md`. `npm run docs:check` fails on a stale schema reference or a broken relative link. Diagrams are SVG files in `docs/diagrams/`: edit the SVG and its numbered legend together when behaviour changes; `npm run docs:check` fails on a missing alt text, unsafe SVG content, or legend numbers that do not match the callouts drawn.

Versioning: semver git tags with a matching image tag.
- Releases use the **release-cut** workflow (Actions tab), which sets the version in every `package.json`, tags and publishes. Do not bump versions or push tags by hand; see `grandstack/docs/releasing.md`.
