# Recipes

Step-by-step changes for the server. Each ends with how to check it worked. Run commands from the repo root of `grandstack-server`. These are written so a developer or a coding agent can follow them literally.

## Add a field to an existing type

Example: add `country: String` to `Movie`.

1. Edit `schema/schema.graphql`: add the field **with a description**.
   ```graphql
   """Country of production."""
   country: String
   ```
2. Run `npm run lint` (fails if you forgot the description) and `npm run schema:check` (adding a field is not breaking).
3. Run `npm run docs:schema` to refresh the reference.
4. If the field should be in the sample data, add `SET m.country = ...` in the seed generator or file and bump `// seed-version`.
5. Restart the server. Check: `curl -s localhost:4000/graphql -H 'content-type: application/json' -d '{"query":"{ movies(limit:1){ title country } }"}'`.
6. The web app needs `npm run codegen` to see the field (see `docs/recipes.md` in the `grandstack-web` repo).

## Add a relationship

Example: `Movie` has a `Studio`.

1. Add `type Studio @node { """Studio name.""" name: String! movies: [Movie!]! @relationship(type: "PRODUCED", direction: OUT) }`.
2. On `Movie` add `studio: Studio @relationship(type: "PRODUCED", direction: IN)`. Use `[Studio!]!` for many.
3. Add the unique constraint and the `MERGE` statements to the seed; bump the seed version.
4. Lint, `schema:check`, `docs:schema`, restart.
5. Check with a query for `movies { title studio { name } }`.

## Add a computed field

Use `@cypher` ([schema guide](schema-guide.md#computed-fields-with-cypher)). Remember `columnName`, arguments as `$name`, and that you cannot sort or filter by it. If you need to sort or filter, store the value as a property and refresh it (see how the film counts work in [seeding](seeding.md#derived-counts)).

## Change the sample data

1. Edit the seed (it is generated data; if you have the generator, change that).
2. Bump `// seed-version: N`.
3. Restart. A database seeded by this server reloads; check the log for `Loaded seed`.

## Add a server plugin

Plugins wrap execution. `src/refreshCountsPlugin.ts` is a complete example: it uses `onExecute` with `setExecuteFn` to run code after a mutation. Add yours to the `plugins` array in `src/index.ts`, and write unit tests with fakes like `test/refreshCountsPlugin.test.ts`.

## Turn on an environment option

Add the variable to `Config` and `loadConfig` in `src/config.ts` with a default, validate it, add a test in `test/config.test.ts`, use it in `src/index.ts`, then add it to the table in [configuration](configuration.md) and to `AGENTS.md`.

## Before you commit

```sh
npm run lint && npm test && npm run schema:check && npm run docs:check
```
