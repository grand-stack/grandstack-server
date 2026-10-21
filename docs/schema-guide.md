# Schema guide

The schema file, `schema/schema.graphql`, is the whole API. This page explains the pieces `@neo4j/graphql` v7 understands and the rules that tripped us up. For a list of what the current schema contains see the generated [schema reference](schema-reference.md).

## Node types

A type stored as nodes in Neo4j needs the `@node` directive in v7:

```graphql
"""A film in the Movies graph."""
type Movie @node {
  """Film title. Unique within the dataset."""
  title: String!
  released: Int
}
```

- The node label is the type name (`Movie`). Use `@node(labels: ["Film"])` to store under a different label.
- Properties map to fields with the same name.
- Without `@node`, a type that uses `@relationship` fails at startup with `Directive "relationship" must be in a type with "@node"`.

## Relationships

```graphql
type Movie @node {
  genres: [Genre!]! @relationship(type: "IN_GENRE", direction: OUT)
  actors: [Person!]! @relationship(type: "ACTED_IN", direction: IN, properties: "ActedIn")
}

type Person @node {
  actedIn: [Movie!]! @relationship(type: "ACTED_IN", direction: OUT, properties: "ActedIn")
}

type ActedIn @relationshipProperties {
  roles: [String!]!
}
```

- Declare each relationship from **both** sides if you want to traverse it from both sides. `direction` is relative to the type the field is on: `Movie.actors` is `IN` (the arrow goes from Person to Movie), `Person.actedIn` is `OUT` for the same relationship.
- `properties` names a `@relationshipProperties` type. Its fields are stored on the relationship. In queries they appear under `edges { properties { roles } }` in the `...Connection` fields.
- Relationship types are the Neo4j relationship names (`ACTED_IN`), so the seed Cypher and the schema must agree.

## Computed fields with `@cypher`

A field whose value is computed by Cypher each time it is requested:

```graphql
similar(limit: Int = 8): [Movie!]!
  @cypher(
    statement: """
    MATCH (this)-[r1:IN_GENRE|ACTED_IN|DIRECTED]-(shared)-[r2:IN_GENRE|ACTED_IN|DIRECTED]-(other:Movie)
    WHERE other <> this AND type(r1) = type(r2)
    WITH other, sum(CASE type(r1) WHEN 'DIRECTED' THEN 3 WHEN 'ACTED_IN' THEN 2 ELSE 1 END) AS score
    ORDER BY score DESC, other.rating DESC, other.title
    RETURN other LIMIT $limit
    """
    columnName: "other"
  )
```

