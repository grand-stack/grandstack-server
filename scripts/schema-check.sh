#!/bin/sh
# Breaking-change check: compares schema/schema.graphql against a git ref (default HEAD).
# Neo4j directive stubs are prepended so Inspector can load both versions.
set -e
REF="${1:-HEAD}"
TMP="$(mktemp -d)"
cat tooling/neo4j-directives.graphql > "$TMP/base.graphql"
git show "$REF:schema/schema.graphql" >> "$TMP/base.graphql"
cat tooling/neo4j-directives.graphql schema/schema.graphql > "$TMP/head.graphql"
npx graphql-inspector diff "$TMP/base.graphql" "$TMP/head.graphql"
