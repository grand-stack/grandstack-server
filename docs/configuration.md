# Configuration

The server is configured only through environment variables (read once at startup by `src/config.ts`) and two mounted files: the schema and the seed.

## Environment variables

| Variable | Default | Required | Effect |
| --- | --- | --- | --- |
| `NEO4J_URI` | none | yes | Bolt URI, for example `bolt://neo4j:7687` or `neo4j+s://xxxx.databases.neo4j.io`. |
| `NEO4J_PASSWORD` | none | yes | Password for the Neo4j user. |
| `NEO4J_USERNAME` | `neo4j` | no | Neo4j user. |
| `NEO4J_DATABASE` | `neo4j` | no | Database used for every request and for seeding. Community Neo4j has only `neo4j`. |
| `NEO4J_CYPHER_VERSION_PREFIX` | `false` | no | `true` prefixes generated queries with the Cypher version the library targets; `false` lets the database choose. |
| `SCHEMA_PATH` | `schema/schema.graphql` | no | GraphQL schema file. In the image this is relative to `/app`. |
| `SEED` | `true` | no | `false` disables seeding entirely. |
| `SEED_PATH` | `seed/movies.cypher` | no | Seed Cypher file ([format and rules](seeding.md)). |
| `SEED_PROBE_LABEL` | `Movie` | no | Node label used to detect existing data. Set it to your main entity's label. Letters, digits and underscore only. |
| `REFRESH_COUNTS` | `true` | no | `false` turns off the plugin that recalculates `Person` counts after mutations. |
| `AUTH_JWKS_URL` | none | no | URL of the identity provider's JWKS (public signing keys). Must be reachable **from the server**. With the next two, turns on JWT verification and `@authentication`/`@authorization`. |
| `AUTH_ISSUER` | none | no | Expected token issuer (`iss`), exactly as it appears in tokens. |
| `AUTH_AUDIENCE` | none | no | Expected token audience (`aud`). |
| `SCHEMA_EXTRA_PATHS` | none | no | Comma-separated extra `.graphql` files appended to the base schema (new types, `extend type`). |
| `SETUP_CYPHER_PATHS` | none | no | Comma-separated Cypher files run at **every** start, **after** the seed, for idempotent setup such as `CREATE CONSTRAINT ... IF NOT EXISTS` or filling in properties on the seeded data. |
| `FEDERATION` | `false` | no | `true` serves the schema as an [Apollo Federation](https://neo4j.com/docs/graphql/current/integrations/apollo-federation/) subgraph (`getSubgraphSchema()`), adding `_service` and `_entities`. The schema must contain `extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])` (add it through `SCHEMA_EXTRA_PATHS`); without it startup fails with `typeDefs must contain \`@link\` schema extension to be used with Apollo Federation`. See `grandstack-federation`. |
| `PORT` | `4000` | no | HTTP port. |
| `CORS_ORIGIN` | `http://localhost:3000` | no | Allowed browser origin(s): one origin, a comma-separated list, or `*`. With `*`, credentials are not allowed. |

The three `AUTH_*` variables must be set together; setting only some stops startup and names the missing ones. Without them the server does no authentication (the default). A missing required variable, a bad `PORT`, a bad `SEED_PROBE_LABEL` or a non-http(s) `AUTH_JWKS_URL` also stops startup with a message that names the problem. Booleans accept `true` or `false` in any letter case.

## Files

| File | Used for |
| --- | --- |
| `schema/schema.graphql` | The API. Read at startup. |
| `seed/movies.cypher` | Sample data, loaded by the rules in [seeding](seeding.md). |

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

`Dockerfile` is multi-stage: build stage installs dependencies and compiles TypeScript; the final stage is `node:24-slim`, copies `node_modules`, `dist`, `schema` and `seed`, and runs as the non-root `node` user on port 4000. Tag images with the same version as the git tag ([releases](#releases)).

## Releases

Versions are semver git tags (`v0.6.0`) with a matching image tag. The umbrella repo pins the versions it was tested with. Cut a release by running lint, tests and `npm run docs:check`, tagging the commit, and building the image with the same tag.

## CORS

The browser calls the server directly, so the web app's origin must be allowed. If the browser console shows a CORS error, set `CORS_ORIGIN` to the exact origin of the web app (scheme, host and port), for example `http://localhost:3000`.

## Authentication and extra schema

The server itself stays auth-agnostic. With the `AUTH_*` variables set it verifies the `Authorization: Bearer` token on every request (signature from the JWKS, expiry, issuer, audience) and makes the decoded claims available to `@authentication` and `@authorization` rules in the schema. Without them those directives do not work, which is why rules are added through `SCHEMA_EXTRA_PATHS` only when auth is on.

The `grandstack-auth` repository is the worked example: it supplies a gateway, a Keycloak dev realm, and `schema/auth.graphql` (users, reviews, rules), which the umbrella's `compose.auth.yaml` mounts and loads through these settings. See that repo's docs, and [the schema guide](schema-guide.md#authentication-and-authorization-rules-in-v7) for the syntax and the pitfalls we found.