- `this` is the current node. Field arguments are available as `$name`.
- `columnName` must match the name returned by the statement.
- Computed fields always reflect the current graph, but you cannot sort or filter by them in plain GraphQL. That is why film counts are stored as real properties instead ([seeding](seeding.md#derived-counts)).
- Return type can be a node type or a scalar. A plain object type (like `Collaboration` below) works if the statement returns a map of scalars.

**Known limitation:** a plain object type returned from `@cypher` cannot contain a node. `Person.collaborators` was first written to return `{person: <Person>, films: Int}` and failed with "Unexpected error." when `person.name` was requested. It returns `{name, films}` instead and clients look the person up by name.

## Rules that apply when you edit the schema

1. **Describe everything.** Lint (`npm run lint`) uses GraphQL ESLint's `require-description` for types, fields and arguments. A field with no description fails the build.
2. **Add stubs for new directives.** Lint and the breaking-change check cannot read Neo4j directives on their own. `tooling/neo4j-directives.graphql` declares the ones in use (`@node`, `@relationship`, `@relationshipProperties`, `@cypher`). If you use another directive, add a declaration there.
3. **Check for breaking changes.** `npm run schema:check` compares your working copy with `HEAD` (or pass a git ref: `sh scripts/schema-check.sh origin/main`). Removing or changing a field's type is reported as breaking; adding is not.
4. **Regenerate the reference.** `npm run docs:schema` rewrites [schema-reference.md](schema-reference.md). CI fails if the committed file is stale.
5. **Restart the server.** The schema is read at startup. In Docker you can mount a different file over `/app/schema/schema.graphql` without rebuilding (see [configuration](configuration.md#using-your-own-schema-and-seed)).

## Authentication and authorization rules in v7

These come from building the `grandstack-auth` extension. Rules only work when the server verifies tokens (the `AUTH_*` variables in [configuration](configuration.md)); put them in a separate file loaded with `SCHEMA_EXTRA_PATHS` so the default, open schema still starts.

- **Claims:** declare the token shape once with a `@jwt` type, then use it in rules:
  ```graphql
  type JWT @jwt {
    roles: [String!]! @jwtClaim(path: "roles")
    sub: String
  }
  ```
- **Require a login or a role** with `@authentication`; `operations` can be `CREATE`, `READ`, `AGGREGATE`, `UPDATE`, `DELETE`, `CREATE_RELATIONSHIP`, `DELETE_RELATIONSHIP`, `SUBSCRIBE`:
  ```graphql
  extend type Movie @authentication(operations: [CREATE, UPDATE, DELETE], jwt: { roles: { includes: "editor" } })
  ```
  Unauthenticated requests get an `Unauthenticated` error and wrong-role requests get `Forbidden`.
- **Row-level rules** with `@authorization`. Prefer **`filter`** rules: for anyone not allowed, the row is simply not matched, so an update or delete changes nothing. Compare a relationship to the caller with `$jwt`:
  ```graphql
  extend type Review @authorization(filter: [{
    operations: [UPDATE, DELETE]
    where: { OR: [{ node: { author: { sub: { eq: "$jwt.sub" } } } }, { jwt: { roles: { includes: "moderator" } } }] }
  }])
  ```
  v7 filters use operators (`sub: { eq: ... }`); the old style (`sub: "$jwt.sub"`) is rejected.
- **`validate` rules need the APOC plugin** (they call `apoc.util.validate`) and fail with `There is no procedure with the name apoc.util.validate` when it is missing. This stack's Neo4j has no APOC, so the example uses `filter` rules. Add APOC to Neo4j if you need rules that raise an error.
- **`DateTime` fields also need APOC** to be read (`apoc.date.convertFormat`). The example stores timestamps as ISO 8601 strings instead.
- **Stop clients rewiring relationships** with `nestedOperations: []` on the field, for example `author: User @relationship(type: "WROTE_REVIEW", direction: IN, nestedOperations: [])`.
- **Make the author come from the token** by not exposing generated creation: `type Review @node @mutation(operations: [UPDATE, DELETE])` removes `createReviews`, and a custom `@cypher` mutation creates the review using `$jwt.sub`. In `@cypher` statements the token claims are available as `$jwt`.
- **Other rules we hit:** there is no `@unique` in v7 (create constraints with Cypher in `SETUP_CYPHER_PATHS`); declare custom root mutations with `type Mutation { ... }` in an extra file, not `extend type Mutation`; a relationship field that points to one node must be nullable; `@mutation(operations: [])` removes all generated mutations for a type.

## What gets generated for each type

For a `@node` type `Movie`, `@neo4j/graphql` adds:

- Queries: `movies(where, sort, limit, offset)`, `moviesConnection(where, sort, first, after)` (adds `totalCount` and edge properties).
- Mutations: `createMovies(input)`, `updateMovies(where, update)`, `deleteMovies(where)`.
- Filter input `MovieWhere` (fields, `AND`/`OR`/`NOT`, relationship filters such as `genres: { some: { name: { in: [...] } } }`), sort input `MovieSort`, create and update inputs with nested relationship operations.

Filters for strings use `eq`, `in`, `contains`, `startsWith`, `endsWith`; numbers use `eq`, `in`, `gt`, `gte`, `lt`, `lte`. `contains` is case-sensitive. Explore the exact shapes in GraphiQL at `/graphql` or by introspection.

Next: [mutations](mutations.md), [seeding](seeding.md).
