# Recipes

Step-by-step changes for the server. Each ends with how to check it worked. Run commands from the repo root of `grandstack-server`. These are written so a developer or a coding agent can follow them literally.

> **Where to run this.** Commands on this page that start with `npm`, `node` or `docker build` run inside a clone of this repository: `git clone https://github.com/grand-stack/grandstack-server`, then `cd grandstack-server` (Node 22 or later; run `npm ci` once). Commands that need the running stack use the `grandstack` repository's compose files: see the [quickstart](https://grandstack.ai/quickstart/).

## Add a field to an existing type

Example: add `country: String` to `Movie`.

1. Edit `schema/schema.graphql`: add the field **with a description**.
   ```graphql
   """Country of production."""
   country: String
   ```
2. Run `npm run lint` (fails if you forgot the description) and `npm run schema:check` (adding a field is not breaking). `schema:check` compares with the schema committed at git `HEAD`, so it needs a git checkout and only means something if you committed the baseline before editing; outside git it stops with a message saying so.
3. Run `npm run docs:schema` to refresh the reference, and commit it. (`npm run docs:check` fails until you have run this.)
4. If the field should be in the sample data, bump `// seed-version` and add statements to `seed/movies.cypher`. The bundled file was produced by a one-off script that is not shipped in the repo, so edit the file directly: to set a property on a few existing films add a line like `MATCH (m:Movie {title: "The Matrix"}) SET m.country = "USA";` before the final derived-counts statement (the file already does this for `Person.born`).
5. Restart the server: `docker compose up --build server` in the `grandstack` repo (the schema is copied into the image), or, without a rebuild, mount your schema file as shown in [configuration](configuration.md#using-your-own-schema-and-seed). A bumped seed only reloads on a database that has the seed marker; with `SEED=false` you must write the data yourself. Check: `curl -s localhost:4000/graphql -H 'content-type: application/json' -d '{"query":"{ movies(limit:1){ title country } }"}'`.
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

## Add types without touching the base schema

Put them in a new file and load it with `SCHEMA_EXTRA_PATHS=/app/schema/extra.graphql` (mount the file into the image). Use `extend type Movie { ... }` to add fields to existing types. For constraints and indexes the new types need, write idempotent Cypher (`CREATE CONSTRAINT ... IF NOT EXISTS`) in a file listed in `SETUP_CYPHER_PATHS`. This is how `grandstack-auth` adds users, reviews and its access rules.

## Add a server plugin

Plugins wrap execution. `src/refreshCountsPlugin.ts` is a complete example: it uses `onExecute` with `setExecuteFn` to run code after a mutation. Add yours to the `plugins` array in `src/index.ts`, and write unit tests with fakes like `test/refreshCountsPlugin.test.ts`.

## Turn on an environment option

Add the variable to `Config` and `loadConfig` in `src/config.ts` with a default, validate it, add a test in `test/config.test.ts`, use it in `src/index.ts`, then add it to the table in [configuration](configuration.md) and to `AGENTS.md`.

## Before you commit

```sh
npm run lint && npm test && npm run schema:check && npm run docs:check
```
