# Troubleshooting

Errors we actually hit while building this, with causes and fixes.

## Startup

| Symptom | Cause and fix |
| --- | --- |
| `Missing required environment variables: NEO4J_URI, NEO4J_PASSWORD` | Set both. In compose they come from the `server` service environment. |
| Process exits right after `verifyConnectivity` with a connection or auth error | Neo4j is not up yet, the URI is wrong, or the password does not match `NEO4J_AUTH`. In compose the server waits for the Neo4j healthcheck; outside compose start Neo4j first. |
| `Directive "relationship" must be in a type with "@node"` | v7 requires `@node` on every type that uses `@relationship`. Add `@node` ([schema guide](schema-guide.md#node-types)). |
| `Invalid input '"title"': expected an expression` while seeding | Cypher map keys must be bare words (`{title: "x"}`), not quoted (`{"title": "x"}`). JSON dumped into Cypher needs its keys unquoted. |
| `npm install` complains about a `graphql` peer dependency | Keep `graphql` on 16.x. `@neo4j/graphql` 7.6.4 does not support graphql 17. |
| Seed says "Database already has Movie data not loaded by this seed, skipping" | The database has `Movie` nodes but no `SeedMeta` marker, so it is treated as someone else's data. Use an empty database, or `docker compose down -v`. See [seeding](seeding.md). |
| Changed the seed but nothing reloaded | Bump `// seed-version: N` at the top of the file. |

## Queries and mutations

| Symptom | Cause and fix |
| --- | --- |
| Search by text finds nothing | `contains` is case-sensitive. Match as typed and in Title Case, or store a lowercase copy to search. |
| `Expected value of type "StringScalarMutations", found "x"` (inline) or `Variable "$u" got invalid value "x" at "u.tagline"; Expected type "StringScalarMutations" to be an object` (variables) | Updates need set operators: `tagline: { set: "x" }`. |
| `Constraint validation failed` | You tried to create a duplicate of a unique key (title or name), including via a nested `create`. Use `connect` for things that exist. |
| After updating a relationship list the relationships are gone | You disconnected and connected in the same mutation; the disconnect runs last in v7. Send a diff ([mutations](mutations.md#changing-relationships-send-a-diff)). |
| `Unexpected error.` when reading a field from a custom `@cypher` type | A plain object returned from `@cypher` cannot contain a node. Return scalars (see `Collaboration`) ([schema guide](schema-guide.md#computed-fields-with-cypher)). |
| Film counts look wrong, or are `null` inside a mutation result | The refresh runs after the mutation's response is built, so read counts with a query afterwards. Counts are stored and refreshed after mutations. If you changed relationships with Cypher directly, rerun the statement in [seeding](seeding.md#derived-counts). If the plugin is off (`REFRESH_COUNTS=false`) nothing refreshes them. |

## From a browser

| Symptom | Cause and fix |
| --- | --- |
| CORS error in the browser console | Set `CORS_ORIGIN` to the exact web origin, for example `http://localhost:3000`. |
| `Failed to fetch` | The web app's `VITE_GRAPHQL_URL` is wrong, or the server is not running. The URL is fixed at the web app's build time. |

## Containers (Docker or Podman)

| Symptom | Cause and fix |
| --- | --- |
| `docker` commands say they cannot connect | On macOS `docker` may be Podman. Run `podman machine start`, and set `DOCKER_HOST` to the socket path it prints. |
| `The client is unauthorized due to authentication failure` although the password is right | You may be reaching a different Neo4j than you think (for example one already running on your machine on port 7687). Check with `lsof -nP -iTCP:7687 -sTCP:LISTEN`. Repeated failures can also lock the account for a short time (`too many times in a row`); wait a few seconds. |
| Neo4j keeps restarting or the healthcheck never passes | Give it time on first start (the compose healthcheck allows about 2.5 minutes), and check `docker compose logs neo4j`. |
| Data is back to the original after restart | You ran `docker compose down -v`, which deletes the volume. Use `down` without `-v` to keep data. |
