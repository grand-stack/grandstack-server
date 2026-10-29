// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
import { Kind, parse, type DefinitionNode } from "graphql";

type TypeLike = DefinitionNode & { name: { value: string }; directives?: readonly { name: { value: string } }[] };

const isTypeLike = (d: DefinitionNode): d is TypeLike => d.kind === Kind.OBJECT_TYPE_DEFINITION || d.kind === Kind.OBJECT_TYPE_EXTENSION;
const has = (d: TypeLike, directive: string) => (d.directives ?? []).some((x) => x.name.value === directive);

/**
 * Makes the API read-only: every node type gets `@mutation(operations: [])`, so the generated create, update and delete mutations are
 * never produced. The node types are found in the schema itself, so a new type is covered without anyone remembering to list it.
 * A type that already says what its mutations are is left to say it.
 */
export function addReadOnly(typeDefs: string): string {
  const definitions = parse(typeDefs).definitions.filter(isTypeLike);
  const nodes = new Set(definitions.filter((d) => has(d, "node")).map((d) => d.name.value));
  const decided = new Set(definitions.filter((d) => has(d, "mutation")).map((d) => d.name.value));
  const extensions = [...nodes].filter((n) => !decided.has(n)).map((n) => `extend type ${n} @mutation(operations: [])`);
  return extensions.length === 0 ? typeDefs : `${typeDefs}\n${extensions.join("\n")}\n`;
}
