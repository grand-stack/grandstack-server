#!/bin/sh
# Breaking-change check: compares schema/schema.graphql against a git ref (default HEAD).
# Neo4j directive stubs are prepended so Inspector can load both versions.
set -e
REF="${1:-HEAD}"
if ! git rev-parse --verify --quiet "$REF:schema/schema.graphql" >/dev/null 2>&1; then
  echo "schema:check compares schema/schema.graphql with the version at git ref \"$REF\", but that was not found." >&2
  echo "Run it inside a git checkout where the schema is committed at that ref (default HEAD), or pass another ref." >&2
  exit 2
fi
TMP="$(mktemp -d)"
cat tooling/neo4j-directives.graphql > "$TMP/base.graphql"
git show "$REF:schema/schema.graphql" >> "$TMP/base.graphql"
cat tooling/neo4j-directives.graphql schema/schema.graphql > "$TMP/head.graphql"
npx graphql-inspector diff "$TMP/base.graphql" "$TMP/head.graphql"
