# Mutations

`@neo4j/graphql` generates `create`, `update` and `delete` mutations for each node type. The examples below use the Movies schema and have been run against a live server. Send them as `POST /graphql` with `content-type: application/json`, or paste the GraphQL into GraphiQL.

## Create, including relationships

```graphql
mutation Create($input: [MovieCreateInput!]!) {
  createMovies(input: $input) { movies { title } }
}
```

```json
{
  "input": [{
    "title": "My Film",
    "released": 2024,
    "genres":    { "connect": [{ "where": { "node": { "name": { "eq": "Drama" } } } }],
                   "create":  [{ "node": { "name": "Brand New Genre" } }] },
    "directors": { "connect": [{ "where": { "node": { "name": { "eq": "Nora Ephron" } } } }] },
    "actors":    { "connect": [{ "where": { "node": { "name": { "eq": "Tom Hanks" } } }, "edge": { "roles": ["Hero"] } }],
                   "create":  [{ "node": { "name": "New Person" }, "edge": { "roles": ["Villain", "Boss"] } }] }
  }]
}
```

- `connect` links to something that already exists (matched by `where`). `create` makes a new node and links it.
- `edge` holds the relationship properties (here `roles`, from `ActedIn`).
- Creating something that already exists (a duplicate title, or a `create` of an existing name) fails with `Constraint validation failed` and nothing is saved.

## Update

Scalar fields use set operators, not plain values:

```graphql
mutation { updateMovies(where: { title: { eq: "My Film" } }, update: { tagline: { set: "A new tagline" }, rating: { set: 7.5 } }) { movies { title tagline } } }
```

- `{ set: null }` clears an optional field.
- Passing a bare value fails validation: inline (`tagline: "x"`) with `Expected value of type "StringScalarMutations", found "x"`, and through variables with `Expected type "StringScalarMutations" to be an object`.
- Renaming the key field works the same way: `title: { set: "New title" }`.

### Changing relationships: send a diff

Each relationship field on the update input is a **list** of operations. Use `disconnect`, `connect`, `create` and `update`:

```json
{
  "actors": [
    { "disconnect": [{ "where": { "node": { "name": { "in": ["Tom Hanks"] } } } }],
      "connect":    [{ "where": { "node": { "name": { "eq": "Brad Pitt" } } }, "edge": { "roles": ["Cameo"] } }],
      "create":     [{ "node": { "name": "ZZ New" }, "edge": { "roles": ["Extra"] } }] },
    { "update": { "where": { "node": { "name": { "eq": "Meg Ryan" } } }, "edge": { "roles": { "set": ["Changed"] } } } }
  ]
}
```

- `update` is a single object per list entry (not a list), so changing the roles of several people takes one list entry each.
- **Do not "disconnect everything, then connect the new set" in one mutation.** In v7 the disconnect runs *after* the connect, which removes the links you just made (the result is an empty cast). Send only what changed. The web app's `buildUpdateInput` in `grandstack-web/src/forms/model.ts` does this and has unit tests for it.
- `disconnect` with `where: {}` removes all links; only do that on its own, not combined with `connect`.

## Delete

```graphql
mutation { deleteMovies(where: { title: { eq: "My Film" } }) { nodesDeleted relationshipsDeleted } }
```

Deleting a node also deletes its relationships (it detaches), but the nodes at the other end stay: deleting a movie keeps its people and genres, and deleting a person removes them from the casts of their films. Both return counts of what was removed.

## Stored counts are refreshed after every mutation

`Person.actedCount` and `directedCount` are stored properties ([seeding](seeding.md#derived-counts)). `src/refreshCountsPlugin.ts` is a Yoga plugin that wraps execution: after any operation whose type is `mutation`, it runs the recalculation in `src/counts.ts` and only then returns the response. A client that refetches straight after a mutation therefore sees correct counts. Details:

- It also runs when the mutation returned errors, because a partly applied mutation may still have changed credits.
- If the refresh itself fails, the error is logged and the mutation result is returned unchanged.
- It recalculates for **all** people on each mutation. That is fine at this size (a few hundred people); for a large graph, change `REFRESH_COUNTS_CYPHER` in `src/counts.ts` to touch only affected nodes, or set `REFRESH_COUNTS=false` if you have no derived values.
- It applies to every client: the web app, `curl`, or an agent.
- **The mutation's own response is built before the refresh.** Counts selected inside a mutation result can be `null` (a new person) or one step behind. Read them with a query after the mutation. The web app refetches, so it always shows the refreshed values.

## Trying it

```sh
curl -s localhost:4000/graphql -H 'content-type: application/json' -d '{"query":"mutation { createPeople(input:[{name:\"Test Person\"}]) { people { name } } }"}'
# counts are refreshed after the mutation, so read them with a separate query:
curl -s localhost:4000/graphql -H 'content-type: application/json' -d '{"query":"{ people(where:{name:{eq:\"Test Person\"}}) { name actedCount directedCount } }"}'
curl -s localhost:4000/graphql -H 'content-type: application/json' -d '{"query":"mutation { deletePeople(where:{name:{eq:\"Test Person\"}}) { nodesDeleted } }"}'
```
