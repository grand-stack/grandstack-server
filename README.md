# grandstack-server

A Docker image that serves GraphQL over Neo4j. You give it a Neo4j connection (environment variables), a GraphQL schema (a file) and optionally some seed data; it gives you a full API with queries, filters, sorting, relationships and create/update/delete. Built on [`@neo4j/graphql`](https://neo4j.com/docs/graphql/) v7, GraphQL Yoga and the Neo4j driver. It is the server half of GRANDstack, where the "A" now stands for Agent: the same API serves people and coding agents.

> **Authentication is off by default.** Anyone who can reach the endpoint can read, change and delete data. To require logins, set the `AUTH_*` variables ([configuration](docs/configuration.md#authentication-and-extra-schema)); the `grandstack-auth` repo is a complete example with a gateway, Keycloak and row-level rules. Do not expose an open server publicly.

## Run it

The easiest way is the `grandstack` umbrella repo, which starts Neo4j, this server and the web app together (`docker compose up --build`). To run this server on its own against a Neo4j you already have:

```sh
docker build -t grandstack-server:0.6.0 .
docker run --rm -p 4000:4000 \
  -e NEO4J_URI=bolt://host.docker.internal:7687 -e NEO4J_PASSWORD=secret \
  grandstack-server:0.6.0
# GraphQL and GraphiQL: http://localhost:4000/graphql
```

`host.docker.internal` reaches a Neo4j running on your own machine. Under Podman `host.containers.internal` is the equivalent alias. Make sure it is the Neo4j you mean: if more than one Neo4j listens on port 7687 you can reach the wrong one and get an authentication error.

The bundled Movies seed loads into an empty database on first start. See [configuration](docs/configuration.md) for every setting, including how to use your own schema and data.

## Documentation

| Read | To learn |
| --- | --- |
| [How it works](docs/how-it-works.md) | Startup sequence, request flow, the per-request context |
| [Schema guide](docs/schema-guide.md) | Writing the schema: `@node`, relationships, `@cypher`, v7 rules |
| [Schema reference](docs/schema-reference.md) | Every type and field in the current schema (generated) |
| [Mutations](docs/mutations.md) | Create, update and delete, relationship diffs, the counts plugin |
| [Seeding](docs/seeding.md) | Seed format, versioning, using your own data |
| [Configuration](docs/configuration.md) | Environment variables, files, image, releases |
| [Recipes](docs/recipes.md) | Step-by-step common changes |
| [Troubleshooting](docs/troubleshooting.md) | Errors we hit and their fixes |

`npm ci` prints `npm warn install-scripts` notices; they are harmless.

Working with a coding agent? Start with [AGENTS.md](AGENTS.md).

The bundled data is sample data: titles, casts and relationships are real, but ratings and runtimes are approximate.

Last verified: v0.7.0 with `@neo4j/graphql` 7.6.4, Neo4j 2026.10 community, Node 24 (image) and Node 26 (development).
