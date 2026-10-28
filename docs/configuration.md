# Configuration

The server is configured only through environment variables (read once at startup by `src/config.ts`) and two mounted files: the schema and the seed.

> **Where to run this.** Commands on this page that start with `npm`, `node` or `docker build` run inside a clone of this repository: `git clone https://github.com/grand-stack/grandstack-server`, then `cd grandstack-server` (Node 22 or later; run `npm ci` once). Commands that need the running stack use the `grandstack` repository's compose files: see the [quickstart](https://www.grandstack.ai/quickstart/).

## Environment variables

| Variable | Default | Required | Effect |
| --- | --- | --- | --- |
| `NEO4J_URI` | none | yes | Bolt URI, for example `bolt://neo4j:7687` or `neo4j+s://xxxx.databases.neo4j.io`. |
| `NEO4J_PASSWORD` | none | yes | Password for the Neo4j user. |
| `NEO4J_USERNAME` | `neo4j` | no | Neo4j user. |
| `NEO4J_DATABASE` | `neo4j` | no | Database used for every request and for seeding. Community Neo4j has only `neo4j`. |
| `NEO4J_CYPHER_VERSION_PREFIX` | `false` | no | `true` prefixes generated queries with the Cypher version the library targets; `false` lets the database choose. |
| `MODEL` | `movies` | no | Which model runs: `movies` (built in) or the name of a folder under `MODELS_DIR`. **Only one model runs.** Sets the defaults for the schema, setup Cypher, seed, probe label and counts plugin; any variable below still wins. See [models](#models). |
| `MODELS_DIR` | `models` | no | Where model folders are looked up. In the image this is relative to `/app`. |
| `READ_ONLY` | `false` | no | `true` generates no create, update or delete mutations for any `@node` type. See [read-only](#read-only). |
| `SCHEMA_PATH` | the model's schema (`schema/schema.graphql` for Movies) | no | GraphQL schema file. In the image this is relative to `/app`. |
| `SEED` | `true` if the model has a seed | no | `false` disables seeding entirely. `true` for a model with no seed is an error. |
| `SEED_PATH` | the model's seed (`seed/movies.cypher` for Movies) | no | Seed Cypher file ([format and rules](seeding.md)). |
| `SEED_PROBE_LABEL` | the model's (`Movie` for Movies) | no | Node label used to detect existing data. Set it to your main entity's label. Letters, digits and underscore only. |
| `REFRESH_COUNTS` | `true` for Movies, `false` for any other model | no | The plugin that recalculates `Person` counts after mutations. It belongs to Movies. |
| `AUTH_JWKS_URL` | none | no | URL of the identity provider's JWKS (public signing keys). Must be reachable **from the server**. With the next two, turns on JWT verification and `@authentication`/`@authorization`. |
| `AUTH_ISSUER` | none | no | Expected token issuer (`iss`), exactly as it appears in tokens. |
| `AUTH_AUDIENCE` | none | no | Expected token audience (`aud`). |
| `SCHEMA_EXTRA_PATHS` | none | no | Comma-separated extra `.graphql` files appended to the base schema (new types, `extend type`). |
| `SETUP_CYPHER_PATHS` | none | no | Comma-separated Cypher files run at **every** start, **after** the seed, for idempotent setup such as `CREATE CONSTRAINT ... IF NOT EXISTS` or filling in properties on the seeded data. |
| `FEDERATION` | `false` | no | `true` serves the schema as an [Apollo Federation](https://neo4j.com/docs/graphql/current/integrations/apollo-federation/) subgraph (`getSubgraphSchema()`), adding `_service` and `_entities`. The schema must contain `extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])` (add it through `SCHEMA_EXTRA_PATHS`); without it startup fails with `typeDefs must contain \`@link\` schema extension to be used with Apollo Federation`. See `grandstack-federation`. |
| `PORT` | `4000` | no | HTTP port. |
| `CORS_ORIGIN` | `http://localhost:3000` | no | Allowed browser origin(s): one origin, a comma-separated list, or `*`. With `*`, credentials are not allowed. |

The three `AUTH_*` variables must be set together; setting only some stops startup and names the missing ones. Without them the server does no authentication (the default). A missing required variable, an unknown `MODEL`, a bad `PORT`, a bad `SEED_PROBE_LABEL` or a non-http(s) `AUTH_JWKS_URL` also stops startup with a message that names the problem. Booleans accept `true` or `false` in any letter case.

## Files

| File | Used for |
| --- | --- |
| `schema/schema.graphql` | The API. Read at startup. |
| `seed/movies.cypher` | Sample data, loaded by the rules in [seeding](seeding.md). |

## Models

A **model** is a schema with the setup and sample data that go with it. The image has one built in, `movies`, which is what runs when `MODEL` is not set. Any other model is a folder you mount:

```
models/<name>/
  schema.graphql   required
  setup.cypher     optional: idempotent Cypher run at every start (constraints, indexes)
  seed.cypher      optional: sample data, loaded by the usual [seed rules](seeding.md)
  model.json       optional: { "seedProbeLabel": "Instance", "refreshCounts": false }
```

```sh
docker run --rm -p 4000:4000 \
  -e NEO4J_URI=bolt://host.docker.internal:7687 -e NEO4J_PASSWORD=secret \
  -e MODEL=mine -v "$PWD/models:/app/models:ro" \
  grandstack-server:local
```

- **Only one model runs**, because `MODEL` holds one name. Two models need two servers (and two databases, or you get both sets of data in one).
- A model with a `seed.cypher` must name its `seedProbeLabel`, so the server can tell whether the data is already there. A model with no seed does not seed at all.
- The Person counts plugin belongs to Movies, so it is **off** for every other model unless `model.json` turns it on.
- **Order of precedence** for each setting: the environment variable, then `model.json`, then the default. `SETUP_CYPHER_PATHS` adds to the model's `setup.cypher`, which runs first.
- The name is lower-case letters, digits and hyphens. A name that does not match a folder stops startup and lists the models it found.
- Do not point two models at one Neo4j database unless you mean to: nothing separates their data.

## Read-only

`READ_ONLY=true` adds `@mutation(operations: [])` to every `@node` type, found in the schema itself, so the generated create, update and delete mutations never exist (the schema has no `Mutation` type at all, and a mutation fails with "Schema is not configured to execute mutation operation"). A type that already sets its own `@mutation` keeps it. Queries are unchanged.

It is not a permission system: it is a different API. The usual use is to run **two servers on one database from one schema**: a public one with `READ_ONLY=true` and a private one without, which only trusted services can reach. Keep the private one off any published port and any network the public side shares.

## Using your own schema and seed

Without rebuilding the image, mount your files and point the variables at them:

```sh
docker run --rm -p 4000:4000 \
  -e NEO4J_URI=bolt://host.docker.internal:7687 -e NEO4J_PASSWORD=secret \
  -e SEED_PROBE_LABEL=Book -e REFRESH_COUNTS=false \
  -v "$PWD/my-schema.graphql:/app/schema/schema.graphql:ro" \
  -v "$PWD/my-seed.cypher:/app/seed/movies.cypher:ro" \
  grandstack-server:0.6.0
```

(Under Podman on macOS add `:z` to the mount options if SELinux relabeling is needed.)

## Running locally without Docker

```sh
npm ci
NEO4J_URI=bolt://localhost:7687 NEO4J_PASSWORD=secret npm run dev   # tsx watch, restarts on change
npm run lint      # GraphQL ESLint on the schema, then tsc --noEmit
npm test          # vitest unit tests
npm run schema:check   # breaking changes against git HEAD
npm run docs:schema    # regenerate docs/schema-reference.md
npm run docs:check     # fail if the reference is stale or a doc link is broken
```

## The image

`Dockerfile` is multi-stage: build stage installs dependencies and compiles TypeScript; the final stage is `node:24-slim`, copies `node_modules`, `dist`, `schema` and `seed` (models are mounted, not built in), and runs as the non-root `node` user on port 4000. Tag images with the same version as the git tag ([releases](#releases)).

## Releases

Versions are semver git tags (`v0.6.0`) with a matching image tag. The umbrella repo pins the versions it was tested with. Cut a release by running lint, tests and `npm run docs:check`, tagging the commit, and building the image with the same tag.

## CORS

The browser calls the server directly, so the web app's origin must be allowed. If the browser console shows a CORS error, set `CORS_ORIGIN` to the exact origin of the web app (scheme, host and port), for example `http://localhost:3000`.

## Authentication and extra schema

The server itself stays auth-agnostic. With the `AUTH_*` variables set it verifies the `Authorization: Bearer` token on every request (signature from the JWKS, expiry, issuer, audience) and makes the decoded claims available to `@authentication` and `@authorization` rules in the schema. Without them those directives do not work, which is why rules are added through `SCHEMA_EXTRA_PATHS` only when auth is on.

The `grandstack-auth` repository is the worked example: it supplies a gateway, a Keycloak dev realm, and `schema/auth.graphql` (users, reviews, rules), which the umbrella's `compose.auth.yaml` mounts and loads through these settings. See that repo's docs, and [the schema guide](schema-guide.md#authentication-and-authorization-rules-in-v7) for the syntax and the pitfalls we found.
