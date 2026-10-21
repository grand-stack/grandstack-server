# grandstack-server

A Docker image that serves GraphQL over Neo4j. Connection comes from environment variables, the schema from a mounted file, and the Movies dataset loads on first start.

```sh
docker run --rm -p 4000:4000 \
  -e NEO4J_URI=bolt://host.docker.internal:7687 -e NEO4J_PASSWORD=secret \
  -v "$PWD/schema:/app/schema" grandstack-server:0.1.0
```

For the full stack (Neo4j included) use the [grandstack](../grandstack) umbrella repo. See [AGENTS.md](AGENTS.md) for configuration and how to change the schema.

The bundled Movies data is sample data: titles, casts and relationships are real, but ratings and runtimes are approximate.
